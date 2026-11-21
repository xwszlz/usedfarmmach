/**
 * 表单草稿（sessionStorage）—— 让「填到一半跳走、回来接着填」成为默认行为。
 *
 * ## 为什么需要
 * 2026-11-21 老板实测 `/auth/register`：用户名密码填完，点《数据出境》单独同意条款跳去
 * 看正文，看完点「返回注册」—— 回来是个空表单，全丢了要重填。
 *
 * 根因是这两个表单都是**非受控**的：组件里没有一个字段由 React state 托管，提交时才用
 * `form.elements.namedItem()` 从 DOM 里捞值。路由一换页，表单组件整个被卸载，DOM 里的
 * 输入跟着消失，React 也无从恢复 —— 它压根不知道用户填过什么。
 *
 * ## 两条路一起上
 * 1. **条款链接改新标签打开**（组件里的 `target="_blank"`）：老板报的那个场景根本不再
 *    离开原页面，一个字段都不丢，**连密码都不丢**。这是主修复。
 * 2. **本模块的 sessionStorage 草稿**：兜住新标签救不了的场景 —— 手动刷新、浏览器后退、
 *    误关重开、手机上后台标签被系统回收。这些场景下密码必须重填（原因见下）。
 *
 * ## 🔴 敏感字段白名单
 * 只存调用方明确写进 `textFields` 的键。密码、确认密码、证件号这类字段**绝不能**写进去：
 * sessionStorage 在多数浏览器里是落盘可恢复的（会话恢复/崩溃恢复），同源任意 XSS 也能
 * 读。它只配存「本来就要交给服务端的公开信息」—— 用户名、邮箱、公司名、国家。
 *
 * 白名单是双向生效的：`collectDraft` 只收白名单字段，`applyDraft` 也只往白名单字段写，
 * 所以即使 sessionStorage 里的草稿被改脏，也无法把值注入到白名单之外的表单字段。
 */

export type DraftValue = string | boolean;
export type DraftValues = Record<string, DraftValue>;

export interface DraftSpec {
  /**
   * sessionStorage 的键。**务必带版本号**：字段结构一改就把 v1 升成 v2，
   * 旧草稿自动作废，省掉「上线后老用户被灌进一堆对不上的旧字段」这类脏数据。
   */
  key: string;
  /** 参与草稿的文本框 / 下拉框的 name。🔴 密码类字段绝不能出现在这里。 */
  textFields: readonly string[];
  /** 参与草稿的复选框 name，存 `checked` 布尔值。 */
  checkboxFields?: readonly string[];
}

function allowedKeys(spec: DraftSpec): string[] {
  return [...spec.textFields, ...(spec.checkboxFields ?? [])];
}

/**
 * 拿 sessionStorage。三种情况会拿不到，全部返回 null 而不是抛错：
 * 服务端渲染（没有 window）、Safari 无痕、浏览器设置里禁了站点数据（连读属性都抛
 * SecurityError）。拿不到就退化成「没有草稿」，绝不能让用户填不了表。
 */
function getStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** 按白名单过滤一份草稿，顺手丢掉类型不对的值（防脏数据）。 */
function sanitize(spec: DraftSpec, values: Record<string, unknown>): DraftValues {
  const out: DraftValues = {};
  for (const key of allowedKeys(spec)) {
    const value = values[key];
    if (typeof value === "string" || typeof value === "boolean") out[key] = value;
  }
  return out;
}

/** 读草稿。没有 / 解析失败 / 存储不可用一律返回 null，调用方按「没草稿」处理。 */
export function readDraft(spec: DraftSpec): DraftValues | null {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(spec.key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return sanitize(spec, parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** 写草稿。配额满 / 隐私模式下的写失败直接吞掉 —— 草稿是锦上添花，不能变成拦路虎。 */
export function writeDraft(spec: DraftSpec, values: DraftValues): void {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(spec.key, JSON.stringify(sanitize(spec, values)));
  } catch {
    /* 忽略：草稿降级即可 */
  }
}

/** 清草稿。注册/提交成功后必须调，否则用户下次开页面会被灌回上一轮的旧内容。 */
export function clearDraft(spec: DraftSpec): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(spec.key);
  } catch {
    /* 忽略 */
  }
}

/**
 * `form.elements.namedItem()` 的返回类型是 `Element | RadioNodeList`，两者都不在
 * `Element` 声明的表面上带 `value`/`checked`，所以直接 `as HTMLInputElement` 会被 TS
 * 判成「两类型不重叠」而报 TS2352。这里统一收窄一次、只在这一处开这个口子：
 * 运行期拿到的必然是 input / select / textarea（都有 value:string），单选组则是
 * RadioNodeList（也有 value:string），行为一致。
 */
type FormControl = { value: string; checked: boolean };

function asControl(el: Element | RadioNodeList | null): FormControl | null {
  if (!el || !("value" in el)) return null;
  return el as unknown as FormControl;
}

/**
 * 从表单当前 DOM 里收一份草稿。
 * 表单是非受控的，真值只在 DOM 上，所以只能从 `form.elements` 读，读不到 React state。
 */
export function collectDraft(form: HTMLFormElement | null, spec: DraftSpec): DraftValues {
  const out: DraftValues = {};
  if (!form) return out;

  for (const name of spec.textFields) {
    const control = asControl(form.elements.namedItem(name));
    if (control) out[name] = control.value;
  }

  for (const name of spec.checkboxFields ?? []) {
    const el = form.elements.namedItem(name);
    if (!el || !("checked" in el)) continue;
    out[name] = (el as unknown as FormControl).checked;
  }

  return out;
}

/**
 * 把草稿写回 DOM。
 *
 * @returns 是否**真的**写进了任何一个非空值 —— 调用方用它决定要不要显示
 * 「已恢复上次填写的内容」那句提示。不提示是不行的：用户看到凭空出现的个人信息，
 * 轻则以为是 bug，重则会怀疑自己被跟踪（这本来就是个人信息，露出了就得说清楚）。
 */
export function applyDraft(
  form: HTMLFormElement | null,
  draft: DraftValues | null,
  spec: DraftSpec
): boolean {
  if (!form || !draft) return false;

  let applied = false;

  for (const name of spec.textFields) {
    const value = draft[name];
    if (typeof value !== "string") continue;
    const input = asControl(form.elements.namedItem(name));
    if (!input) continue;
    input.value = value;
    // 下拉框的选项会随版本变化，写不进去时 value 会停在空串 → 以写入后的实际值为准
    if (input.value !== "") applied = true;
  }

  for (const name of spec.checkboxFields ?? []) {
    const value = draft[name];
    if (typeof value !== "boolean") continue;
    const el = form.elements.namedItem(name);
    if (!el || !("checked" in el)) continue;
    (el as unknown as FormControl).checked = value;
    if (value) applied = true;
  }

  return applied;
}
