# 启动微信开发者工具并保持 automation 端口持续监听
# 这个脚本会保持运行（不退出），从而让 9420 WebSocket 端口持续可用

Set-Location "E:\ProgramData\Tencent\微信web开发者工具"
Write-Host "启动微信开发者工具..."
Write-Host "HTTP 端口: 9421"
Write-Host "WebSocket 端口: 9420"
Write-Host "项目: D:\code\yuanBabyGrowthDiary\miniprogram"
Write-Host ""
Write-Host "按 Ctrl+C 停止此脚本（会同时关闭 DevTools）"

& ".\cli.bat" auto --port 9421 --auto-port 9420 --project "D:\code\yuanBabyGrowthDiary\miniprogram"

Write-Host "DevTools 已停止"
Read-Host "按回车键关闭窗口"
