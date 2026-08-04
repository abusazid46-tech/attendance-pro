@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
set "ANDROID_HOME=C:\Android"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "EXPO_PUBLIC_API_URL=https://brown-butterfly-424334.hostingersite.com/api/v1"
set "NODE_ENV=production"
set "NODE_OPTIONS=--max-old-space-size=768 --dns-result-order=ipv4first"
set "npm_config_jobs=1"
set "GRADLE_OPTS=-Xmx1024m -Dorg.gradle.workers.max=1 -Dorg.gradle.vfs.watch=false -Dorg.gradle.daemon=false -Dsun.zip.disableMemoryMapping=true"
set "JAVA_TOOL_OPTIONS=-Dsun.zip.disableMemoryMapping=true"
set "BUILD_LOG=%PROJECT_ROOT%\build-release-local-cmd.log"
set "COPY_LOG=%PROJECT_ROOT%\build-stage-copy.log"
set "INSTALL_LOG=%PROJECT_ROOT%\build-stage-install.log"
set "STAGE_DIR=%PROJECT_ROOT%\work-apk-build\amsclean%RANDOM%"
set "GRADLE_USER_HOME=%USERPROFILE%\.gradle-ams-clean"

if defined JAVA_HOME (
  if exist "%JAVA_HOME%\bin\java.exe" goto java_ready
)

where java.exe >nul 2>&1
if errorlevel 1 (
  echo Java was not found in PATH. Open a fresh CMD after installing JDK 17 and try again.
  exit /b 1
)

:java_ready
java -version

echo Preparing short build folder: %STAGE_DIR%
if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
mkdir "%STAGE_DIR%" "%STAGE_DIR%\apps" "%GRADLE_USER_HOME%" >nul 2>&1

echo Copying root files... > "%COPY_LOG%"
copy /Y "%PROJECT_ROOT%\package.json" "%STAGE_DIR%\package.json" >> "%COPY_LOG%" 2>&1
copy /Y "%PROJECT_ROOT%\package-lock.json" "%STAGE_DIR%\package-lock.json" >> "%COPY_LOG%" 2>&1
copy /Y "%PROJECT_ROOT%\tsconfig.base.json" "%STAGE_DIR%\tsconfig.base.json" >> "%COPY_LOG%" 2>&1
if exist "%PROJECT_ROOT%\.env.example" copy /Y "%PROJECT_ROOT%\.env.example" "%STAGE_DIR%\.env.example" >> "%COPY_LOG%" 2>&1
if exist "%PROJECT_ROOT%\README.md" copy /Y "%PROJECT_ROOT%\README.md" "%STAGE_DIR%\README.md" >> "%COPY_LOG%" 2>&1
if not exist "%STAGE_DIR%\package.json" goto copy_failed
if not exist "%STAGE_DIR%\package-lock.json" goto copy_failed

robocopy "%PROJECT_ROOT%\apps\mobile" "%STAGE_DIR%\apps\mobile" /E /XJ /R:1 /W:1 /XD ^
  "%PROJECT_ROOT%\apps\mobile\android\app\.cxx" ^
  "%PROJECT_ROOT%\apps\mobile\android\app\build" ^
  "%PROJECT_ROOT%\apps\mobile\android\build" ^
  "%PROJECT_ROOT%\apps\mobile\android\.gradle" >> "%COPY_LOG%" 2>&1
if errorlevel 8 goto copy_failed

if exist "%PROJECT_ROOT%\packages" (
  robocopy "%PROJECT_ROOT%\packages" "%STAGE_DIR%\packages" /E /XJ /R:1 /W:1 >> "%COPY_LOG%" 2>&1
  if errorlevel 8 goto copy_failed
)

if not exist "%STAGE_DIR%\apps\mobile\android\gradlew.bat" goto copy_failed

goto copy_done

:copy_failed
echo Failed to prepare short build folder.
echo Copy log:
echo %COPY_LOG%
powershell -NoProfile -Command "Get-Content -LiteralPath '%COPY_LOG%' -Tail 80"
exit /b 1

:copy_done
echo Installing mobile dependencies in short folder...
echo Install log: %INSTALL_LOG%
cd /d "%STAGE_DIR%" || exit /b 1
call npm.cmd install --workspace @attendance/mobile --include-workspace-root --prefer-offline --no-audit --no-fund > "%INSTALL_LOG%" 2>&1
if errorlevel 1 (
  echo.
  echo DEPENDENCY INSTALL FAILED. Last log lines:
  powershell -NoProfile -Command "Get-Content -LiteralPath '%INSTALL_LOG%' -Tail 100"
  echo.
  echo Full install log saved at:
  echo %INSTALL_LOG%
  exit /b %errorlevel%
)

set "ANDROID_DIR=%STAGE_DIR%\apps\mobile\android"
cd /d "%ANDROID_DIR%" || exit /b 1

if exist "%ANDROID_DIR%\app\.cxx" rmdir /s /q "%ANDROID_DIR%\app\.cxx"
if exist "%ANDROID_DIR%\app\build" rmdir /s /q "%ANDROID_DIR%\app\build"
if exist "%ANDROID_DIR%\build" rmdir /s /q "%ANDROID_DIR%\build"
if exist "%ANDROID_DIR%\.gradle" rmdir /s /q "%ANDROID_DIR%\.gradle"

for /f "delims=" %%D in ('dir /b /s /ad "%STAGE_DIR%\node_modules\*\android\build" "%STAGE_DIR%\node_modules\@*\*\android\build" 2^>nul') do rmdir /s /q "%%D"

echo Building release APK...
echo Log: %BUILD_LOG%
call gradlew.bat assembleRelease --gradle-user-home "%GRADLE_USER_HOME%" --no-daemon --no-watch-fs --max-workers=1 -PreactNativeArchitectures=arm64-v8a --stacktrace > "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Last log lines:
  powershell -NoProfile -Command "Get-Content -LiteralPath '%BUILD_LOG%' -Tail 80"
  echo.
  echo Full log saved at:
  echo %BUILD_LOG%
  exit /b %errorlevel%
)

copy /Y "%ANDROID_DIR%\app\build\outputs\apk\release\app-release.apk" "%PROJECT_ROOT%\AttendancePro-release.apk" >nul

echo.
echo APK ready:
echo %ANDROID_DIR%\app\build\outputs\apk\release\app-release.apk
echo %PROJECT_ROOT%\AttendancePro-release.apk
