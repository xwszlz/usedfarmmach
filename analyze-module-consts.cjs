// 枚举所有模块级(顶层, 不在任何函数内)使用了 tr(...) 或 translate(...,locale) 的 const 声明，
// 以及它们的引用位置，判断引用是否在函数内(dep 是否可注入)。
const ts = require("typescript");
const fs = require("fs");
const path = require("path");

const rootDirs = ["src/app", "src/components"];
const files = [];
function walkTsx(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const c = path.join(d, e.name);
    if (e.isDirectory()) { if (["node_modules", ".next", ".git"].includes(e.name) || e.name.startsWith(".")) continue; walkTsx(c); }
    else if (e.name.endsWith(".tsx")) files.push(c);
  }
}
for (const r of rootDirs) walkTsx(r);

function setParents(node, parent) { node.parent = parent; ts.forEachChild(node, (c) => setParents(c, parent)); }
function nearestFunction(node) { let c = node; while (c) { if (ts.isFunctionDeclaration(c)||ts.isFunctionExpression(c)||ts.isArrowFunction(c)||ts.isMethodDeclaration(c)||ts.isConstructorDeclaration(c)||ts.isGetAccessor(c)||ts.isSetAccessor(c)) return c; c = c.parent; } return null; }
function scopeNames(node) {
  const names = new Set(); let cur = node;
  while (cur) {
    if (ts.isSourceFile(cur)) {
      ts.forEachChild(cur, (ch) => {
        if (ts.isImportDeclaration(ch) && ch.importClause && ch.importClause.namedBindings) { const nb = ch.importClause.namedBindings; if (ts.isNamedImports(nb)) nb.elements.forEach((e)=>names.add(e.name.text)); else if (ts.isNamespaceImport(nb)) names.add(nb.name.text); }
        if (ts.isVariableStatement(ch)) ch.declarationList.declarations.forEach((d)=>{ if (ts.isIdentifier(d.name)) names.add(d.name.text); });
        if ((ts.isFunctionDeclaration(ch)||ts.isClassDeclaration(ch)) && ch.name) names.add(ch.name.text);
      });
      break;
    }
    if (ts.isFunctionDeclaration(cur)||ts.isFunctionExpression(cur)||ts.isArrowFunction(cur)||ts.isMethodDeclaration(cur)||ts.isConstructorDeclaration(cur)||ts.isGetAccessor(cur)||ts.isSetAccessor(cur)) cur.parameters.forEach((p)=>{ if (p.name && ts.isIdentifier(p.name)) names.add(p.name.text); });
    if (ts.isBlock(cur) || ts.isModuleBlock(cur)) ts.forEachChild(cur, (ch)=>{ if (ts.isVariableStatement(ch)) ch.declarationList.declarations.forEach((d)=>{ if (ts.isIdentifier(d.name)) names.add(d.name.text); }); });
    cur = cur.parent;
  }
  return names;
}

let total = 0;
const byName = {};
for (const file of files) {
  const src0 = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src0, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  setParents(sf, undefined);
  const moduleConsts = []; // {vd, name, isExport, isMetadata}
  function findModuleConst(n) {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      let dep = null;
      if (ts.isIdentifier(callee)) { if (callee.text === "tr") dep = "tr"; else if (callee.text === "translate" && n.arguments.length >= 2 && ts.isIdentifier(n.arguments[1]) && n.arguments[1].text === "locale") dep = "locale"; }
      if (dep) {
        const fn = nearestFunction(n);
        if (!fn) {
          // 模块级：找最近的模块级 const 声明
          let c = n; while (c && !ts.isVariableDeclaration(c) && !ts.isVariableStatement(c)) c = c.parent;
          if (c && (ts.isVariableDeclaration(c) || ts.isVariableStatement(c))) {
            const vd = ts.isVariableDeclaration(c) ? c : c.declarationList.declarations[0];
            if (vd && ts.isIdentifier(vd.name)) {
              const vstmt = vd.parent.parent;
              const isExport = vstmt.modifiers && vstmt.modifiers.some((m)=>m.kind === ts.SyntaxKind.ExportKeyword);
              const name = vd.name.text;
              const key = file + "::" + name;
              if (!byName[key]) byName[key] = { file, name, isExport, isMetadata: name === "metadata", dep: new Set(), refs: [] };
              byName[key].dep.add(dep);
              total++;
            }
          }
        }
      }
    }
    ts.forEachChild(n, findModuleConst);
  }
  findModuleConst(sf);
}
// 统计引用
for (const key of Object.keys(byName)) {
  const info = byName[key];
  const sf = ts.createSourceFile(info.file, fs.readFileSync(info.file,"utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  setParents(sf, undefined);
  function findRefs(n) {
    if (ts.isIdentifier(n) && n.text === info.name) {
      const p = n.parent;
      if (ts.isVariableDeclaration(p) && p.name === n) return;
      if ((ts.isFunctionDeclaration(p)||ts.isClassDeclaration(p)) && p.name === n) return;
      if (ts.isParameter(p) && p.name === n) return;
      const fn = nearestFunction(n);
      if (fn) {
        const hasDep = info.dep.has("tr") ? scopeNames(n).has("tr") : scopeNames(n).has("locale");
        info.refs.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1, inFn: true, depInScope: hasDep });
      } else {
        info.refs.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1, inFn: false, depInScope: false });
      }
    }
    ts.forEachChild(n, findRefs);
  }
  findRefs(sf);
}
console.log("=== 模块级 tr/translate(locale) const 总数:", total, "===");
for (const key of Object.keys(byName).sort()) {
  const info = byName[key];
  const modRefs = info.refs.filter((r)=>!r.inFn);
  const fnNoDep = info.refs.filter((r)=>r.inFn && !r.depInScope);
  console.log(`\n[${info.isMetadata?"METADATA":"const"}] ${path.relative(process.cwd(), info.file)} :: ${info.name}  dep=${[...info.dep].join("+")}  export=${info.isExport}`);
  console.log(`   引用: ${info.refs.length}  (模块级: ${modRefs.length}, 函数内但dep缺: ${fnNoDep.length})`);
  for (const r of info.refs) console.log(`     L${r.line} ${r.inFn ? (r.depInScope ? "fn✓" : "fn✗(缺dep)") : "MODULE"}`);
}
