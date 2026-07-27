# ============================================
# 大哥弟旅游规划 - 一键更新部署脚本
# 使用方法: 右键 -> 使用PowerShell运行
# ============================================

$projectDir = "D:\codex\lvyouxiangmu"
$gitExe = "C:\Program Files\Git\bin\git.exe"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  大哥弟旅游规划 - 一键更新 V2.6" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# 1. 拉取最新代码
Write-Host "[1/3] 拉取GitHub最新代码..." -ForegroundColor Green
Set-Location $projectDir
& $gitExe pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Git拉取失败，请检查网络" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}
Write-Host "  代码已更新" -ForegroundColor Green

# 2. 重启本地服务（如果正在运行）
Write-Host "[2/3] 重启本地服务..." -ForegroundColor Green
$proc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess }
if ($proc) { Stop-Process -Id $proc.Id -Force; Write-Host "  旧服务已停止" }
Write-Host "  本地服务已处理" -ForegroundColor Green

# 3. 提示
Write-Host "[3/3] 线上部署..." -ForegroundColor Green
Write-Host "  Railway 自动从 GitHub 部署，2-3分钟生效" -ForegroundColor Cyan
Write-Host "  在线地址: https://hainan-travel-production.up.railway.app" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  更新完成!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "按回车退出"
