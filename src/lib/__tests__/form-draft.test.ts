/**
 * 表单草稿（src/lib/form-draft.ts）单测。
 *
 * 重点钉两件事：
 * 1. **白名单双向生效** —— 密码这类字段既不进草稿，也不会被草稿写回表单。
 *    这是这套机制唯一的安全红线，破了就是明文密码躺在 sessionStorage 里。
 * 2. **任何存储异常都不能让用户填不了表** —— 隐私模式、存储被禁、存了脏数据，
 *    一律退化成「没有草稿」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  applyDraft,
  clearDraft,
  collectDraft,
  readDraft,
  writeDraft,
  type DraftSpec,
} from "@/lib/form-draft";

/** 最小 sessionStorage 替身（node 环境没有真货） */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

type FieldStub = {
  value?: string;
  checked?: boolean;
};

/** 只实现 form-draft 真正用到的两个能力：elements.namedItem + 字段上的 value/checked */
function makeForm(fields: Record<string, FieldStub>): HTMLFormElement {
  return {
    elements: {
      namedItem: (name: string) => (name in fields ? fields[name] : null),
    },
  } as unknown as HTMLFormElement;
}

const SPEC: DraftSpec = {
  key: "test:draft:v1",
  textFields: ["username", "email", "country"],
  // 注意：password 故意不在白名单里，下面有专门的用例盯它
  checkboxFields: ["consent"],
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collectDraft：只收白名单字段", () => {
  it("文本框按白名单收，密码字段被挡在外面", () => {
    const form = makeForm({
      username: { value: "zhangsan" },
      email: { value: "a@b.com" },
      password: { value: "super-secret-123" },
      confirmPassword: { value: "super-secret-123" },
    });

    const draft = collectDraft(form, SPEC);

    expect(draft).toEqual({ username: "zhangsan", email: "a@b.com" });
    // 🔴 安全红线：密码绝不能进草稿
    expect(JSON.stringify(draft)).not.toContain("super-secret-123");
    expect(draft).not.toHaveProperty("password");
    expect(draft).not.toHaveProperty("confirmPassword");
  });

  it("勾选框收 checked 布尔值", () => {
    const form = makeForm({ consent: { checked: true } });
    expect(collectDraft(form, SPEC)).toEqual({ consent: true });
  });

  it("表单为 null（尚未挂载）时返回空对象而不是抛错", () => {
    expect(collectDraft(null, SPEC)).toEqual({});
  });
});

describe("writeDraft / readDraft 往返", () => {
  it("写进去读出来一致", () => {
    writeDraft(SPEC, { username: "lisi", email: "l@si.com", consent: true });
    expect(readDraft(SPEC)).toEqual({ username: "lisi", email: "l@si.com", consent: true });
  });

  it("写的时候就把白名单外的键丢掉，脏数据进不了存储", () => {
    writeDraft(SPEC, { username: "wangwu", password: "leak-me" } as never);
    expect(storage.getItem("test:draft:v1")).not.toContain("leak-me");
    expect(readDraft(SPEC)).toEqual({ username: "wangwu" });
  });

  it("存储里是坏 JSON / 非对象时按「没有草稿」处理", () => {
    storage.setItem("test:draft:v1", "{not json");
    expect(readDraft(SPEC)).toBeNull();

    storage.setItem("test:draft:v1", '["username"]');
    expect(readDraft(SPEC)).toBeNull();

    storage.setItem("test:draft:v1", '"just a string"');
    expect(readDraft(SPEC)).toBeNull();
  });

  it("读的时候就过滤：手动塞进存储的白名单外字段读不出来", () => {
    storage.setItem("test:draft:v1", JSON.stringify({ username: "x", password: "p" }));
    expect(readDraft(SPEC)).toEqual({ username: "x" });
  });

  it("clearDraft 之后读不到", () => {
    writeDraft(SPEC, { username: "abc" });
    clearDraft(SPEC);
    expect(readDraft(SPEC)).toBeNull();
  });
});

describe("applyDraft：写回表单", () => {
  it("把值写进 DOM，并报告「确实恢复了内容」", () => {
    const fields = {
      username: { value: "" },
      email: { value: "" },
      country: { value: "" },
    };
    const form = makeForm(fields);

    const applied = applyDraft(form, { username: "zhaoliu", email: "z@l.com" }, SPEC);

    expect(applied).toBe(true);
    expect(fields.username.value).toBe("zhaoliu");
    expect(fields.email.value).toBe("z@l.com");
  });

  it("全部是空串时不报告恢复（避免无端弹出提示）", () => {
    const form = makeForm({ username: { value: "" }, email: { value: "" } });
    expect(applyDraft(form, { username: "", email: "" }, SPEC)).toBe(false);
  });

  it("草稿为 null 时什么都不做", () => {
    const fields = { username: { value: "keep" } };
    expect(applyDraft(makeForm(fields), null, SPEC)).toBe(false);
    expect(fields.username.value).toBe("keep");
  });

  it("🔴 即使草稿里有 password，也不会被写进密码框", () => {
    const fields = { password: { value: "" } };
    const form = makeForm(fields);
    applyDraft(form, { password: "injected" } as never, SPEC);
    expect(fields.password.value).toBe("");
  });

  it("勾选框写 checked；只有 false 时不算恢复", () => {
    const fields = { consent: { checked: true } };
    expect(applyDraft(makeForm(fields), { consent: false }, SPEC)).toBe(false);
    expect(fields.consent.checked).toBe(false);
  });

  it("下拉框选项已变更、值写不进去时，不当成恢复成功", () => {
    // 模拟 <select> 里没有该 option：赋值被忽略，value 停在空串
    const stubborn = {
      _v: "",
      get value() {
        return this._v;
      },
      set value(_next: string) {
        /* 选项不存在，写不进去 */
      },
    };
    const form = makeForm({ country: stubborn as unknown as FieldStub });
    expect(applyDraft(form, { country: "OTHER" }, SPEC)).toBe(false);
  });
});

describe("存储不可用时的降级（隐私模式 / 站点数据被禁 / 服务端渲染）", () => {
  it("window 上没有 sessionStorage", () => {
    vi.stubGlobal("window", {});
    expect(readDraft(SPEC)).toBeNull();
    expect(() => writeDraft(SPEC, { username: "a" })).not.toThrow();
    expect(() => clearDraft(SPEC)).not.toThrow();
  });

  it("读 sessionStorage 属性本身就抛 SecurityError（Safari 无痕）", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(readDraft(SPEC)).toBeNull();
    expect(() => writeDraft(SPEC, { username: "a" })).not.toThrow();
  });

  it("写入超配额抛错时不冒泡到调用方", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => undefined,
      },
    });
    expect(() => writeDraft(SPEC, { username: "a" })).not.toThrow();
  });

  it("没有 window（服务端渲染）时全部安全降级", () => {
    vi.unstubAllGlobals();
    expect(readDraft(SPEC)).toBeNull();
    expect(() => writeDraft(SPEC, { username: "a" })).not.toThrow();
  });
});
