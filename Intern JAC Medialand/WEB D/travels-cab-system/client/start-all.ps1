$ErrorActionPreference = 'Stop'

Write-Host "Starting Travels Cab portals..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location -LiteralPath "$PWD"; npm.cmd run dev:portal'
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location -LiteralPath "$PWD"; npm.cmd run dev:customer'
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location -LiteralPath "$PWD"; npm.cmd run dev:driver'
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'Set-Location -LiteralPath "$PWD"; npm.cmd run dev:admin'

Write-Host "Portal:   http://localhost:5173" -ForegroundColor Green
Write-Host "Customer: http://localhost:5175" -ForegroundColor Green
Write-Host "Driver:   http://localhost:5177" -ForegroundColor Green
Write-Host "Admin:    http://localhost:5179" -ForegroundColor Green
Write-Host "Backend:  https://travels-cab-backend.onrender.com" -ForegroundColor Green
