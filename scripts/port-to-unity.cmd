@echo off
setlocal enabledelayedexpansion

rem ===== Paths =====
set WS=C:\Users\Error\Desktop\pathheroes
set UNITY=C:\Users\Error\PathHeroes
set ASSETS_SRC=%WS%\assets
set ASSETS_DST=%UNITY%\Assets\PathHeroes\Resources\assets
set SCRIPTS_SRC=%WS%\unity\PathHeroes\Scripts
set SCRIPTS_DST=%UNITY%\Assets\PathHeroes\Scripts

echo [PathHeroes] Копирование ассетов в Unity...
if not exist "%ASSETS_DST%" mkdir "%ASSETS_DST%"
robocopy "%ASSETS_SRC%" "%ASSETS_DST%" /E /NFL /NDL /NJH /NJS >nul

echo [PathHeroes] Копирование C#-скриптов...
if not exist "%SCRIPTS_DST%" mkdir "%SCRIPTS_DST%"
robocopy "%SCRIPTS_SRC%" "%SCRIPTS_DST%" /E /NFL /NDL /NJH /NJS >nul

echo [PathHeroes] Готово. Откройте проект Unity: %UNITY%
echo [PathHeroes] В Unity установите пакет com.unity.vectorgraphics (Window > Package Manager), если не установлен.
exit /b 0


