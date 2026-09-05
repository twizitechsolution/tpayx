@echo off
set PATH=C:\Users\nirod\tools\node;%PATH%
echo Starting TpayX Local Servers...

echo Starting Express.js Backend on http://localhost:5000...
start "TpayX Backend" cmd /k "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\backend && npm start"

echo Starting Mobile Client App (Vite Dev Server)...
start "TpayX Frontend" cmd /k "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\frontend && npm run dev"

echo Starting Admin Panel Dashboard (Vite Dev Server)...
start "TpayX Admin Panel" cmd /k "set PATH=C:\Users\nirod\tools\node;%%PATH%% && cd /d C:\Users\nirod\OneDrive\Desktop\Data\tpayx\admin-panel && npm run dev"

echo All servers starting up! Check the separate console windows.
