$env:Path = "C:\Users\nirod\tools\node;" + $env:Path
Write-Host "Starting TpayX Local Servers..." -ForegroundColor Cyan

# Start Backend
Start-Process cmd -ArgumentList "/k", "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\backend && npm start" -WindowStyle Normal

# Start Frontend
Start-Process cmd -ArgumentList "/k", "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\frontend && npm run dev" -WindowStyle Normal

# Start Admin Panel
Start-Process cmd -ArgumentList "/k", "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\admin-panel && npm run dev" -WindowStyle Normal

Write-Host "All servers starting up! Check the separate console windows." -ForegroundColor Green
