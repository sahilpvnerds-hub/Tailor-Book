@echo off
echo Cleaning up lock files...
del /f /q pnpm-lock.yaml 2>nul
del /f /q package-lock.json 2>nul
echo Dependencies cleaned. Running expo start...
npx expo start
pause