const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// 根据截图确认要删除的「无图重复」产品ID
// 规则：有真实图片的保留，无图的删除
const toDelete = [
  { id: 'cmq4prhsw000hoxhrc6osd1k1', reason: '格里莫胡萝卜机 ¥0 中国 — 重复，格立莫1000有图' },
  { id: 'cmq4priiz001hoxhrfyqyljeg', reason: '都麦直收割台 ¥0 中国 — 重复，都麦6200有图' },
  { id: 'cmq4prind001hoxhriw4oehnb', reason: '盈嘉圆捆打捆机 ¥0 中国 — 重复，9YG-1.25有图' },
  { id: 'cmq4prjbc001hoxhrqtnkrvle', reason: '格兰挪威条播机2020 ¥0 中国 — 重复，2017版本有图' },
  { id: 'cmq4prjvi002hoxhryuiqg26i', reason: '约翰迪尔迪尔拖拉机 ¥0 中国 — 无图占位符重复' },
  { id: 'cmq4prjzt002hoxhrzq6bq7h5', reason: '马赛甜菜收获机 ¥0 中国 — 无图孤立条目' },
  { id: 'cmq4prkux003hoxhsabmdxchk', reason: '常发无茎穗双收 ¥0 中国 — 重复，常发无有图¥136000' },
  { id: 'cmq4prjdh001hoxhrqfyrq6mz', reason: '曼尼通叉车 ¥0 中国 — 重复，MLT-X735有图' },
];

async function main() {
  console.log('=== 开始删除无图重复产品 ===\n');
  
  let deleted = 0;
  let notFound = 0;

  for (const item of toDelete) {
    try {
      // 先查一下确认存在
      const prod = await p.product.findUnique({
        where: { id: item.id },
        include: { brand: true, images: true, videos: true }
      });

      if (!prod) {
        // ID不完整，尝试前缀匹配
        console.log(`⚠️  ID不存在: ${item.id.substring(0, 12)} — 跳过`);
        notFound++;
        continue;
      }

      console.log(`🔍 找到: ${prod.brand?.nameZh || '??'} ${prod.modelName} (${prod.year}) 图:${prod.images.length} 视频:${prod.videos.length}`);
      console.log(`   原因: ${item.reason}`);

      if (prod.images.length > 0) {
        console.log(`   ⛔ 警告：此产品有${prod.images.length}张图片，跳过删除以保护数据！`);
        continue;
      }

      // 删图片记录（即使是0条也安全）
      await p.productImage.deleteMany({ where: { productId: item.id } });
      await p.productVideo.deleteMany({ where: { productId: item.id } });
      const r = await p.product.delete({ where: { id: item.id } });
      console.log(`   ✅ 已删除\n`);
      deleted++;

    } catch (err) {
      console.log(`   ❌ 错误: ${err.message}\n`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`删除成功: ${deleted} 条`);
  console.log(`未找到/跳过: ${notFound} 条`);

  // 查一下最终总数
  const total = await p.product.count();
  const withImg = await p.product.findMany({ include: { images: true } });
  const imgCount = withImg.filter(x => x.images.length > 0).length;
  console.log(`\n数据库剩余产品: ${total} 台`);
  console.log(`有图产品: ${imgCount} 台 (${Math.round(imgCount/total*100)}%)`);
}

main().catch(console.error).finally(() => p.$disconnect());
