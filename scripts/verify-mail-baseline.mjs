/**
 * D6 验收闸门：企业邮箱 P1「Resend 归零 + 字典/8 语无损 + tsc 基线不新增」
 *
 * 用法：node scripts/verify-mail-baseline.mjs
 * 位置：scripts/ 被 .gitignore 忽略，本文件需 `git add -f` 入库。
 *
 * 五项断言：
 *   1. .cn 专属配置（.env.cn.example / deploy/**cn*）中 Resend 代码级硬编码零命中；
 *   2. .cn 构建产物（.next，若存在）中 api.resend.com 零命中；
 *   3. messages/*.json 8 语 JSON.parse 成功且逐文件 EOL 与基线一致；
 *   4. src/lib/i18n-dictionary.ts sha256 与基线一致（字典零改动）；
 *   5. tsc 错误数不超过既存基线 77（stale .prisma/client，不得新增）。
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 基线取自 main tip 0dd8f52 实测（2026-11-16） */
const BASELINE = {
  dictSha256: "b01455726a50398a415b8f0bebcab21b58ce91749e733b3cbb549f7bb0941deb",
  messageEol: {
    "ar.json": { crlf: 1158, lf: 0 },
    "en.json": { crlf: 2230, lf: 0 },
    "es.json": { crlf: 1158, lf: 0 },
    "fr.json": { crlf: 1158, lf: 0 },
    "hi.json": { crlf: 1158, lf: 0 },
    "pt.json": { crlf: 1158, lf: 0 },
    "ru.json": { crlf: 1158, lf: 0 },
    "zh.json": { crlf: 2232, lf: 0 },
  },
  tscMaxErrors: 77,
};

/** Resend 代码级硬编码：端点 / 环境变量读取 / SDK 构造（描述性中文注释不算） */
const RESEND_CODE_PATTERN = /api\.resend\.com|RESEND_API_KEY|RESEND_FROM_EMAIL|new\s+Resend\s*\(/i;
/** 构建产物端点硬编码 */
const RESEND_ENDPOINT_PATTERN = /api\.resend\.com/i;

let failures = 0;
function report(name, ok, detail) {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function countEol(text) {
  return {
    crlf: (text.match(/\r\n/g) || []).length,
    lf: (text.match(/(?<!\r)\n/g) || []).length,
  };
}

/** 递归收集文本类文件（跳过 node_modules / 二进制 / 超大文件） */
function collectTextFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "cache") continue;
      collectTextFiles(full, out);
    } else if (/\.(js|mjs|cjs|json|html|txt|map|css)$/i.test(entry) && stat.size < 12 * 1024 * 1024) {
      out.push(full);
    }
  }
  return out;
}

// ── 断言 1：.cn 专属配置 Resend 代码级硬编码零命中 ──
{
  const targets = [join(ROOT, ".env.cn.example")];
  const deployDir = join(ROOT, "deploy");
  if (existsSync(deployDir)) {
    for (const entry of readdirSync(deployDir)) {
      if (/cn/i.test(entry)) targets.push(join(deployDir, entry));
    }
  }
  const hits = [];
  for (const file of targets) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (RESEND_CODE_PATTERN.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  report("1. .cn 专属配置 Resend 代码级硬编码零命中", hits.length === 0, hits.join(", ") || "0 命中");
}

// ── 断言 2：.cn 构建产物 api.resend.com 零命中（未构建则跳过） ──
{
  const nextDir = join(ROOT, ".next");
  if (!existsSync(nextDir)) {
    // eslint-disable-next-line no-console
    console.log("[SKIP] 2. .cn 构建产物 api.resend.com 零命中 — .next 不存在（先跑 SITE=cn npm run build）");
  } else {
    const hits = [];
    for (const file of collectTextFiles(nextDir)) {
      const text = readFileSync(file, "utf8");
      if (RESEND_ENDPOINT_PATTERN.test(text)) hits.push(file.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
    }
    report("2. .cn 构建产物 api.resend.com 零命中", hits.length === 0, hits.join(", ") || "0 命中");
  }
}

// ── 断言 3：8 语 JSON.parse + EOL 基线 ──
{
  const messagesDir = join(ROOT, "messages");
  const problems = [];
  for (const [file, baseline] of Object.entries(BASELINE.messageEol)) {
    const full = join(messagesDir, file);
    if (!existsSync(full)) {
      problems.push(`${file} 缺失`);
      continue;
    }
    const text = readFileSync(full, "utf8");
    try {
      JSON.parse(text);
    } catch (err) {
      problems.push(`${file} JSON.parse 失败: ${err.message}`);
    }
    const eol = countEol(text);
    if (eol.crlf !== baseline.crlf || eol.lf !== baseline.lf) {
      problems.push(`${file} EOL 漂移: ${eol.crlf}/${eol.lf} != ${baseline.crlf}/${baseline.lf}`);
    }
  }
  report("3. messages 8 语 parse + EOL 与基线一致", problems.length === 0, problems.join("; ") || "8/8 通过");
}

// ── 断言 4：i18n-dictionary.ts sha256 与基线一致 ──
{
  const dictPath = join(ROOT, "src/lib/i18n-dictionary.ts");
  const actual = createHash("sha256").update(readFileSync(dictPath)).digest("hex");
  report(
    "4. i18n-dictionary.ts sha256 与基线一致",
    actual === BASELINE.dictSha256,
    `${actual}${actual === BASELINE.dictSha256 ? "" : ` != ${BASELINE.dictSha256}`}`
  );
}

// ── 断言 5：tsc 错误数不超过基线 77 ──
{
  let output = "";
  try {
    // 强制全量检查：tsconfig 开启 incremental，缓存会让二次运行假绿（报 0 错）
    output = execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false", "--incremental", "false"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 24 * 1024 * 1024,
    });
  } catch (err) {
    output = `${err.stdout || ""}\n${err.stderr || ""}`;
  }
  const count = (output.match(/error TS\d+/g) || []).length;
  report(
    "5. tsc 错误数不超过既存基线 77",
    count <= BASELINE.tscMaxErrors,
    `${count} 错（基线 ${BASELINE.tscMaxErrors}）`
  );
}

// eslint-disable-next-line no-console
console.log(failures === 0 ? "\n=== BASELINE GREEN ===" : `\n=== BASELINE FAILED (${failures}) ===`);
process.exit(failures === 0 ? 0 : 1);
