@echo off
chcp 65001 >nul
echo ============================================
echo  #1 卖方采集 Agent — 一键运行
echo  国内全平台 + 国际 Agriaffaires
echo ============================================
echo.

set SCRIPTS_DIR=%~dp0
set PROJECT_DIR=%SCRIPTS_DIR%..\usedfarmmach

:: 国内爬虫
echo [1/3] 国内卖家全平台采集...
cd /d "%SCRIPTS_DIR%"
C:\Users\guofu\.workbuddy\binaries\python\versions\3.13.12\python.exe seller_scout_domestic_scraper.py
if %errorlevel% neq 0 (
    echo ⚠️ 国内爬虫有错误，继续执行
)
echo.

:: 国际爬虫（Agriaffaires）
echo [2/3] 国际卖家采集...
cd /d "%SCRIPTS_DIR%"
C:\Users\guofu\.workbuddy\binaries\python\versions\3.13.12\python.exe scrape_agriaffaires.py
if %errorlevel% neq 0 (
    echo ⚠️ 国际爬虫有错误，继续执行
)
echo.

:: 导入数据库
echo [3/3] 导入数据库...
cd /d "%PROJECT_DIR%"
C:\Users\guofu\.workbuddy\binaries\node\versions\22.22.2\node.exe node_modules\tsx\dist\cli.mjs scripts\import-seller-scout.ts
C:\Users\guofu\.workbuddy\binaries\node\versions\22.22.2\node.exe node_modules\tsx\dist\cli.mjs scripts\import-seller-scout-domestic.ts
echo.

echo ============================================
echo  ✅ 完成
echo ============================================
pause
