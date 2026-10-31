/**
 * `src/lib/product/recognize-apply.ts` 单测
 *
 * 覆盖 7 条核心约定，其中第 6 条（priceCny 永不出现在回填请求体）是资金级安全
 * 不变量，必须永远绿；这条用例曾被刻意写红过一次以证明它真的能拦住回归：
 *   把 buildApplyPayload 改成 `payload.priceCny = recognized.referencePrice` 后，
 *   该用例立即失败（见提交说明）。
 */
import { describe, it, expect } from "vitest";
import {
  buildFieldDiff,
  buildApplyPayload,
  formatFieldValue,
  type ApplyableFieldKey,
  type CurrentProduct,
  type RecognizedData,
} from "../recognize-apply";

/** 造一份「真实」的 GET /api/seller/products/[id] data 子集（品牌/品类是嵌套对象）。 */
function makeCurrentProduct(overrides: Partial<CurrentProduct> = {}): CurrentProduct {
  return {
    brand: { nameZh: "约翰迪尔", nameEn: "John Deere" },
    category: { nameZh: "拖拉机", nameEn: "Tractor" },
    modelName: "6J-2104",
    year: 2021,
    engineType: "柴油",
    enginePower: 210,
    driveSystem: "四驱",
    mainConfig: "空调驾驶室",
    overallLength: 5.35,
    overallWidth: 2.4,
    overallHeight: 3.1,
    netWeight: 8200,
    workingHours: 1800,
    condition: "good",
    country: "中国",
    province: "山东省",
    city: "潍坊市",
    location: "中国 山东省 潍坊市",
    ...overrides,
  };
}

/** 造一份 recognize 返回的 data。 */
function makeRecognized(overrides: Partial<RecognizedData> = {}): RecognizedData {
  return {
    brand: "约翰迪尔",
    modelName: "6J-2104",
    year: 2021,
    engineType: "柴油",
    enginePower: 210,
    driveSystem: "四驱",
    mainConfig: "空调驾驶室",
    overallLength: 5.35,
    overallWidth: 2.4,
    overallHeight: 3.1,
    netWeight: 8200,
    workingHours: 1800,
    condition: "good",
    category: "拖拉机",
    country: "中国",
    province: "山东省",
    city: "潍坊市",
    location: "中国 山东省 潍坊市",
    referencePrice: 380000,
    confidence: 0.87,
    isChineseBrand: false,
    ...overrides,
  };
}

const ALL_KEYS: ApplyableFieldKey[] = [
  "brandName",
  "modelName",
  "year",
  "engineType",
  "enginePower",
  "driveSystem",
  "mainConfig",
  "overallLength",
  "overallWidth",
  "overallHeight",
  "netWeight",
  "workingHours",
  "condition",
  "category",
  "country",
  "province",
  "city",
  "location",
];

