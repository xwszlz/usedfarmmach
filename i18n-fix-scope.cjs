// 作用域感知修复器（文本手术版，不依赖 TS printer）：解决 i18n-wrap 产生的
// "Cannot find name 'locale' / 'tr'" 错误。
//   - 服务端(translate 模式)：把缺失的 locale 以「参数」形式穿透进嵌套函数/helper，组件内注入 getLocale
//   - 客户端(tr 模式)：
//       * 嵌套组件函数(返回 JSX)：在函数体顶部注入 `const tr = useTr();`
//       * 嵌套 helper 函数：把 tr 作为「参数」穿透，调用处传 tr
//       * 模块级 const 数组(含 tr(...)/translate(...,locale))：转为 `function getX(dep){...}` 并更新引用
//   - metadata 导出：剥离 tr()/translate() 为字面量（Next.js 需要静态对象）
//   - 防重复：若函数已有 locale 作用域，绝不重复注入 getLocale
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const targets = process.argv.slice(2);
const rootDirs = targets.length ? targets : ["src/app", "src/components"];

function walkTsx(d, out) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const c = path.join(d, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(e.name) || e.name.startsWith(".")) continue;
      walkTsx(c, out);
    } else if (e.name.endsWith(".tsx")) out.push(c);
  }
}
const files = [];
for (const r of rootDirs) {
  if (fs.statSync(r).isDirectory()) walkTsx(r, files);
  else files.push(r);
}

