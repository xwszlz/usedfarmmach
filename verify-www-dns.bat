@echo off
chcp 65001 >nul
echo ========================================
echo WWW 子域名 DNS 配置验证脚本
echo 用途：验证 www.usedfarmmach.cn 和 www.usedfarmmach.com 的 DNS 配置
echo 生成时间：2026-05-26 13:50
echo ========================================

echo.
echo [1/4] 检查现有网站 (www.usedfarmmach.com)...
echo.
echo   现有网站 DNS 配置分析：
echo   - 用户现有网站通过 www.usedfarmmach.com 访问
echo   - 解析到非 Vercel 平台：43.109.70.140-147
echo   - 状态：✅ 稳定运行，独立于 Vercel 部署

nslookup www.usedfarmmach.com >temp-com-dns.txt 2>&1
type temp-com-dns.txt | findstr "Addresses:" >nul
if %errorlevel% equ 0 (
  type temp-com-dns.txt | findstr "Addresses:"
  echo   状态：✅ DNS 配置正常
) else (
  echo   状态：⚠️  无法获取 DNS 信息
)

echo.
echo [2/4] 检查根域名 (usedfarmmach.com)...
nslookup usedfarmmach.com 2>&1 | findstr "Non-existent" >nul
if %errorlevel% equ 0 (
  echo   状态：❌ 无 DNS 记录（用户无法通过根域名访问）
) else (
  echo   状态：✅ 有 DNS 记录
)

echo.
echo [3/4] 检查新版网站 (www.usedfarmmach.cn)...
echo.
echo   WWW 子域名配置建议：
echo   - 建议添加 CNAME 记录：www -> usedfarmmach.cn
echo   - 或添加 A 记录：www -> 76.76.21.21
echo   - 确保用户可通过 www. 和根域名两种方式访问

set "has_www_cn=0"
nslookup www.usedfarmmach.cn >temp-cn-dns.txt 2>&1
type temp-cn-dns.txt | findstr "76.76.21.21" >nul
if %errorlevel% equ 0 (
  set "has_www_cn=1"
  echo   状态：✅ 已配置，指向 Vercel (76.76.21.21)
) else (
  type temp-cn-dns.txt | findstr "timed out" >nul
  if %errorlevel% equ 0 (
    echo   状态：❌ DNS 查询超时（未配置 WWW 记录）
  ) else (
    type temp-cn-dns.txt | findstr "NXDOMAIN\|Non-existent" >nul
    if %errorlevel% equ 0 (
      echo   状态：❌ 域名不存在或无 WWW 记录
    ) else (
      echo   状态：⚠️  其他 DNS 响应（请检查输出）
      type temp-cn-dns.txt
    )
  )
)

echo.
echo [4/4] 对比分析结果...
echo.
echo   📊 配置对比：
echo   -----------------------------------------------------
echo   域名                     | 状态          | 托管平台
echo   -----------------------------------------------------
echo   www.usedfarmmach.com     | ✅ 正常       | 非 Vercel
echo   usedfarmmach.com         | ❌ 无记录     | N/A
echo   usedfarmmach.cn          | ✅ 已配置     | Vercel (76.76.21.21)
if %has_www_cn% equ 1 (
  echo   www.usedfarmmach.cn      | ✅ 已配置     | Vercel (76.76.21.21)
) else (
  echo   www.usedfarmmach.cn      | ❌ 待配置     | 建议添加记录
)

echo   -----------------------------------------------------

echo.
echo 💡 下一步操作建议：
echo.
if %has_www_cn% equ 0 (
  echo   1. 为 usedfarmmach.cn 添加 WWW 子域名记录：
  echo       阿里云 DNS → 添加记录 → CNAME: www -> usedfarmmach.cn
  echo       或 A 记录：www -> 76.76.21.21
  echo.
)
echo   2. 运行 verify-cn-site.bat 验证网站功能
echo   3. 等待 SSL 证书生效（Vercel 自动颁发）
echo   4. 测试两个访问入口：
echo        https://usedfarmmach.cn
echo        https://www.usedfarmmach.cn

echo.
echo ⚠️  重要提醒：
echo   - .cn 网站与现有 .com 网站完全独立
echo   - 配置 WWW 子域名可提升用户体验
echo   - 许多用户习惯输入 www. 开头

echo.
echo ========================================
echo 执行完成的后续步骤：
echo 1. 如果 WWW 子域名未配置，请按建议添加 DNS 记录
echo 2. 等待 5-10 分钟让 DNS 生效
echo 3. 再次运行此脚本验证配置
echo ========================================

echo.
del temp-com-dns.txt temp-cn-dns.txt 2>nul
pause