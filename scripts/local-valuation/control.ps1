param([ValidateSet('start', 'stop', 'status')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$valuationPython = Join-Path $env:USERPROFILE '.sky-valuation/venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $valuationPython)) { throw '請先依 README 安裝本機估價環境。' }
& $valuationPython (Join-Path $PSScriptRoot 'manage.py') $Action
if ($Action -eq 'start') { Write-Host '正在預熱；稍後執行 status 查看臨時網址。網址改變需更新網站設定。' }
