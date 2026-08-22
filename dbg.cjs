const ts = require("typescript");
const fs = require("fs");
const file = process.argv[2] || "src/components/cn/CnVehicleCard.tsx";
const src0 = fs.readFileSync(file, "utf8");
// rely on createSourceFile setParentNodes=true ; do NOT call setParents
const sf = ts.createSourceFile(file, src0, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nearestFunction(node){ let c=node; while(c){ if(ts.isFunctionDeclaration(c)||ts.isFunctionExpression(c)||ts.isArrowFunction(c)||ts.isMethodDeclaration(c)||ts.isConstructorDeclaration(c)||ts.isGetAccessor(c)||ts.isSetAccessor(c)) return c; c=c.parent; } return null; }
function findOne(n, targetLine){
  if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text==="tr") {
    const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
    if (line===targetLine) {
      let c=n; let d=0;
      while(c && d<30){ const fn = nearestFunction(c); if(fn) { console.log("  depth",d,ts.SyntaxKind[c.kind],"-> nearestFn:", fn.name&&fn.name.text||"anon"); break;} c=c.parent; d++; }
      return true;
    }
  }
  return ts.forEachChild(n, (ch)=>findOne(ch, targetLine));
}
console.log("sf.statements[0].parent===sf?", sf.statements[0].parent===sf);
findOne(sf, 62);
findOne(sf, 42);
console.log("done");
