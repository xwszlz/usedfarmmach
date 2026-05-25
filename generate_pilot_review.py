#!/usr/bin/env python3
"""
生成试点产品封面图评审页面 - 专门用于3个重点产品
"""

import json
import os

# 配置
OSS_BASE_URL = "https://usedfarmmach-oss.oss-cn-beijing.aliyuncs.com"
ANALYSIS_FILE = "product_image_analysis.json"
OUTPUT_FILE = "public/pilot-cover-review.html"

# 试点产品IDs
PILOT_PRODUCT_IDS = [
    "cmpdknl8s00e511kwiy4tzjax",  # 东洋 Beet Harvester (2018)
    "cmpdknii2000111kwcau06hey",  # 克拉斯 860 (2024)
    "cmpdknj9v004b11kwqvki68wr",  # 约翰迪尔 7250 (2013)
]

def load_data():
    """加载产品图片分析数据"""
    with open(ANALYSIS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_html(products):
    """生成HTML页面"""
    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>试点产品封面图评审 - 神雕农机</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        header {{
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        
        h1 {{
            font-size: 2.2rem;
            margin-bottom: 10px;
        }}
        
        .subtitle {{
            font-size: 1rem;
            opacity: 0.9;
        }}
        
        .guidelines {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            border-left: 5px solid #2a5298;
        }}
        
        .guidelines h2 {{
            color: #2a5298;
            margin-bottom: 12px;
            font-size: 1.4rem;
        }}
        
        .criteria-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}
        
        .criteria-card {{
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }}
        
        .criteria-card.good {{
            border-left: 4px solid #28a745;
        }}
        
        .criteria-card.bad {{
            border-left: 4px solid #dc3545;
        }}
        
        .product-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 25px;
            margin-top: 30px;
        }}
        
        .product-card {{
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }}
        
        .product-card:hover {{
            transform: translateY(-5px);
        }}
        
        .product-header {{
            background: #2a5298;
            color: white;
            padding: 15px;
        }}
        
        .product-title {{
            font-size: 1.3rem;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .product-id {{
            font-family: monospace;
            font-size: 0.8rem;
            opacity: 0.8;
        }}
        
        .product-details {{
            font-size: 0.9rem;
            opacity: 0.9;
        }}
        
        .image-grid {{
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            padding: 15px;
        }}
        
        .image-item {{
            position: relative;
            overflow: hidden;
            border-radius: 4px;
            border: 2px solid transparent;
            cursor: pointer;
            transition: all 0.2s ease;
            aspect-ratio: 1;
        }}
        
        .image-item:hover {{
            border-color: #2a5298;
            transform: scale(1.05);
        }}
        
        .image-item.selected {{
            border-color: #28a745;
            border-width: 3px;
            box-shadow: 0 0 10px rgba(40, 167, 69, 0.3);
        }}
        
        .image-item img {{
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }}
        
        .image-number {{
            position: absolute;
            top: 0;
            left: 0;
            background: rgba(0,0,0,0.7);
            color: white;
            font-size: 0.8rem;
            padding: 2px 6px;
            border-bottom-right-radius: 4px;
        }}
        
        .current-flag {{
            position: absolute;
            top: 0;
            right: 0;
            background: #ffc107;
            color: #333;
            font-size: 0.7rem;
            font-weight: bold;
            padding: 2px 6px;
            border-bottom-left-radius: 4px;
        }}
        
        .actions {{
            padding: 15px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .selection-info {{
            font-size: 0.9rem;
            color: #666;
        }}
        
        .action-btn {{
            background: #2a5298;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s ease;
        }}
        
        .action-btn:hover {{
            background: #1e3c72;
        }}
        
        .action-btn:disabled {{
            background: #cccccc;
            cursor: not-allowed;
        }}
        
        .modal {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }}
        
        .modal-content {{
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
        }}
        
        .modal-close {{
            position: absolute;
            top: 20px;
            right: 20px;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            background: none;
            border: none;
        }}
        
        .summary-section {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }}
        
        .summary-item {{
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }}
        
        @media (max-width: 768px) {{
            .image-grid {{
                grid-template-columns: repeat(3, 1fr);
            }}
            
            .product-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <header>
        <h1>试点产品封面图评审</h1>
        <div class="subtitle">重点优化3个产品的封面图，按照选图标准选择最佳图片</div>
    </header>
    
    <section class="guidelines">
        <h2>📋 选图标准 (请严格遵循)</h2>
        <div class="criteria-grid">
            <div class="criteria-card good">
                <h3>✅ 优先选择</h3>
                <ul>
                    <li><strong>整机展示</strong> - 完整展示农机全貌</li>
                    <li><strong>品牌标识可见</strong> - 清晰显示品牌Logo</li>
                    <li><strong>光线充足</strong> - 图片明亮，细节清晰</li>
                    <li><strong>角度适宜</strong> - 正面或斜45度角</li>
                    <li><strong>背景整洁</strong> - 无杂乱干扰</li>
                </ul>
            </div>
            <div class="criteria-card bad">
                <h3>❌ 避免选择</h3>
                <ul>
                    <li><strong>局部细节图</strong> - 引擎、轮胎等局部</li>
                    <li><strong>模糊暗光</strong> - 光线暗，模糊不清</li>
                    <li><strong>背景杂乱</strong> - 分散注意力</li>
                    <li><strong>无品牌标识</strong> - 找不到品牌信息</li>
                    <li><strong>角度怪异</strong> - 难以理解结构</li>
                </ul>
            </div>
        </div>
    </section>
    
    <div class="product-grid">
'''

    for product in products:
        product_id = product["productId"]
        model_name = product["modelName"]
        brand_name = product["brandName"]
        year = product["year"]
        condition = product["condition"]
        
        product_title = f"{brand_name} {model_name} ({year})"
        condition_text = "优良" if condition == "excellent" else "良好" if condition == "good" else "一般"
        
        html += f'''
        <div class="product-card" data-product-id="{product_id}">
            <div class="product-header">
                <div class="product-title">
                    <span>{product_title}</span>
                    <span class="product-id">{product_id[:8]}...</span>
                </div>
                <div class="product-details">
                    状态: {condition_text} | 当前封面: 1.jpg (默认)
                </div>
            </div>
            
            <div class="image-grid">
'''
        
        # 生成10张图片
        for i in range(1, 11):
            img_url = f"{OSS_BASE_URL}/uploads/products/{product_id}/{i}.jpg"
            is_current = (i == 1)
            
            html += f'''
                <div class="image-item" data-image-num="{i}" onclick="selectImage(this, '{product_id}')">
                    <img src="{img_url}" alt="{product_title} - 图片{i}" 
                         onerror="this.src='https://via.placeholder.com/150?text=图片{i}+加载失败'" 
                         loading="lazy">
                    <div class="image-number">{i}</div>
'''
            if is_current:
                html += '''                    <div class="current-flag">当前</div>\n'''
            
            html += '''                </div>\n'''
        
        html += f'''
            </div>
            
            <div class="actions">
                <div class="selection-info">
                    <span id="selection-{product_id}">未选择最佳图片</span>
                </div>
                <button class="action-btn" onclick="viewAllImages('{product_id}')" title="复制所有图片URL到剪贴板">
                    查看所有图片
                </button>
            </div>
        </div>
'''
    
    html += '''
    </div>
    
    <section class="summary-section">
        <h2>📝 操作说明</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <h3>1. 评审图片</h3>
                <p>点击每个小图可以放大查看。按照选图标准评估每张图片的质量。</p>
            </div>
            <div class="summary-item">
                <h3>2. 选择最佳封面</h3>
                <p>点击最佳图片将其选中（绿色边框）。每个产品只能选择一张。</p>
            </div>
            <div class="summary-item">
                <h3>3. 记录选择</h3>
                <p>将您的选择记录在以下表格中：</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead style="background: #2a5298; color: white;">
                    <tr>
                        <th style="padding: 12px; text-align: left;">产品</th>
                        <th style="padding: 12px; text-align: left;">当前封面</th>
                        <th style="padding: 12px; text-align: left;">您选择的最佳图片</th>
                        <th style="padding: 12px; text-align: left;">选择理由</th>
                        <th style="padding: 12px; text-align: left;">操作</th>
                    </tr>
                </thead>
                <tbody>
'''
    
    for product in products:
        product_id = product["productId"]
        model_name = product["modelName"]
        brand_name = product["brandName"]
        year = product["year"]
        product_title = f"{brand_name} {model_name} ({year})"
        
        html += f'''
                    <tr id="summary-{product_id}">
                        <td style="padding: 12px; border: 1px solid #eee;">{product_title}</td>
                        <td style="padding: 12px; border: 1px solid #eee;">1.jpg</td>
                        <td style="padding: 12px; border: 1px solid #eee;">
                            <span id="selected-img-{product_id}">(未选择)</span>
                        </td>
                        <td style="padding: 12px; border: 1px solid #eee;">
                            <input type="text" id="reason-{product_id}" placeholder="例如：整机展示清晰，品牌标识可见" 
                                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                        </td>
                        <td style="padding: 12px; border: 1px solid #eee;">
                            <button onclick="applySelection('{product_id}')" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                应用选择
                            </button>
                        </td>
                    </tr>
'''
    
    html += '''
                </tbody>
            </table>
        </div>
    </section>
    
    <!-- 图片放大模态框 -->
    <div class="modal" id="imageModal" onclick="closeModal()">
        <button class="modal-close" onclick="closeModal()">×</button>
        <img class="modal-content" id="modalImage" src="" alt="放大图片">
    </div>
    
    <script>
        // 存储选择状态
        const selections = {};
        
        // 选择图片
        function selectImage(element, productId) {{
            const imageNum = element.getAttribute('data-image-num');
            
            // 取消同一产品中其他图片的选择状态
            const productCard = element.closest('.product-card');
            const allImages = productCard.querySelectorAll('.image-item');
            allImages.forEach(img => {{
                img.classList.remove('selected');
            }});
            
            // 设置当前图片为选中状态
            element.classList.add('selected');
            
            // 更新选择状态
            selections[productId] = imageNum;
            
            // 更新显示
            const selectionInfo = document.getElementById(`selection-${{productId}}`);
            selectionInfo.textContent = `已选择图片 ${{imageNum}}`;
            selectionInfo.style.color = '#28a745';
            selectionInfo.style.fontWeight = 'bold';
            
            // 更新汇总表格
            const selectedSpan = document.getElementById(`selected-img-${{productId}}`);
            selectedSpan.textContent = `${{imageNum}}.jpg`;
            selectedSpan.style.color = '#28a745';
            selectedSpan.style.fontWeight = 'bold';
        }}
        
        // 查看所有图片
        function viewAllImages(productId) {{
            const baseUrl = "''' + OSS_BASE_URL + '''";
            let imageUrls = '';
            for (let i = 1; i <= 10; i++) {{
                imageUrls += baseUrl + '/uploads/products/' + productId + '/' + i + '.jpg\\n';
            }}
            
            // 复制到剪贴板
            navigator.clipboard.writeText(imageUrls).then(() => {{
                alert('产品 ' + productId.slice(0,8) + '... 的所有图片URL已复制到剪贴板，您可以在浏览器中逐个打开查看。');
            }});
        }}
        
        // 应用选择
        function applySelection(productId) {{
            const selectedImage = selections[productId];
            const reason = document.getElementById(`reason-${{productId}}`).value;
            
            if (!selectedImage) {{
                alert('请先为该产品选择最佳图片');
                return;
            }}
            
            if (!reason.trim()) {{
                alert('请填写选择理由，这有助于建立选图标准');
                return;
            }}
            
            // 这里可以添加实际更新数据库的代码
            alert(`产品 ${{productId.slice(0,8)}}... 的封面图已设置为 ${{selectedImage}}.jpg\\n理由: ${{reason}}\\n\\n（实际更新需要执行数据库操作）`);
            
            // 标记为已应用
            const row = document.getElementById(`summary-${{productId}}`);
            row.style.backgroundColor = '#f0fff4';
        }}
        
        // 图片放大功能
        function openModal(imageUrl) {{
            const modal = document.getElementById('imageModal');
            const modalImage = document.getElementById('modalImage');
            modalImage.src = imageUrl;
            modal.style.display = 'flex';
        }}
        
        function closeModal() {{
            document.getElementById('imageModal').style.display = 'none';
        }}
        
        // 点击小图放大
        document.addEventListener('DOMContentLoaded', function() {{
            document.querySelectorAll('.image-item img').forEach(img => {{
                img.parentElement.addEventListener('click', function(e) {{
                    // 如果点击的是选择功能，不放大
                    if (e.target.closest('.image-item') && !e.target.classList.contains('image-number') && !e.target.classList.contains('current-flag')) {{
                        openModal(img.src);
                    }}
                }});
            }});
            
            // ESC键关闭模态框
            document.addEventListener('keydown', function(e) {{
                if (e.key === 'Escape') closeModal();
            }});
        }});
        
        // 初始化选择状态显示
        document.addEventListener('DOMContentLoaded', function() {{
            for (const productId in selections) {{
                const selectedSpan = document.getElementById(`selected-img-${{productId}}`);
                if (selectedSpan) {{
                    selectedSpan.textContent = `${{selections[productId]}}.jpg`;
                    selectedSpan.style.color = '#28a745';
                    selectedSpan.style.fontWeight = 'bold';
                }}
            }}
        }});
    </script>
    
    <footer style="margin-top: 40px; padding: 20px; text-align: center; color: #666; font-size: 0.9rem;">
        <p>神雕农机 - 产品封面图优化试点项目 | 生成时间: 2026-05-24</p>
        <p>每个产品有10张图片 (1.jpg ~ 10.jpg)，请按照选图标准选择最佳封面图。</p>
    </footer>
</body>
</html>'''
    
    return html

def main():
    """主函数"""
    print("正在生成试点产品封面图评审页面...")
    
    # 加载数据
    all_products = load_data()
    
    # 筛选试点产品
    pilot_products = []
    for product in all_products:
        if product["productId"] in PILOT_PRODUCT_IDS:
            pilot_products.append(product)
    
    print(f"找到 {len(pilot_products)} 个试点产品:")
    for product in pilot_products:
        print(f"  - {product['brandName']} {product['modelName']} ({product['year']})")
    
    # 生成HTML
    html_content = generate_html(pilot_products)
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    # 写入文件
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"评审页面已生成: {OUTPUT_FILE}")
    print("\n请打开该文件，按照选图标准评审图片，并记录您的最佳选择。")

if __name__ == "__main__":
    main()