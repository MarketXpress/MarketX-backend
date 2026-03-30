@echo off
REM ###############################################################################
REM Artillery Load Test Runner Script for Windows
REM 
REM This script runs Artillery load tests with proper configuration and
REM generates comprehensive reports.
REM
REM Usage:
REM   run-artillery.bat [target_url]
REM
REM Example:
REM   run-artillery.bat http://localhost:3000
REM ###############################################################################

setlocal enabledelayedexpansion

REM Default values
set "TARGET_URL=%1"
if "%TARGET_URL%"=="" set "TARGET_URL=http://localhost:3000"

set "OUTPUT_DIR=load-testing\reports"
set "TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "RESULTS_FILE=%OUTPUT_DIR%\artillery-results-%TIMESTAMP%.json"
set "REPORT_FILE=%OUTPUT_DIR%\artillery-report-%TIMESTAMP%.html"

REM Print banner
echo.
echo ================================================================
echo          Artillery Load Testing - MarketX Backend
echo ================================================================
echo.

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Check if Artillery is installed
where artillery >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Artillery is not installed
    echo Install with: npm install -g artillery
    exit /b 1
)

echo [OK] Artillery is installed

REM Verify target is reachable
echo.
echo Checking target availability...
curl -s --head --request GET "%TARGET_URL%" | findstr /C:"200" /C:"404" /C:"401" >nul
if %errorlevel% equ 0 (
    echo [OK] Target is reachable: %TARGET_URL%
) else (
    echo [ERROR] Target is not reachable: %TARGET_URL%
    echo Make sure your application is running
    exit /b 1
)

REM Display test configuration
echo.
echo Test Configuration:
echo   Target URL:      %TARGET_URL%
echo   Config File:     load-testing\artillery\load-test.yml
echo   Results File:    %RESULTS_FILE%
echo   Report File:     %REPORT_FILE%
echo   Timestamp:       %TIMESTAMP%
echo.

REM Confirm before running
echo Press any key to start the load test, or Ctrl+C to cancel...
pause >nul

REM Run Artillery test
echo.
echo Starting Artillery load test...
echo This will take approximately 7 minutes (1m warmup + 5m peak + 1m cooldown)
echo.

set "TARGET_URL=%TARGET_URL%" && artillery run --output "%RESULTS_FILE%" load-testing\artillery\load-test.yml

REM Check if test completed successfully
if %errorlevel% equ 0 (
    echo.
    echo [OK] Load test completed successfully
    
    REM Generate HTML report
    echo.
    echo Generating HTML report...
    artillery report "%RESULTS_FILE%" --output "%REPORT_FILE%"
    
    if %errorlevel% equ 0 (
        echo [OK] Report generated: %REPORT_FILE%
        echo.
        echo ================================================================
        echo Test Summary
        echo ================================================================
        echo.
        echo Results saved to: %RESULTS_FILE%
        echo HTML report:      %REPORT_FILE%
        echo.
        echo Next Steps:
        echo   1. Open the HTML report in your browser
        echo   2. Analyze performance bottlenecks
        echo   3. Review error patterns
        echo   4. Compare with baseline metrics
        echo   5. Document findings and optimizations
        echo.
        
        REM Ask to open report
        set /p "OPEN_REPORT=Open report in browser? (y/n): "
        if /i "!OPEN_REPORT!"=="y" start "" "%REPORT_FILE%"
    ) else (
        echo [ERROR] Failed to generate report
        exit /b 1
    )
) else (
    echo.
    echo [ERROR] Load test failed
    echo Check the logs above for error details
    exit /b 1
)

echo.
echo [OK] All done!
echo.

endlocal