describe("buildFieldDiff", () => {
  it("识别值为 null / 空串 / 纯空白的字段不出现在结果里", () => {
    const recognized = makeRecognized({
      modelName: null,
      year: undefined,
      engineType: "",
      driveSystem: "   ",
      mainConfig: null,
      overallLength: null,
      overallWidth: null,
      overallHeight: null,
      netWeight: null,
      workingHours: null,
      condition: null,
      category: null,
      country: null,
      province: null,
      city: null,
      location: null,
    });

    const diffs = buildFieldDiff(makeCurrentProduct(), recognized);
    const keys = diffs.map((diff) => diff.key);

    expect(keys).not.toContain("modelName");
    expect(keys).not.toContain("year");
    expect(keys).not.toContain("engineType");
    expect(keys).not.toContain("driveSystem");
    expect(keys).not.toContain("mainConfig");
    expect(keys).not.toContain("overallLength");
    expect(keys).not.toContain("condition");
    expect(keys).not.toContain("category");
    expect(keys).not.toContain("location");
    // 只剩 brand + enginePower 两个有值的字段
    expect(keys.sort()).toEqual(["brandName", "enginePower"]);
  });

  it("数字归一化：字符串 \"3.2\" 与数字 3.2 判为未变（含 \"3.20\" 写法）", () => {
    const current = makeCurrentProduct({ overallLength: "3.2" });
    const recognized = makeRecognized({ overallLength: 3.2 });
    const diff = buildFieldDiff(current, recognized).find((d) => d.key === "overallLength");
    expect(diff).toBeDefined();
    expect(diff!.changed).toBe(false);

    // 同一字段的两种字符串写法也必须归一
    const diff2 = buildFieldDiff(
      makeCurrentProduct({ overallLength: 3.2 }),
      makeRecognized({ overallLength: "3.20" })
    ).find((d) => d.key === "overallLength");
    expect(diff2).toBeDefined();
    expect(diff2!.changed).toBe(false);
  });

  it("字符串归一化：\" CLAAS \" 与 \"claas\" 判为未变（trim + 忽略大小写 + 全角半角）", () => {
    const diff = buildFieldDiff(
      makeCurrentProduct({ brand: { nameZh: " CLAAS " } }),
      makeRecognized({ brand: "claas" })
    ).find((d) => d.key === "brandName");

    expect(diff).toBeDefined();
    expect(diff!.changed).toBe(false);
    expect(diff!.current).toBe("CLAAS");
    expect(diff!.recognized).toBe("claas");

    // 全角半角也应归一（ＮＦＫＣ）
    const diffFullWidth = buildFieldDiff(
      makeCurrentProduct({ modelName: "ＣＬＡＡＳ ＡＲＩＯＮ ４５０" }),
      makeRecognized({ modelName: "claas arion 450" })
    ).find((d) => d.key === "modelName");
    expect(diffFullWidth).toBeDefined();
    expect(diffFullWidth!.changed).toBe(false);
  });

  it("真变化时 changed: true，且 current / recognized 都是可读字符串", () => {
    const current = makeCurrentProduct({ year: 2019, enginePower: 180 });
    const diffs = buildFieldDiff(current, makeRecognized({ year: 2021, enginePower: 210 }));

    const yearDiff = diffs.find((d) => d.key === "year");
    expect(yearDiff).toBeDefined();
    expect(yearDiff!.changed).toBe(true);
    expect(yearDiff!.current).toBe("2019");
    expect(yearDiff!.recognized).toBe("2021");
    expect(typeof yearDiff!.current).toBe("string");
    expect(typeof yearDiff!.recognized).toBe("string");
    expect(yearDiff!.labelZh).toBe("年份");
    expect(yearDiff!.labelEn).toBe("Year");

    const powerDiff = diffs.find((d) => d.key === "enginePower");
    expect(powerDiff!.changed).toBe(true);
    expect(powerDiff!.current).toBe("180");
    expect(powerDiff!.recognized).toBe("210");
  });

  it("现值缺失（null）时 changed: true，current 为 null（UI 渲染 ——）", () => {
    const diffs = buildFieldDiff(
      makeCurrentProduct({ netWeight: null }),
      makeRecognized({ netWeight: 8200 })
    );
    const diff = diffs.find((d) => d.key === "netWeight");
    expect(diff).toBeDefined();
    expect(diff!.changed).toBe(true);
    expect(diff!.current).toBeNull();
    expect(diff!.recognized).toBe("8200");
  });

  it("location 是组合字段：country/province/city 三者都没变 → changed: false", () => {
    // 拼接串格式不同（多空格 / 顺序写法不同），但结构化三元组完全一致
    const diffs = buildFieldDiff(
      makeCurrentProduct({ location: "中国 山东省 潍坊市" }),
      makeRecognized({ location: "中国,山东省,潍坊市" })
    );
    const diff = diffs.find((d) => d.key === "location");
    expect(diff).toBeDefined();
    expect(diff!.changed).toBe(false);
  });

  it("location 组合字段：city 变了 → changed: true", () => {
    const diffs = buildFieldDiff(
      makeCurrentProduct({ city: "潍坊市" }),
      makeRecognized({ city: "济南市", location: "中国 山东省 济南市" })
    );
    const diff = diffs.find((d) => d.key === "location");
    expect(diff).toBeDefined();
    expect(diff!.changed).toBe(true);
  });

  it("current 为 null（无权限/未拉取）时不抛错，所有字段按 changed: true 处理", () => {
    const diffs = buildFieldDiff(null, makeRecognized());
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.every((d) => d.current === null)).toBe(true);
  });

  it("完全一致时返回的 diff 全部 changed: false（UI 显示「无需回填」）", () => {
    const diffs = buildFieldDiff(makeCurrentProduct(), makeRecognized());
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.filter((d) => d.changed)).toEqual([]);
  });

  it("品牌从嵌套 brand.nameZh 读取；扁平 brandName 别名优先", () => {
    const fromNested = buildFieldDiff(
      { brand: { nameZh: "克拉斯", nameEn: "CLAAS" } },
      makeRecognized({ brand: "克拉斯" })
    ).find((d) => d.key === "brandName");
    expect(fromNested!.current).toBe("克拉斯");
    expect(fromNested!.changed).toBe(false);

    const fromFlat = buildFieldDiff(
      { brand: { nameZh: "克拉斯" }, brandName: "CLAAS" },
      makeRecognized({ brand: "claas" })
    ).find((d) => d.key === "brandName");
    expect(fromFlat!.current).toBe("CLAAS");
    expect(fromFlat!.changed).toBe(false);
  });
});

