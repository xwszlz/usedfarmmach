import sqlite3
import json
from pathlib import Path

DB_PATH = Path(__file__).parent / "prisma" / "dev.db"

def analyze_product_images():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all products with their primary image (first image by sortOrder)
    query = """
    SELECT 
        p.id, 
        p.modelName,
        p.brandId,
        b.nameZh as brandName,
        p.year,
        p.condition,
        pi.url as imageUrl,
        pi.sortOrder,
        pi.isPrimary,
        (SELECT COUNT(*) FROM ProductImage WHERE productId = p.id) as imageCount
    FROM Product p
    LEFT JOIN Brand b ON p.brandId = b.id
    LEFT JOIN ProductImage pi ON p.id = pi.productId
    WHERE pi.id IS NOT NULL
    ORDER BY p.id, pi.sortOrder
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    # Group by product
    products = {}
    for row in rows:
        pid = row['id']
        if pid not in products:
            products[pid] = {
                'id': pid,
                'modelName': row['modelName'],
                'brandName': row['brandName'],
                'year': row['year'],
                'condition': row['condition'],
                'images': []
            }
        products[pid]['images'].append({
            'url': row['imageUrl'],
            'sortOrder': row['sortOrder'],
            'isPrimary': bool(row['isPrimary'])
        })
    
    # Analyze each product
    analysis = []
    for pid, product in products.items():
        images = product['images']
        # Sort images by sortOrder
        images.sort(key=lambda x: x['sortOrder'])
        primary_image = images[0] if images else None
        
        # Check if primary image is marked as isPrimary
        is_primary_flag = any(img['isPrimary'] for img in images)
        
        # Basic assessment (placeholder)
        # In reality, we would need to examine image content
        assessment = {
            'productId': pid,
            'modelName': product['modelName'],
            'brandName': product['brandName'],
            'year': product['year'],
            'condition': product['condition'],
            'primaryImageUrl': primary_image['url'] if primary_image else None,
            'imageCount': len(images),
            'hasPrimaryFlag': is_primary_flag,
            'sortOrders': [img['sortOrder'] for img in images],
            'notes': ''
        }
        
        # Heuristic: check if image filename suggests it might be a good cover
        # e.g., contains "main", "cover", "front", "whole", etc.
        if primary_image:
            url_lower = primary_image['url'].lower()
            # Check if URL contains indicators of a good cover image
            good_indicators = ['main', 'cover', 'front', 'whole', 'full', '整机', '全景']
            bad_indicators = ['detail', 'part', '局部', '零件', 'engine', '内部']
            
            has_good_indicator = any(indicator in url_lower for indicator in good_indicators)
            has_bad_indicator = any(indicator in url_lower for indicator in bad_indicators)
            
            if has_bad_indicator:
                assessment['notes'] += '可能为局部细节图，非整机展示。'
            if has_good_indicator:
                assessment['notes'] += '文件名提示可能为整机图。'
            if not assessment['notes']:
                assessment['notes'] = '需要人工检查图片内容。'
        
        analysis.append(assessment)
    
    # Write analysis to JSON file
    output_path = Path(__file__).parent / "product_image_analysis.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    
    print(f"分析完成，共分析 {len(analysis)} 个产品")
    print(f"结果已保存到: {output_path}")
    
    # Summary statistics
    total_products = len(analysis)
    products_with_images = sum(1 for a in analysis if a['primaryImageUrl'])
    products_multiple_images = sum(1 for a in analysis if a['imageCount'] > 1)
    
    print(f"\n概览:")
    print(f"- 总产品数: {total_products}")
    print(f"- 有图片的产品: {products_with_images}")
    print(f"- 有多张图片的产品: {products_multiple_images}")
    
    # Show some examples
    print(f"\n前5个产品分析:")
    for i, a in enumerate(analysis[:5]):
        print(f"{i+1}. {a['brandName']} {a['modelName']} ({a['year']})")
        print(f"   主图: {a['primaryImageUrl']}")
        print(f"   图片数量: {a['imageCount']}")
        print(f"   备注: {a['notes']}")
        print()
    
    conn.close()

if __name__ == "__main__":
    analyze_product_images()