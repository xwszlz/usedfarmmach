@echo off
chcp 65001 > nul
echo ================================================
echo   GitHub + Vercel 自动部署配置脚本
echo ================================================
echo.
echo 请确保已经完成以下准备工作：
echo 1. 已创建 GitHub 仓库 (访问 https://github.com/new)
echo 2. 已生成 GitHub 个人访问令牌 (PAT)
echo    - 访问 GitHub → Settings → Developer settings
echo    - Personal access tokens → Tokens (classic)
echo    - 勾选 "repo" 权限，保存生成的令牌
echo.
echo 请按任意键继续...
pause

set /p GITHUB_USERNAME=请输入您的 GitHub 用户名: 
set /p REPO_NAME=请输入仓库名称 (默认: usedfarmmach): 
if "%REPO_NAME%"=="" set REPO_NAME=usedfarmmach

echo.
echo 正在配置远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git

echo.
echo 请粘贴您的 GitHub 个人访问令牌（输入时不会显示）:
set /p GITHUB_TOKEN=>nul
if "%GITHUB_TOKEN%"=="" (
    echo 警告：未输入令牌，将使用 HTTPS 推送（可能需要手动登录）
    git push -u origin main
) else (
    echo 正在使用令牌推送代码...
    git remote set-url origin https://%GITHUB_USERNAME%:%GITHUB_TOKEN%@github.com/%GITHUB_USERNAME%/%REPO_NAME%.git
    git push -u origin main
)

echo.
echo ================================================
echo   [下一步] 配置 GitHub Secrets
echo ================================================
echo.
echo 请访问您的 GitHub 仓库页面：
echo https://github.com/%GITHUB_USERNAME%/%REPO_NAME%
echo.
echo 1. 点击 "Settings" → "Secrets and variables" → "Actions"
echo 2. 添加以下 secrets：
echo    - VERCEL_TOKEN: 您的 Vercel 令牌
echo    - VERCEL_ORG_ID: Vercel 组织 ID
echo    - VERCEL_PROJECT_ID: Vercel 项目 ID
echo.
echo 获取方法请参考 docs\github-deployment-guide.md
echo.
echo 配置完成后，推送代码会自动触发部署！
echo.
echo 如果推送失败，请运行 fix-github-push.bat 进行修复。
echo.
pause