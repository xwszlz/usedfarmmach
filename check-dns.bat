@echo off
chcp 65001 > nul
echo ==============================================
echo         DNS诊断工具 - 检查域名解析
echo ==============================================
echo.
echo [1] 检查 usedfarmmach.com 的A记录
nslookup usedfarmmach.com 8.8.8.8 2>&1 | findstr /V "Server Address" | findstr /V "DNS" | findstr /V "^$"
echo.
echo [2] 检查是否指向Vercel IP (76.76.21.21)
nslookup usedfarmmach.com 8.8.8.8 2>&1 | findstr "76.76.21.21"
if %errorlevel% equ 0 (
    echo ✅ DNS已指向Vercel正确IP
) else (
    echo ❌ DNS未指向Vercel (76.76.21.21)
)
echo.
echo [3] 检查SSL证书状态（近似）
powershell -Command "try { [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; $req = [System.Net.HttpWebRequest]::Create('https://usedfarmmach.com'); $req.Timeout = 3000; $req.GetResponse().Close(); echo '✅ SSL证书有效（网站可访问）' } catch { echo '❌ SSL证书问题或连接失败' }"
echo.
echo ==============================================
echo 需要阿里云DNS配置:
echo 1. 登录阿里云控制台 → 域名与网站 → 域名
echo 2. 找到 usedfarmmach.com → 点击"解析"
echo 3. 添加记录:
echo    类型: A
echo    主机记录: @
echo    记录值: 76.76.21.21
echo    TTL: 600 (10分钟)
echo 4. 保存，等待5-30分钟生效
echo ==============================================
echo.
pause