function setParents(node, parent) { node.parent = parent; ts.forEachChild(node, (c) => setParents(c, parent)); }
function collectBindingNames(nameNode, names) {
  if (ts.isIdentifier(nameNode)) names.add(nameNode.text);
  else if (ts.isObjectBindingPattern(nameNode)) nameNode.elements.forEach((el) => collectBindingNames(el.name, names));
  else if (ts.isArrayBindingPattern(nameNode)) nameNode.elements.forEach((el) => { if (ts.isBindingElement(el)) collectBindingNames(el.name, names); });
}
function scopeNames(node) {
  const names = new Set();
  let cur = node;
  while (cur) {
    if (ts.isSourceFile(cur)) {
      ts.forEachChild(cur, (ch) => {
        if (ts.isImportDeclaration(ch) && ch.importClause && ch.importClause.namedBindings) {
          const nb = ch.importClause.namedBindings;
          if (ts.isNamedImports(nb)) nb.elements.forEach((e) => names.add(e.name.text));
          else if (ts.isNamespaceImport(nb)) names.add(nb.name.text);
        }
        if (ts.isVariableStatement(ch)) ch.declarationList.declarations.forEach((d) => collectBindingNames(d.name, names));
        if ((ts.isFunctionDeclaration(ch) || ts.isClassDeclaration(ch)) && ch.name) names.add(ch.name.text);
        if (ts.isInterfaceDeclaration(ch)) names.add(ch.name.text);
        if (ts.isTypeAliasDeclaration(ch)) names.add(ch.name.text);
        if (ts.isEnumDeclaration(ch)) names.add(ch.name.text);
      });
      break;
    }
    if (ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur) || ts.isMethodDeclaration(cur) || ts.isConstructorDeclaration(cur) || ts.isGetAccessor(cur) || ts.isSetAccessor(cur)) {
      cur.parameters.forEach((p) => { if (p.name && ts.isIdentifier(p.name)) names.add(p.name.text); });
    }
    if (ts.isBlock(cur) || ts.isModuleBlock(cur)) {
      ts.forEachChild(cur, (ch) => {
        if (ts.isVariableStatement(ch)) ch.declarationList.declarations.forEach((d) => collectBindingNames(d.name, names));
        if ((ts.isFunctionDeclaration(ch) || ts.isClassDeclaration(ch)) && ch.name) names.add(ch.name.text);
      });
    }
    cur = cur.parent;
  }
  return names;
}
function nearestFunction(node) {
  let cur = node;
  while (cur) {
    if (ts.isFunctionDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur) || ts.isMethodDeclaration(cur) || ts.isConstructorDeclaration(cur) || ts.isGetAccessor(cur) || ts.isSetAccessor(cur)) return cur;
    cur = cur.parent;
  }
  return null;
}
function isComponentLike(fnNode) {
  let hasJsx = false;
  function v(n) { if (hasJsx) return; if (ts.isJsxElement(n) || ts.isJsxFragment(n)) { hasJsx = true; return; } ts.forEachChild(n, (c) => v(c)); }
  if (fnNode.body) v(fnNode.body);
  return hasJsx;
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function findReferences(sf, name) {
  const refs = [];
  const seen = new Set();
  function v(n) {
    if (ts.isIdentifier(n) && n.text === name) {
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && p.name === n) return;
      if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p)) && p.name === n) return;
      if (ts.isParameter(p) && p.name === n) return;
      if (ts.isImportSpecifier(p) && p.name === n) return;
      if (ts.isPropertyAssignment(p) && p.name === n) return;
      if (ts.isMethodDeclaration(p) && p.name === n) return;
      if (ts.isPropertyAccessExpression(p) && p.name === n) return;
      if (ts.isJsxAttribute(p) && p.name === n) return;
      if (ts.isBindingElement(p) && p.name === n) return;
      if (ts.isTypeAliasDeclaration(p) && p.name === n) return;
      if (ts.isInterfaceDeclaration(p) && p.name === n) return;
      if (ts.isEnumDeclaration(p) && p.name === n) return;
      const k = n.getStart(sf);
      if (seen.has(k)) return;
      seen.add(k);
      refs.push(n);
    }
    ts.forEachChild(n, (c) => v(c));
  }
  v(sf);
  return refs;
}
function isModuleLevel(vd) {
  let p = vd;
  while (p && !ts.isSourceFile(p)) {
    if (ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p) || ts.isArrowFunction(p) || ts.isMethodDeclaration(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isBlock(p)) return false;
    p = p.parent;
  }
  return true;
}
// 正确判断：name 是否已在函数自身的参数或函数体内声明（scopeNames 只向上走，看不到自身 body）
function hasLocalDecl(fn, name) {
  for (const p of fn.parameters) {
    if (ts.isIdentifier(p.name) && p.name.text === name) return true;
    if (ts.isObjectBindingPattern(p.name)) for (const el of p.name.elements) if (ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === name) return true;
  }
  let found = false;
  function walk(n) {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) { found = true; return; }
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name)) for (const el of n.name.elements) if (ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === name) { found = true; return; }
    ts.forEachChild(n, walk);
  }
  if (fn.body) walk(fn.body);
  return found;
}
// 删除函数体内已有的 tr/locale 声明（仅当初始化器为 useTr()/getLocale()），避免重复或位置错误
// ctx 携带 per-file 上下文（pos/end/src0/edits 在 for 循环内声明，模块级函数不可见，必须显式传入）
function removeBodyDecl(fn, name, ctx) {
  const { src0, edits, pos, end } = ctx;
  const found = [];
  function walk(n) {
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        const isTarget = (ts.isIdentifier(d.name) && d.name.text === name) || (ts.isObjectBindingPattern(d.name) && d.name.elements.some((el) => ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === name));
        if (isTarget && d.initializer && ts.isCallExpression(d.initializer) && ts.isIdentifier(d.initializer.expression) && (d.initializer.expression.text === "useTr" || d.initializer.expression.text === "getLocale")) {
          found.push(n);
        }
      }
    }
    ts.forEachChild(n, walk);
  }
  if (fn.body) walk(fn.body);
  for (const vs of found) {
    let e = end(vs);
    if (src0[e] === "\n") e++;
    edits.push({ start: pos(vs), end: e, text: "" });
  }
}
function nearestComponentAncestor(n) {
  let c = n.parent;
  while (c) {
    if ((ts.isFunctionDeclaration(c) || ts.isFunctionExpression(c) || ts.isArrowFunction(c) || ts.isMethodDeclaration(c)) && isComponentLike(c)) return c;
    c = c.parent;
  }
  return null;
}
function isArrowCallback(fn) { return ts.isArrowFunction(fn) && ts.isCallExpression(fn.parent); }

