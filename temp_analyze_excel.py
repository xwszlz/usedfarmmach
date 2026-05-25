import pandas as pd
import sys

excel_path = r'D:\神雕农机\出口农机库存表.xlsx'

try:
    # Read all sheet names
    xl = pd.ExcelFile(excel_path)
    print(f"Sheet names: {xl.sheet_names}")
    
    # Read first sheet
    df = xl.parse(xl.sheet_names[0])
    print(f"Data shape: {df.shape}")
    print("\nColumns:")
    for col in df.columns:
        print(f"  - {col}")
    
    # Show first few rows
    print("\nFirst 5 rows:")
    print(df.head())
    
    # Check for image-related columns
    image_cols = [col for col in df.columns if '图片' in str(col) or 'image' in str(col).lower() or 'url' in str(col).lower()]
    print(f"\nImage-related columns: {image_cols}")
    
    if image_cols:
        for col in image_cols:
            print(f"\nSample values from '{col}':")
            sample = df[col].dropna().head(5).tolist()
            for val in sample:
                print(f"  - {val}")
                
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)