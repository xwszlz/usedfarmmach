-- 克拉斯 Jaguar 970 欧版(2017) 产品图片迁移SQL
-- 部署到 Vercel 后，需要在 Neon 生产数据库执行此脚本
-- 或在本地通过 prisma db push 同步

DELETE FROM "ProductImage" WHERE "productId" = 'cmpfohy08000tkrh5vaaw12nd';

INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_00', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836344849.jpg', 0, true);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_01', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836298241.jpg', 1, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_02', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836299784.jpg', 2, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_03', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836305274.jpg', 3, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_04', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836307132.jpg', 4, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_05', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836309168.jpg', 5, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_06', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836314008.jpg', 6, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_07', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836316083.jpg', 7, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_08', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836317827.jpg', 8, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_09', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836319792.jpg', 9, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_10', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836326121.jpg', 10, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_11', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836331287.jpg', 11, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_12', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836333953.jpg', 12, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_13', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836336564.jpg', 13, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_14', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836338659.jpg', 14, false);
INSERT INTO "ProductImage" ("id", "productId", "url", "sortOrder", "isPrimary") VALUES ('img_970_15', 'cmpfohy08000tkrh5vaaw12nd', '/images/products/cmpfohy08000tkrh5vaaw12nd/mmexport1774836347265.jpg', 15, false);