let stats = { localeParam: 0, trInject: 0, trParam: 0, moduleConst: 0, moduleMeta: 0, importTranslate: 0, importUseTr: 0, importGetLocale: 0, useClient: 0, warn: 0 };

for (const file of files) {
  const src0 = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src0, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // 注意：createSourceFile 第4参数 true 已建立 .parent 链，切勿再用 setParents 覆盖（会清空父链）
  const edits = [];
  const pos = (node) => node.getStart(sf);
  const end = (node) => node.getEnd();

  const trFns = new Set();        // helper 函数（直接 tr 调用缺 tr）
  const trInjectFns = new Set();  // 组件函数（直接 tr 调用缺 tr）
  const localeParamFns = new Set();
  const localeInjectFns = new Set();
  const moduleConsts = new Map(); // name -> {vd, vstmt, isExport, isMetadata, deps:Set}
  let needTranslateImport = false, needUseTrImport = false, needUseClient = false;

  function getModuleConst(name) {
    if (!moduleConsts.has(name)) moduleConsts.set(name, { name, deps: new Set() });
    return moduleConsts.get(name);
  }

  function analyze(n) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (ts.isIdentifier(callee)) {
        if (callee.text === "tr") {
          needUseTrImport = true; needUseClient = true;
          const fn = nearestFunction(n);
          if (fn) {
            let target = fn;
            if (isArrowCallback(fn)) { const anc = nearestComponentAncestor(n); if (anc) target = anc; }
            if (!scopeNames(n).has("tr")) { if (isComponentLike(target)) trInjectFns.add(target); else trFns.add(target); }
          } else {
            let c = n; while (c && !ts.isSourceFile(c)) { if (ts.isVariableDeclaration(c) && isModuleLevel(c)) { const mc = getModuleConst(c.name.text); mc.vd = c; mc.vstmt = c.parent.parent; mc.isExport = !!(c.parent.parent.modifiers && c.parent.parent.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)); mc.isMetadata = c.name.text === "metadata"; mc.deps.add("tr"); break; } c = c.parent; }
          }
        } else if (callee.text === "translate" && n.arguments.length >= 2 && ts.isIdentifier(n.arguments[1]) && n.arguments[1].text === "locale") {
          needTranslateImport = true;
          const fn = nearestFunction(n);
          if (fn) {
            let target = fn;
            if (isArrowCallback(fn)) { const anc = nearestComponentAncestor(n); if (anc) target = anc; }
            if (!scopeNames(n).has("locale")) { if (isComponentLike(target)) localeInjectFns.add(target); else localeParamFns.add(target); }
          } else {
            let c = n; while (c && !ts.isSourceFile(c)) { if (ts.isVariableDeclaration(c) && isModuleLevel(c)) { const mc = getModuleConst(c.name.text); mc.vd = c; mc.vstmt = c.parent.parent; mc.isExport = !!(c.parent.parent.modifiers && c.parent.parent.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)); mc.isMetadata = c.name.text === "metadata"; mc.deps.add("locale"); break; } c = c.parent; }
          }
        }
      }
    }
    ts.forEachChild(n, analyze);
  }
  analyze(sf);

  // 模块级 const 的「外部引用」-> 把消费函数加入 tr/locale fixpoint，确保 dep 作用域
  function fnNameOf(fn) { return fn.name && ts.isIdentifier(fn.name) ? fn.name.text : null; }
  function callSitesOf(fn) {
    const name = fnNameOf(fn);
    if (!name) return [];
    const refs = findReferences(sf, name);
    const sites = [];
    for (const r of refs) {
      const p = r.parent;
      if (ts.isCallExpression(p) && p.expression === r) sites.push({ kind: "call", node: p });
      else if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === r) sites.push({ kind: "jsx", node: p });
    }
    return sites;
  }
  for (const [, info] of moduleConsts) {
    if (info.isMetadata) continue;
    for (const r of findReferences(sf, info.name)) {
      // 跳过声明本身与位于其它模块 const 初始化器内部的引用（在 body 文本替换中处理）
      let inAnyInit = false;
      for (const [, o] of moduleConsts) { if (o.vd && pos(r) >= pos(o.vd.initializer) && pos(r) < end(o.vd.initializer)) { inAnyInit = true; break; } }
      const p = r.parent;
      if (inAnyInit) continue;
      if (ts.isVariableDeclaration(p) && p.name === r) continue;
      const fn = nearestFunction(r);
      if (!fn) { stats.warn++; console.warn("  [警告] 模块 const " + info.name + " 的模块级引用无法转换: " + file + ":" + (sf.getLineAndCharacterOfPosition(pos(r)).line + 1)); continue; }
      if (info.deps.has("tr")) { if (isComponentLike(fn)) trInjectFns.add(fn); else trFns.add(fn); }
      if (info.deps.has("locale")) { if (isComponentLike(fn)) localeInjectFns.add(fn); else localeParamFns.add(fn); }
    }
  }

  // ---- locale fixpoint（穿透参数 + 组件注入 getLocale）----
  const allLocaleFns = new Set([...localeInjectFns, ...localeParamFns]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const fn of [...allLocaleFns]) {
      for (const site of callSitesOf(fn)) {
        const enc = nearestFunction(site.node);
        if (enc && enc !== fn && !scopeNames(site.node).has("locale") && !allLocaleFns.has(enc)) {
          allLocaleFns.add(enc);
          if (isComponentLike(enc)) localeInjectFns.add(enc); else localeParamFns.add(enc);
          changed = true;
        }
      }
    }
  }
  // 组件函数：注入 const locale = await getLocale(); 并标记 async（仅当 locale 尚未在作用域）
  for (const fn of localeInjectFns) {
    const isParam = fn.parameters.some((p) => (ts.isIdentifier(p.name) && p.name.text === "locale") || (ts.isObjectBindingPattern(p.name) && p.name.elements.some((el) => ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === "locale")));
    if (isParam) continue; // locale 由参数传入，不注入
    removeBodyDecl(fn, "locale", { src0, edits, pos, end });
    if (!fn.body) continue;
    const isAsync = ts.isFunctionDeclaration(fn)
      ? (fn.modifiers && fn.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))
      : (src0.substr(pos(fn), 5) === "async");
    if (!isAsync) {
      const kw = ts.isFunctionDeclaration(fn) ? src0.indexOf("function", pos(fn)) : pos(fn);
      if (kw >= 0) edits.push({ start: kw, end: kw, text: "async " });
    }
    const brace = pos(fn.body);
    if (ts.isBlock(fn.body)) {
      edits.push({ start: brace + 1, end: brace + 1, text: "\n  const locale = await getLocale();" });
    } else {
      const bodyText = src0.substring(brace, end(fn.body));
      edits.push({ start: brace, end: end(fn.body), text: "{\n  const locale = await getLocale();\n  return " + bodyText + ";\n}" });
    }
    stats.localeParam++;
  }
  // helper 函数：穿透 locale 参数
  for (const fn of localeParamFns) {
    const paramText = "locale: string";
    if (fn.parameters.length > 0) {
      const last = fn.parameters[fn.parameters.length - 1];
      edits.push({ start: end(last), end: end(last), text: ", " + paramText });
    } else {
      const nameEnd = fn.name ? end(fn.name) : pos(fn);
      const openParen = src0.indexOf("(", nameEnd);
      edits.push({ start: openParen + 1, end: openParen + 1, text: paramText });
    }
    stats.localeParam++;
  }
  for (const fn of localeParamFns) {
    for (const site of callSitesOf(fn)) {
      if (site.kind === "call") {
        if (!site.node.arguments.some((a) => ts.isIdentifier(a) && a.text === "locale")) {
          let p;
          if (site.node.arguments.length > 0) p = end(site.node.arguments[site.node.arguments.length - 1]);
          else p = src0.indexOf("(", end(site.node.expression)) + 1;
          edits.push({ start: p, end: p, text: ", locale" });
        }
      } else {
        if (!site.node.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.escapedText === "locale")) {
          edits.push({ start: end(site.node.attributes), end: end(site.node.attributes), text: " locale={locale}" });
        }
      }
    }
  }
  if (localeInjectFns.size > 0 && !/import\s*\{[^}]*getLocale[^}]*\}\s*from\s*"next-intl\/server"/.test(src0)) {
    const off = lastImportEndOffset(src0);
    edits.push({ start: off, end: off, text: 'import { getLocale } from "next-intl/server";\n' });
    stats.importGetLocale++;
  }

  // ---- tr fixpoint（穿透参数 + 组件注入 useTr）----
  const allTrFns = new Set([...trInjectFns, ...trFns]);
  changed = true;
  while (changed) {
    changed = false;
    for (const fn of [...allTrFns]) {
      for (const site of callSitesOf(fn)) {
        const enc = nearestFunction(site.node);
        if (enc && enc !== fn && !scopeNames(site.node).has("tr") && !allTrFns.has(enc)) {
          allTrFns.add(enc);
          if (isComponentLike(enc)) trInjectFns.add(enc); else trFns.add(enc);
          changed = true;
        }
      }
    }
  }
  for (const fn of trFns) {
    const paramText = "tr: (s: string) => string";
    if (fn.parameters.length > 0) {
      const last = fn.parameters[fn.parameters.length - 1];
      edits.push({ start: end(last), end: end(last), text: ", " + paramText });
    } else {
      const nameEnd = fn.name ? end(fn.name) : pos(fn);
      const openParen = src0.indexOf("(", nameEnd);
      edits.push({ start: openParen + 1, end: openParen + 1, text: paramText });
    }
    stats.trParam++;
  }
  for (const fn of trFns) {
    for (const site of callSitesOf(fn)) {
      if (site.kind === "call") {
        if (!site.node.arguments.some((a) => ts.isIdentifier(a) && a.text === "tr")) {
          let p;
          if (site.node.arguments.length > 0) p = end(site.node.arguments[site.node.arguments.length - 1]);
          else p = src0.indexOf("(", end(site.node.expression)) + 1;
          edits.push({ start: p, end: p, text: ", tr" });
        }
      } else {
        if (!site.node.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.escapedText === "tr")) {
          edits.push({ start: end(site.node.attributes), end: end(site.node.attributes), text: " tr={tr}" });
        }
      }
    }
  }
  for (const fn of trInjectFns) {
    const isParam = fn.parameters.some((p) => (ts.isIdentifier(p.name) && p.name.text === "tr") || (ts.isObjectBindingPattern(p.name) && p.name.elements.some((el) => ts.isBindingElement(el) && ts.isIdentifier(el.name) && el.name.text === "tr")));
    if (isParam) continue; // tr 由参数传入，不注入
    removeBodyDecl(fn, "tr", { src0, edits, pos, end });
    if (!fn.body) continue;
    if (ts.isBlock(fn.body)) {
      const brace = pos(fn.body);
      edits.push({ start: brace + 1, end: brace + 1, text: "\n  const tr = useTr();" });
    } else {
      const bodyText = src0.substring(pos(fn.body), end(fn.body));
      edits.push({ start: pos(fn.body), end: end(fn.body), text: "{\n  const tr = useTr();\n  return " + bodyText + ";\n}" });
    }
    stats.trInject++;
  }

  // ---- 模块级 const 转换 ----
  function depParams(info) {
    const p = [];
    if (info.deps.has("tr")) p.push("tr: (s: string) => string");
    if (info.deps.has("locale")) p.push("locale: string");
    return p.join(", ");
  }
  function depArgs(info) {
    const a = [];
    if (info.deps.has("tr")) a.push("tr");
    if (info.deps.has("locale")) a.push("locale");
    return a.join(", ");
  }
  for (const [, info] of moduleConsts) {
    if (!info.vd) continue;
    if (info.isMetadata) {
      const initText = src0.substring(pos(info.vd.initializer), end(info.vd.initializer));
      const stripped = initText
        .replace(/tr\(\s*"([^"]*)"\s*\)/g, '"$1"')
        .replace(/translate\(\s*"([^"]*)"\s*,\s*locale\s*\)/g, '"$1"');
      edits.push({ start: pos(info.vd.initializer), end: end(info.vd.initializer), text: stripped });
      stats.moduleMeta++;
      continue;
    }
    const name = info.name;
    const getFnName = "get" + capitalize(name);
    const initText = src0.substring(pos(info.vd.initializer), end(info.vd.initializer));
    const retType = info.vd.type ? ": " + src0.substring(pos(info.vd.type), end(info.vd.type)) : "";
    let body = initText;
    for (const [other, oi] of moduleConsts) {
      if (other === name || !oi.vd) continue;
      const repl = "get" + capitalize(other) + "(" + depArgs(oi) + ")";
      body = body.replace(new RegExp("\\b" + other + "\\b", "g"), repl);
    }
    const fnText = (info.isExport ? "export " : "") + "function " + getFnName + "(" + depParams(info) + ")" + retType + " {\n  return " + body + ";\n}";
    edits.push({ start: pos(info.vstmt), end: end(info.vstmt), text: fnText });
    stats.moduleConst++;
    for (const r of findReferences(sf, name)) {
      let inAnyInit = false;
      for (const [, o] of moduleConsts) { if (o.vd && pos(r) >= pos(o.vd.initializer) && pos(r) < end(o.vd.initializer)) { inAnyInit = true; break; } }
      const p = r.parent;
      if (inAnyInit) continue;
      if (ts.isVariableDeclaration(p) && p.name === r) continue;
      edits.push({ start: pos(r), end: end(r), text: getFnName + "(" + depArgs(info) + ")" });
    }
  }

  // ---- 导入 / use client ----
  function lastImportEndOffset(s) {
    const lines = s.split("\n");
    let endLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) { let j = i; while (j < lines.length && !/;\s*$/.test(lines[j])) j++; endLine = j; i = j; }
    }
    if (endLine < 0) return 0;
    let off = 0; for (let i = 0; i <= endLine; i++) off += lines[i].length + 1;
    return off;
  }
  if (needTranslateImport && !/import\s*\{[^}]*translate[^}]*\}\s*from\s*"@\/lib\/i18n-runtime"/.test(src0)) {
    const off = lastImportEndOffset(src0);
    edits.push({ start: off, end: off, text: 'import { translate } from "@/lib/i18n-runtime";\n' });
    stats.importTranslate++;
  }
  if (needUseTrImport && !/import\s*\{[^}]*useTr[^}]*\}\s*from\s*"@\/lib\/i18n-tr"/.test(src0)) {
    const off = lastImportEndOffset(src0);
    edits.push({ start: off, end: off, text: 'import { useTr } from "@/lib/i18n-tr";\n' });
    stats.importUseTr++;
  }
  if (needUseClient && !/^\s*"use client"/.test(src0)) {
    edits.push({ start: 0, end: 0, text: '"use client";\n' });
    stats.useClient++;
  }

  if (edits.length === 0) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = src0;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  fs.writeFileSync(file, out);
  console.log("  [已修] " + path.relative(process.cwd(), file) + " (edits=" + edits.length + ")");
}

console.log("\n统计:", JSON.stringify(stats));
