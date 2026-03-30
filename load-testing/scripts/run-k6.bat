@echo off
REM ###############################################################################
REM K6 Load Test Runner Script for Windows
REM 
REM This script runs K6 load tests with proper configuration and
REM generates comprehensive reports.
REM
REM Usage:
REM   run-k6.bat [target_url]
REM
REM Example:
REM   run-k6.bat http://localhost:3000
REM ###############################################################################

setlocal enabledelayedexpansion

REM Default values
set "TARGET_URL=%1"
if "%TARGET_URL%"=="" set "TARGET_URL=http://localhost:3000"

set "OUTPUT_DIR=load-testing\reports"
set "TIMESTAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "RESULTS_FILE=%OUTPUT_DIR%\k6-results-%TIMESTAMP%.json"
set "SUMMARY_FILE=%OUTPUT_DIR%\k6-summary-%TIMESTAMP%.json"

REM Print banner
echo.
echo ================================================================
echo            K6 Load Testing - MarketX Backend
echo ================================================================
echo.

REM Create output directory if it doesn't exist
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM Check if K6 is installed
where k6 >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] K6 is not installed
    echo Install from: https://k6.io/docs/getting-started/installation/
    exit /b 1
)

echo [OK] K6 is installed

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
echo   Virtual Users:   200
echo   Duration:        5 minutes (peak)
echo   Config File:     load-testing\k6\load-test.js
echo   Results File:    %RESULTS_FILE%
echo   Summary File:    %SUMMARY_FILE%
echo   Timestamp:       %TIMESTAMP%
echo.

REM Confirm before running
echo Press any key to start the load test, or Ctrl+C to cancel...
pause >nul

REM Run K6 test
echo.
echo Starting K6 load test...
echo This will take approximately 7 minutes (1m warmup + 5m peak + 1m cooldown)
echo.

set "TARGET_URL=%TARGET_URL%" && set "ENVIRONMENT=staging" && k6 run --out json="%RESULTS_FILE%" --summary-export="%SUMMARY_FILE%" load-testing\k6\load-test.js

REM Check if test completed successfully
if %errorlevel% equ 0 (
    echo.
    echo [OK] Load test completed successfully
    echo.
    echo ================================================================
    echo Test Summary
    echo ================================================================
    echo.
    echo Results saved to: %RESULTS_FILE%
    echo Summary saved to: %SUMMARY_FILE%
    echo.
    echo Next Steps:
    echo   1. Review detailed results in JSON files
    echo   2. Analyze summary metrics
    echo   3. Identify performance bottlenecks
    echo   4. Monitor system resources (CPU, memory, database)
    echo   5. Implement optimizations (indexing, caching, etc.)
    echo   6. Re-run tests to validate improvements
    echo.
    echo Recommendations:
    echo   - Focus optimization efforts on high-weight scenarios
    echo   - Review database query plans for filtered queries
    echo   - Consider implementing Redis caching
    echo   - Monitor database connection pool utilization
    echo.
) else (
    echo.
    echo [ERROR] Load test failed
    echo Check the logs above for error details
    exit /b 1
)

echo [OK] All done!
echo.

endlocal