describe("buildApplyPayload", () => {
  it("只包含勾选的 key（未勾选的字段一律不出现）", () => {
    const payload = buildApplyPayload(makeRecognized(), ["year", "enginePower"]);
    expect(Object.keys(payload).sort()).toEqual(["enginePower", "year"]);
    expect(payload.year).toBe(2021);
    expect(payload.enginePower).toBe(210);
  });

  it("🔴 永远不含 priceCny —— 即使 recognized.referencePrice 有值、selectedKeys 混入任意 key", () => {
    // 1) referencePrice 有值（380000），勾选全部合法 key
    const recognized = makeRecognized({ referencePrice: 380000 });
    const fullPayload = buildApplyPayload(recognized, ALL_KEYS);
    expect(fullPayload).not.toHaveProperty("priceCny");

    // 2) 故意把 priceCny / referencePrice 当成 key 混进来（模拟上游脏数据或未来重构失误）
    const dirtyKeys = [
      ...ALL_KEYS,
      "priceCny",
      "referencePrice",
      "confidence",
      "isChineseBrand",
      "tradePort",
      "brandId",
      "categoryId",
    ] as ApplyableFieldKey[];
    const dirtyPayload = buildApplyPayload(recognized, dirtyKeys);
    expect(dirtyPayload).not.toHaveProperty("priceCny");
    expect(dirtyPayload).not.toHaveProperty("referencePrice");
    expect(dirtyPayload).not.toHaveProperty("confidence");
    expect(dirtyPayload).not.toHaveProperty("isChineseBrand");
    expect(dirtyPayload).not.toHaveProperty("tradePort");
    expect(dirtyPayload).not.toHaveProperty("brandId");
    expect(dirtyPayload).not.toHaveProperty("categoryId");

    // 3) 一个极端场景：只有 priceCny 一个 key，且参考价存在 → 必须是空对象
    //    （故意绕过类型系统，模拟运行时收到脏 key）
    const onlyPrice = buildApplyPayload({ referencePrice: 888888 } as RecognizedData, [
      "priceCny",
    ] as unknown as ApplyableFieldKey[]);
    expect(onlyPrice).toEqual({});

    // 4) 对「所有可能被误当成价格的数字」再扫一遍：payload 里任何值都不得等于参考价
    const numericValues = Object.values(fullPayload).filter(
      (value) => typeof value === "number"
    );
    expect(numericValues).not.toContain(380000);
  });

  it("识别值为 null / 空串的字段不被写入（不传 key，避免清空已有值）", () => {
    const recognized = makeRecognized({
      modelName: null,
      engineType: "",
      overallLength: null,
      condition: null,
      location: null,
    });
    const payload = buildApplyPayload(recognized, [
      "modelName",
      "engineType",
      "overallLength",
      "condition",
      "location",
      "year",
    ]);

    expect(payload).not.toHaveProperty("modelName");
    expect(payload).not.toHaveProperty("engineType");
    expect(payload).not.toHaveProperty("overallLength");
    expect(payload).not.toHaveProperty("condition");
    expect(payload).not.toHaveProperty("location");
    // 只有有值的 year 被写入
    expect(Object.keys(payload)).toEqual(["year"]);
  });

  /**
   * 「零」与「空」的边界 —— 成对存在，缺一不可。
   *
   * 背景：`PUT /api/seller/products/[id]` 原本是 `workingHours ? Number(workingHours) : null`，
   * 数字 0 会被写成 null（字符串 "0" 反倒能写对）。虽然该 route 已另开分支修，
   * 但「视觉识别 → 回填」这条链路的**前端侧**也必须钉死：
   * `workingHours = 0` 是合法业务值（全新机 / 试机机），绝不能被当成空值丢掉；
   * 而 null / "" 才是「AI 没识别出来」，必须不传（PUT 是传了才覆盖，传 null 会清空卖家已有值）。
   *
   * 这两条同时锁住 `normalizeScalar` 的实现假设：它用 `typeof === "number"` 分支，
   * 一旦有人改成 `if (!value) return null` 这类 falsy 判断，第一条会立刻变红。
   */
  it("workingHours 识别为 0（全新机 / 试机机）⇒ payload 里是数字 0，不能被当作空值丢弃", () => {
    const payload = buildApplyPayload({ workingHours: 0 }, ["workingHours"]);

    // 必须在，且必须是数字 0（不是 "0"、不是 null、不是被丢弃）
    expect(payload).toHaveProperty("workingHours");
    expect(payload.workingHours).toBe(0);
    expect(typeof payload.workingHours).toBe("number");
    expect(Number.isNaN(payload.workingHours as number)).toBe(false);

    // 数值 0 与字符串 "0" 必须产出同一结果（Number("0") === 0）
    expect(buildApplyPayload({ workingHours: "0" }, ["workingHours"])).toEqual({
      workingHours: 0,
    });
  });

  it("workingHours 为 null / 空串 / 缺省 ⇒ payload 不含该键（空值不覆盖卖家已有值）", () => {
    expect(buildApplyPayload({ workingHours: null }, ["workingHours"])).not.toHaveProperty(
      "workingHours"
    );
    expect(buildApplyPayload({ workingHours: "" }, ["workingHours"])).not.toHaveProperty(
      "workingHours"
    );
    expect(buildApplyPayload({}, ["workingHours"])).not.toHaveProperty("workingHours");
    expect(
      buildApplyPayload({ workingHours: "   " }, ["workingHours"])
    ).not.toHaveProperty("workingHours");

    // 对照组：0 → 有键，null → 无键。两者放在一起才把边界钉死。
    expect(buildApplyPayload({ workingHours: 0 }, ["workingHours"])).toHaveProperty(
      "workingHours"
    );
  });

  it("数值字段转 number（含字符串输入）；非数值字段保持字符串并去空白", () => {
    const payload = buildApplyPayload(
      makeRecognized({
        year: "2021",
        overallLength: "5.35",
        workingHours: "1800",
        netWeight: 8200,
        brand: "  约翰迪尔  ",
        condition: "good",
      }),
      ["year", "overallLength", "workingHours", "netWeight", "brandName", "condition"]
    );

    expect(payload.year).toBe(2021);
    expect(typeof payload.year).toBe("number");
    expect(payload.overallLength).toBe(5.35);
    expect(payload.workingHours).toBe(1800);
    expect(payload.netWeight).toBe(8200);
    expect(payload.brandName).toBe("约翰迪尔");
    expect(payload.condition).toBe("good");
  });

  it("brand 映射到 brandName、category 映射到 category 字符串（PUT 白名单口径）", () => {
    const payload = buildApplyPayload(makeRecognized(), ["brandName", "category"]);
    expect(payload.brandName).toBe("约翰迪尔");
    expect(payload.category).toBe("拖拉机");
    expect(payload).not.toHaveProperty("brand");
  });

  it("空 selectedKeys / 非数组入参 → 空对象，不抛错", () => {
    expect(buildApplyPayload(makeRecognized(), [])).toEqual({});
    expect(
      buildApplyPayload(makeRecognized(), undefined as unknown as ApplyableFieldKey[])
    ).toEqual({});
    expect(buildApplyPayload(null as unknown as RecognizedData, ALL_KEYS)).toEqual({});
  });
});

describe("formatFieldValue", () => {
  it("空值显示 ——，不显示 null", () => {
    expect(formatFieldValue("modelName", null, "zh")).toBe("—");
    expect(formatFieldValue("modelName", "", "en")).toBe("—");
  });

  it("成色枚举本地化", () => {
    expect(formatFieldValue("condition", "good", "zh")).toBe("良好/正常使用");
    expect(formatFieldValue("condition", "excellent", "en")).toBe("Excellent");
    // 未知枚举原样返回，不吞数据
    expect(formatFieldValue("condition", "unknown_value", "zh")).toBe("unknown_value");
  });

  it("数值字段去掉多余小数零", () => {
    expect(formatFieldValue("overallLength", "3.20", "zh")).toBe("3.2");
    expect(formatFieldValue("year", "2021", "zh")).toBe("2021");
  });
});
