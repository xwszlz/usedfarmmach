import json
from pathlib import Path

# 配置
OSS_BASE_URL = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com"
ANALYSIS_FILE = Path(__file__).parent / "product_image_analysis.json"
OUTPUT_HTML = Path(__file__).parent / "public" / "cover-image-review.html"

def generate_html():
    # 读取分析数据
    with open(ANALYSIS_FILE, 'r', encoding='utf-8') as f:
        analysis = json.load(f)
    
    # 生成HTML内容
    html_parts = []
    html_parts.append("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>产品封面图评审工具 - 神雕农机</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        
        header {
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }
        
        .guidelines {
            background: white;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 5px solid #2a5298;
        }
        
        .guidelines h2 {
            color: #2a5298;
            margin-bottom: 15px;
            font-size: 1.5rem;
        }
        
        .criteria-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .criteria-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        
        .criteria-card.good {
            border-left: 4px solid #28a745;
        }
        
        .criteria-card.bad {
            border-left: 4px solid #dc3545;
        }
        
        .product-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
            margin-top: 30px;
        }
        
        .product-card {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .product-card:hover {
            transform: translateY(-5px);
        }
        
        .product-header {
            background: #2a5298;
            color: white;
            padding: 18px;
        }
        
        .product-title {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .product-meta {
            font-size: 0.9rem;
            opacity: 0.9;
            display: flex;
            gap: 15px;
        }
        
        .images-container {
            padding: 20px;
        }
        
        .image-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-top: 15px;
        }
        
        .image-item {
            position: relative;
            border-radius: 6px;
            overflow: hidden;
            aspect-ratio: 1;
            cursor: pointer;
            border: 3px solid transparent;
            transition: all 0.2s ease;
        }
        
        .image-item:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .image-item.current-cover {
            border-color: #ff6b6b;
        }
        
        .image-item.recommended {
            border-color: #28a745;
        }
        
        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        .image-index {
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(0,0,0,0.7);
            color: white;
            font-size: 0.8rem;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .current-cover-badge {
            position: absolute;
            top: 5px;
            right: 5px;
            background: #ff6b6b;
            color: white;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: bold;
        }
        
        .recommended-badge {
            position: absolute;
            bottom: 5px;
            left: 5px;
            background: #28a745;
            color: white;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: bold;
        }
        
        .notes {
            margin-top: 15px;
            padding: 12px;
            background: #fff3cd;
            border-radius: 6px;
            font-size: 0.9rem;
            color: #856404;
            border-left: 4px solid #ffc107;
        }
        
        .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 8px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9rem;
            transition: background 0.2s;
        }
        
        .btn-select {
            background: #28a745;
            color: white;
        }
        
        .btn-select:hover {
            background: #218838;
        }
        
        .btn-view {
            background: #17a2b8;
            color: white;
        }
        
        .btn-view:hover {
            background: #138496;
        }
        
        footer {
            margin-top: 40px;
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid #ddd;
        }
        
        @media (max-width: 768px) {
            .product-grid {
                grid-template-columns: 1fr;
            }
            
            .image-grid {
                grid-template-columns: repeat(3, 1fr);
            }
        }
    </style>
</head>
<body>
    <header>
        <h1>产品封面图评审工具</h1>
        <div class="subtitle">神雕农机跨境平台 - 优化产品封面图，提升客户吸引力</div>
        <p>当前分析产品数: <strong>#COUNT#</strong> | 每个产品图片数: 10张</p>
    </header>
    
    <section class="guidelines">
        <h2>选图标准指南</h2>
        <p>请根据以下标准选择最佳封面图（点击图片可放大查看）：</p>
        
        <div class="criteria-grid">
            <div class="criteria-card good">
                <strong>✅ 优先选择：</strong>
                <ul>
                    <li>完整展示整机外观</li>
                    <li>清晰显示品牌Logo</li>
                    <li>光线充足，背景整洁</li>
                    <li>正面或斜45度角</li>
                    <li>设备清洁，如新感觉</li>
                </ul>
            </div>
            
            <div class="criteria-card bad">
                <strong>❌ 避免选择：</strong>
                <ul>
                    <li>局部细节图（引擎、轮胎等）</li>
                    <li>模糊、光线暗的图片</li>
                    <li>背景杂乱，分散注意力</li>
                    <li>无品牌标识</li>
                    <li>角度怪异，难以理解结构</li>
                </ul>
            </div>
        </div>
        
        <p style="margin-top: 15px; font-style: italic;">
            提示：当前封面图以<mark style="background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 3px;">红色边框</mark>标记。
            您认为更好的图片可以点击选择，记录下产品ID和图片编号。
        </p>
    </section>
    
    <main>
        <h2 style="color: #2a5298; margin-bottom: 20px;">产品图片评审</h2>
        <div class="product-grid">
""")
    
    # 产品卡片
    for idx, product in enumerate(analysis):
        product_id = product['productId']
        model_name = product['modelName']
        brand_name = product['brandName']
        year = product['year']
        condition = product['condition']
        image_count = product['imageCount']
        notes = product['notes']
        
        # 生成图片网格
        images_html = []
        for i in range(1, 11):  # 假设每个产品有10张图片
            img_url = f"{OSS_BASE_URL}/uploads/products/{product_id}/{i}.jpg"
            current_cover_class = "current-cover" if i == 1 else ""
            recommended_class = "recommended" if i in [1, 2, 3] else ""  # 示例：前3张可能较好
            
            images_html.append(f"""
                <div class="image-item {current_cover_class} {recommended_class}" data-product="{product_id}" data-image="{i}">
                    <div class="image-index">{i}</div>
                    { '<div class="current-cover-badge">当前封面</div>' if i == 1 else ''}
                    { '<div class="recommended-badge">推荐</div>' if i in [1,2,3] else ''}
                    <img src="{img_url}" alt="{brand_name} {model_name} 图片{i}" loading="lazy">
                </div>
            """)
        
        # 产品卡片
        html_parts.append(f"""
            <div class="product-card" id="product-{product_id}">
                <div class="product-header">
                    <div class="product-title">{brand_name} {model_name}</div>
                    <div class="product-meta">
                        <span>年份: {year}</span>
                        <span>状态: {condition}</span>
                        <span>ID: {product_id[:8]}...</span>
                    </div>
                </div>
                
                <div class="images-container">
                    <p><strong>图片选择</strong>（当前封面图以红色边框标记）</p>
                    <div class="image-grid">
                        {''.join(images_html)}
                    </div>
                    
                    { f'<div class="notes"><strong>备注:</strong> {notes}</div>' if notes else ''}
                    
                    <div class="action-buttons">
                        <button class="btn btn-select" onclick="selectBestImage('{product_id}')">
                            📋 记录最佳图片
                        </button>
                        <button class="btn btn-view" onclick="viewAllImages('{product_id}')">
                            🔍 查看大图
                        </button>
                    </div>
                </div>
            </div>
        """)
    
    html_parts.append("""
        </div>
    </main>
    
    <footer>
        <p>神雕农机跨境平台 - 产品图片优化项目</p>
        <p>生成时间: <!--DATE--> | 图片存储: 阿里云OSS</p>
        <p>使用说明: 点击图片可查看大图，记录下需要设为封面的图片编号，联系技术人员更新数据库。</p>
    </footer>
    
    <script>
        // 图片点击放大
        document.querySelectorAll('.image-item').forEach(item => {
            item.addEventListener('click', function() {
                const productId = this.dataset.product;
                const imageNum = this.dataset.image;
                const imgUrl = this.querySelector('img').src;
                
                // 在新窗口打开大图
                window.open(imgUrl, '_blank');
            });
        });
        
        // 选择最佳图片
        function selectBestImage(productId) {
            const productCard = document.getElementById(`product-${productId}`);
            const images = productCard.querySelectorAll('.image-item');
            
            // 简单交互：点击标记为最佳
            images.forEach(img => {
                img.addEventListener('click', function selectHandler() {
                    images.forEach(i => i.classList.remove('selected'));
                    this.classList.add('selected');
                    
                    const imageNum = this.dataset.image;
                    alert(`已记录: 产品 ${productId.slice(0,8)}... 的最佳封面图为第 ${imageNum} 张\\n\\n请将此信息告知技术人员更新数据库。`);
                    
                    // 移除事件监听器，避免重复
                    this.removeEventListener('click', selectHandler);
                }, { once: true });
            });
            
            alert(`请点击 ${productId.slice(0,8)}... 产品中的最佳图片进行选择`);
        }
        
        // 查看所有图片
        function viewAllImages(productId) {
            const baseUrl = '""" + OSS_BASE_URL + """';
            let imageUrls = '';
            for (let i = 1; i <= 10; i++) {
                imageUrls += baseUrl + '/uploads/products/' + productId + '/' + i + '.jpg\\n';
            }
            
            // 复制到剪贴板
            navigator.clipboard.writeText(imageUrls).then(() => {
                alert('产品 ' + productId.slice(0,8) + '... 的所有图片URL已复制到剪贴板，您可以在浏览器中逐个打开查看。');
            });
        }
        
        // 页面加载时显示产品数量
        document.addEventListener('DOMContentLoaded', function() {
            const count = document.querySelectorAll('.product-card').length;
            document.querySelector('header p strong').textContent = '#' + count;
        });
    </script>
</body>
</html>""")
    
    # 替换占位符
    html_content = ''.join(html_parts)
    html_content = html_content.replace('#COUNT#', str(len(analysis)))
    
    # 确保public目录存在
    OUTPUT_HTML.parent.mkdir(exist_ok=True)
    
    # 写入HTML文件
    with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"HTML文件已生成: {OUTPUT_HTML}")
    print(f"请用浏览器打开该文件查看产品图片")
    print(f"产品总数: {len(analysis)}")

if __name__ == "__main__":
    generate_html()