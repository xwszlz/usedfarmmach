@echo off
echo 检查 usedfarmmach.cn DNS 解析状态
echo ==================================

echo.
echo 1. 使用 nslookup 检查 A 记录：
nslookup usedfarmmach.cn

echo.
echo 2. 使用 ping 测试连通性（按 Ctrl+C 停止）：
ping usedfarmmach.cn

echo.
echo 如果看到 IP 地址 76.76.21.21，说明 DNS 已生效。
echo 如果未生效，请等待几分钟后重试。
echo.
echo 按任意键继续...
pause > nul