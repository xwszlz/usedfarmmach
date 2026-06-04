#!/usr/bin/env node
/**
 * 同步Excel库存表和网站产品
 * 在本地开发环境运行（需要DATABASE_URL能连到Neon）
 * 
 * 用法: cd D:/神雕农机/usedfarmmach && node scripts/sync_products.js
 */
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// 必须从usedfarmmach目录运行才能找到@prisma/client
const prisma = new PrismaClient();
const SELLER_ID = 'cmpdjc7xv0000mfv72up1a2y0'; // admin439
const EXCEL_JSON = path.join(__dirname, '..', '..', '神雕日报', 'excel-products.json');

function findBrand(brands, name) {
    if (!name || name === '无' || name === 'nan' || name === '') return null;
    const clean = name.trim();
    let b = brands.find(b => b.nameZh === clean || b.nameEn === clean);
    if (b) return b;
    b = brands.find(b => b.nameZh.includes(clean) || clean.includes(b.nameZh));
    if (b) return b;
    return null; // not found
}

async function ensureBrandExists(brands, name) {
    if (!name || name === '无' || name === 'nan' || name === '') return null;
    let b = findBrand(brands, name);
    if (b) return b;
    // Auto-create missing brand
    const created = await prisma.brand.create({
        data: { nameZh: name.trim(), nameEn: name.trim(), originCountry: '未知' }
    });
    brands.push(created);
    console.log(`  [新建品牌] ${name.trim()}`);
    return created;
}

async function ensureCategoryExists(cats, name) {
    if (!name || name === '无' || name === 'nan' || name === '') return null;
    const clean = name.trim();
    let c = cats.find(c => c.nameZh === clean || c.nameEn === clean);
    if (c) return c;
    c = cats.find(c => c.nameZh.includes(clean) || clean.includes(c.nameZh));
    if (c) return c;
    // Auto-create missing category
    const created = await prisma.category.create({
        data: { nameZh: clean, nameEn: clean }
    });
    cats.push(created);
    console.log(`  [新建品类] ${clean}`);
    return created;
}

function parsePrice(str) {
    if (!str || str === 'nan' || str === '询价' || str === '') return null;
    str = str.replace(/\n/g, '').trim();
    const m = str.match(/^(\d+(?:\.\d+)?)/);
    if (m) {
        const v = parseFloat(m[1]);
        return v < 500 ? Math.round(v * 10000) : Math.round(v);
    }
    return null;
}

async function main() {
    const excelProducts = JSON.parse(fs.readFileSync(EXCEL_JSON, 'utf-8'));
    console.log(`Excel: ${excelProducts.length} products`);

    const [brands, cats, siteProducts] = await Promise.all([
        prisma.brand.findMany(),
        prisma.category.findMany(),
        prisma.product.findMany({ include: { brand: true, category: true } }),
    ]);
    console.log(`DB: ${brands.length} brands, ${cats.length} cats, ${siteProducts.length} products\n`);

    // 1. DELETE products not in Excel
    const excelKeys = new Set();
    for (const e of excelProducts) {
        const key = (e.brand + '|' + e.model).replace(/\s+/g, '');
        excelKeys.add(key);
    }

    let delCount = 0;
    for (const p of siteProducts) {
        const sb = (p.brand?.nameZh || '').replace(/\s+/g, '');
        const sm = (p.modelName || '').replace(/\s+/g, '');
        const key = sb + '|' + sm;

        if (!excelKeys.has(key)) {
            // fuzzy check
            let fuzzy = false;
            for (const e of excelProducts) {
                const eb = e.brand.replace(/\s+/g, '');
                const em = e.model.replace(/\s+/g, '');
                if (eb && sb && (eb.includes(sb) || sb.includes(eb)) && em && sm && (em.includes(sm) || sm.includes(em))) {
                    fuzzy = true; break;
                }
            }
            if (!fuzzy) {
                await prisma.product.delete({ where: { id: p.id } });
                console.log(`DELETE: ${p.brand?.nameZh || '?'} ${p.modelName} (¥${p.priceCny})`);
                delCount++;
            }
        }
    }
    console.log(`\nDeleted: ${delCount}`);

    // 2. ADD products from Excel
    // Build current site keys for dedup
    const currentProducts = await prisma.product.findMany({ include: { brand: true, category: true } });
    const siteKeys = new Set();
    for (const p of currentProducts) {
        const b = (p.brand?.nameZh || p.brand?.nameEn || '').replace(/\s+/g, '');
        const m = (p.modelName || '').replace(/\s+/g, '');
        siteKeys.add(b + '|' + m);
    }

    let addCount = 0, skipCount = 0;

    // 确保"其他"品牌存在
    let fallbackBrand = findBrand(brands, '其他');
    if (!fallbackBrand) {
        fallbackBrand = await prisma.brand.create({ data: { nameZh: '其他', nameEn: 'Other', originCountry: '未知' } });
        brands.push(fallbackBrand);
    }

    for (const e of excelProducts) {
        const eb = e.brand.replace(/\s+/g, '');
        let em = e.model.replace(/\s+/g, '');

        // 型号为"无"时，用品类+描述前8个字代替
        if (!em || em === '无' || em === 'nan') {
            em = (e.cat || '农机') + (e.desc ? e.desc.replace(/\s+/g, '').slice(0, 8) : '');
        }
        if (!em) em = e.cat || '农机';

        const key = eb + '|' + em;
        if (siteKeys.has(key)) { skipCount++; continue; }

        // fuzzy check
        let fuzzy = false;
        for (const sk of siteKeys) {
            const [sb, sm] = sk.split('|');
            if (eb && sb && (eb.includes(sb) || sb.includes(eb)) && em && sm && (em.includes(sm) || sm.includes(em))) {
                fuzzy = true; break;
            }
        }
        if (fuzzy) { skipCount++; continue; }

        // 价格为"询价"或空时设为0
        const price = parsePrice(e.price) || 0;

        // 品牌为"无"时使用"其他"
        const brand = await ensureBrandExists(brands, e.brand && e.brand !== '无' && e.brand !== 'nan' ? e.brand : '其他');
        if (!brand) { skipCount++; continue; }

        const cat = await ensureCategoryExists(cats, e.cat);

        try {
            await prisma.product.create({
                data: {
                    sellerId: SELLER_ID,
                    brandId: brand.id,
                    categoryId: cat?.id || brand.id,
                    modelName: e.model,
                    year: e.year || 2020,
                    condition: 'good',
                    priceCny: price,
                    priceUsd: Math.round(price / 7.25),
                    location: '河北',
                    descriptionZh: e.desc || null,
                    status: 'active',
                }
            });
            console.log(`  ADD: [${e.cat}] ${e.brand} ${e.model} | ¥${(price/10000).toFixed(1)}万`);
            addCount++;
        } catch (err) {
            console.log(`  ERR: ${e.brand} ${e.model} - ${err.message?.slice(0,80)}`);
            skipCount++;
        }
    }

    const total = await prisma.product.count({ where: { status: 'active' } });
    console.log(`\n=== 完成 ===`);
    console.log(`新增: ${addCount}, 跳过: ${skipCount}, 删除: ${delCount}`);
    console.log(`在线产品总数: ${total}`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
