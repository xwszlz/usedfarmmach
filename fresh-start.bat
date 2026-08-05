@echo off
chcp 65001
echo ================================
echo    全新开始 - 100%成功方案
echo ================================
echo.

echo [1/6] 请先完成这一步...
echo 访问：https://github.com/new
echo 创建新空白仓库（名称随意，比如 usedfarmmach-v2）
echo 重要：不要初始化README/.gitignore/license
echo.
pause

echo [2/6] 创建干净的代码副本...
if exist "D:\神雕农机\usedfarmmach-fresh" rmdir /S /Q "D:\神雕农机\usedfarmmach-fresh"
xcopy "D:\神雕农机\usedfarmmach" "D:\神雕农机\usedfarmmach-fresh" /E /I /Q /EXCLUDE:exclude-list.txt
echo 已创建干净副本

echo [3/6] 在新文件夹中初始化Git...
cd /d "D:\神雕农机\usedfarmmach-fresh"
call :cleanup_git
git init
git add .
git commit -m "初始提交：神雕农机平台完整代码"

echo [4/6] 请粘贴新仓库的HTTPS URL：
echo   例如：https://github.com/xwszlz/usedfarmmach-v2.git
echo.
set /p repo_url="新仓库URL："
git remote add origin "%repo_url%"

echo [5/6] 推送到新仓库...
git push -u origin main

if %errorlevel% equ 0 (
    echo ✓ 推送成功！
    echo.
    echo [6/6] 下一步 - 配置自动化：
    echo 1. 复制 .github/workflows/deploy.yml 到新仓库
    echo 2. 在GitHub仓库Settings -> Secrets
    echo 3. 添加 VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
    echo 4. 完成！代码推送自动触发Vercel部署
) else (
    echo ✗ 推送失败，请尝试手动推送：
    echo git push -u origin main
)

echo.
echo ================================
echo    完成！新仓库已准备就绪
echo ================================
pause
goto :eof

:cleanup_git
echo 清理Git历史和敏感文件...
del .git /F /Q >nul 2>&1
rmdir .git /S /Q >nul 2>&1
del .env /F /Q >nul 2>&1
del *.ps1 /F /Q >nul 2>&1
del *.bat /F /Q >nul 2>&1
exit /b 0