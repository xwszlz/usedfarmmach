/**
 * 白名单单元测试：断言 PII / 精确坐标绝不出境，公开字段被保留。
 *
 * 运行：npm run test:cn-sync
 *       （等价：npx tsx src/lib/cn-sync/__tests__/field-whitelist.test.ts）
 * （仓库未引入 vitest / jest，故用零依赖的 node:assert 断言脚本，退出码非 0 即失败）
 */
import assert from "node:assert/strict";
import {
  PRODUCT_ALLOW,
  FORBIDDEN_FIELDS,
  pickProductWhitelist,
  isForbiddenField,
} from "../field-whitelist";

let passed = 0;
const failures: string[] = [];

function it(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  \u2717 ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 构造一条「含全部敏感字段」的假产品（模拟 Prisma include 后的行） */
function buildFakeProduct(): Record<string, unknown> {
  return {
    // —— 公开字段（应保留）——
    id: "clfake0000000000000000001",
    modelName: "Jaguar 970",
    year: 2020,
    condition: "used",
    priceCny: 580000,
    priceUsd: 80000,
    location: "河北 石家庄",
    province: "河北",
    city: "石家庄",
    country: "CN",
    descriptionZh: "9成新，工作正常",
    priceMode: "por",
    tradeTerm: "FOB",
    tradePort: "天津港",
    enginePower: 626,
    engineType: "diesel",
    driveSystem: "4WD",
    mainConfig: "豪华配置",
    netWeight: 12000,
    overallLength: 9.2,
    overallWidth: 3.0,
    overallHeight: 3.8,
    status: "active",
    aiGenerated: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    // —— 硬禁字段（必须被丢弃）——
    latitude: 38.0428,
    longitude: 114.5149,
    sellerId: "cluser0000000000000000001",
    contactName: "张三",
    contactPhone: "13800000000",
    contactWechat: "zhangsan",
    contactEmail: "zhangsan@example.com",
    // —— User 行字段（纵深防御，必须被丢弃）——
    email: "miniprogram@shendiao.com",
    phone: "13800000000",
    passwordHash: "$2b$10$xxxxfakehash",
    wxOpenid: "oXxxxxOpenid",
    miniOpenid: "oMiniOpenid",
    // —— 关联（部分字段不在白名单，应被丢弃）——
    brand: {
      nameZh: "克拉斯",
      nameEn: "CLAAS",
      originCountry: "DE",
      isImported: true,
      id: "clbrand000000000000000001",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    },
    category: {
      nameZh: "青贮收获机",
      nameEn: "Forage Harvester",
      id: "clcat0000000000000000001",
      viewCount: 10,
    },
    images: [
      {
        url: "https://oss.example.com/a.jpg",
        sortOrder: 0,
        isPrimary: true,
        id: "img1",
        angleLabel: "front",
      },
    ],
    videos: [
      {
        url: "https://oss.example.com/v.mp4",
        sortOrder: 0,
        title: "作业视频",
        duration: 30,
        moderationStatus: "approved",
        fileSize: 123456,
        id: "vid1",
      },
    ],
  };
}

const FORBIDDEN_SAMPLE = [
  "latitude",
  "longitude",
  "sellerId",
  "contactName",
  "contactPhone",
  "contactWechat",
  "contactEmail",
  "email",
  "phone",
  "passwordHash",
  "wxOpenid",
  "miniOpenid",
];

console.log("field-whitelist 单元测试");

it("FORBIDDEN_FIELDS 含坐标/sellerId/contact*/User 字段，且 isForbiddenField 判定一致", () => {
  for (const f of FORBIDDEN_SAMPLE) {
    assert.ok(
      (FORBIDDEN_FIELDS as readonly string[]).includes(f),
      `${f} 应在 FORBIDDEN_FIELDS 中`
    );
    assert.equal(isForbiddenField(f), true, `isForbiddenField(${f}) 应为 true`);
  }
  // 公开字段不应被误判为禁字段
  for (const f of ["location", "status", "modelName", "branch"]) {
    assert.equal(isForbiddenField(f), false, `isForbiddenField(${f}) 应为 false`);
  }
});

it("默认拒绝：坐标 / sellerId / contact* / User 字段均不出现在输出（含深层扫描）", () => {
  const out = pickProductWhitelist(buildFakeProduct());
  for (const f of FORBIDDEN_SAMPLE) {
    assert.ok(!(f in out), `输出顶层不应包含禁字段 ${f}`);
  }
  // 序列化后深扫描，确保嵌套对象/数组亦无禁字段 key
  const json = JSON.stringify(out);
  for (const f of FORBIDDEN_SAMPLE) {
    assert.ok(!json.includes(`"${f}"`), `序列化输出不应包含禁字段 key ${f}`);
  }
});

it("公开字段被保留（Product 标量）", () => {
  const out = pickProductWhitelist(buildFakeProduct()) as Record<string, unknown>;
  assert.equal(out.id, "clfake0000000000000000001");
  assert.equal(out.modelName, "Jaguar 970");
  assert.equal(out.year, 2020);
  assert.equal(out.condition, "used");
  assert.equal(out.priceCny, 580000);
  assert.equal(out.priceUsd, 80000);
  assert.equal(out.location, "河北 石家庄");
  assert.equal(out.descriptionZh, "9成新，工作正常");
  assert.equal(out.status, "active");
  // 坐标确认缺失（显式断言）
  assert.equal("latitude" in out, false);
  assert.equal("longitude" in out, false);
});

it("Brand / Category 仅保留白名单字段", () => {
  const out = pickProductWhitelist(buildFakeProduct()) as Record<string, unknown>;
  assert.deepEqual(out.brand, {
    nameZh: "克拉斯",
    nameEn: "CLAAS",
    originCountry: "DE",
    isImported: true,
  });
  assert.deepEqual(out.category, { nameZh: "青贮收获机", nameEn: "Forage Harvester" });
});

it("ProductImage / ProductVideo 仅保留白名单字段", () => {
  const out = pickProductWhitelist(buildFakeProduct()) as Record<string, unknown>;
  assert.deepEqual(out.images, [
    { url: "https://oss.example.com/a.jpg", sortOrder: 0, isPrimary: true },
  ]);
  assert.deepEqual(out.videos, [
    {
      url: "https://oss.example.com/v.mp4",
      sortOrder: 0,
      title: "作业视频",
      duration: 30,
      moderationStatus: "approved",
    },
  ]);
});

it("输出 top-level key 集合 = PRODUCT_ALLOW + brand/category/images/videos（无多余字段）", () => {
  const out = pickProductWhitelist(buildFakeProduct()) as Record<string, unknown>;
  const expected = new Set<string>([...PRODUCT_ALLOW, "brand", "category", "images", "videos"]);
  const actual = new Set<string>(Object.keys(out));
  assert.equal(actual.size, expected.size, `key 数量应为 ${expected.size}，实际 ${actual.size}`);
  for (const k of expected) assert.ok(actual.has(k), `输出应包含白名单 key ${k}`);
  for (const k of actual) assert.ok(expected.has(k), `输出不应包含非白名单 key ${k}`);
});

it("空值输入返回空对象（健壮性）", () => {
  assert.deepEqual(pickProductWhitelist(null), {});
  assert.deepEqual(pickProductWhitelist(undefined), {});
});

console.log(`\n结果：${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(`失败用例：\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
