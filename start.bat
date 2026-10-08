@echo off
@rem =========================================================================
@rem AI 作战概念研究工作台 (Combat Concept AI Workbench) - 快速启动脚本
@rem 用途：双击直接运行或在 CMD 中启动工作台服务，包含环境检测与浏览器自动拉起
@rem 端口：默认 8792 (http://127.0.0.1:8792/)
@rem =========================================================================
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"
title AI 作战概念研究工作台 (Port: 8792)

echo.
echo =========================================================================
echo       AI 作战概念研究工作台 (Combat Concept AI Workbench)
echo                  快速启动向导与运行环境检查
echo =========================================================================
echo.

rem 1. 检查 Node.js 环境
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未在系统 PATH 中找到 Node.js！
    echo ---------------------------------------------------------------------
    echo 本工作台依赖 Node.js (推荐 v22.5.0 或更高版本以支持原生 SQLite 引擎)。
    echo 请前往官方网站下载并安装 Node.js LTS 版本:
    echo     https://nodejs.org/
    echo ---------------------------------------------------------------------
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VERSION=%%i
echo [√] Node.js 环境: %NODE_VERSION%

rem 检查 Node.js 大版本号（建议 >= 22）
node -e "const v = parseInt(process.versions.node.split('.')[0], 10); if (v < 22) process.exit(1);" >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 当前 Node.js 版本低于 v22.5.0，可能无法使用原生 node:sqlite 数据库。
    echo        建议升级至 Node.js v22.5+ 或 v24+。
)

rem 2. 端口与参数配置
set PORT=8792
if not "%~1"=="" set PORT=%~1
set WORKBENCH_URL=http://127.0.0.1:%PORT%/

rem 3. 检查数据与关键文件状态
if not exist "data" mkdir "data" >nul 2>&1
if exist "data\projects.sqlite" (
    echo [√] 持久化存储: SQLite (data\projects.sqlite)
) else (
    echo [i] 持久化存储: SQLite (首次运行将自动初始化 data\projects.sqlite)
)

if exist "data\DB3K_510.db3" (
    echo [√] CMO 装备库: 已就绪 (data\DB3K_510.db3)
) else (
    echo [!] CMO 装备库: 未找到 data\DB3K_510.db3 (相关装备检索功能将降级)
)

rem 4. 检查概念图绘制工具环境
if exist "..\combat-map-web\server.py" (
    echo [√] 概念图工具: 已就绪 (..\combat-map-web\server.py，端口 8765 将由服务端自动拉起)
) else (
    echo [i] 概念图工具: 独立目录未就绪 (不影响主工作台核心功能)
)

rem 5. 检查端口是否已经被工作台或其它程序占用
echo.
echo 正在检查端口 %PORT% 状态...
node -e "fetch('http://127.0.0.1:' + process.argv[1] + '/api/health', { signal: AbortSignal.timeout(1200) }).then(r=>r.json()).then(d=>{if(d.ok)process.exit(10);else process.exit(11);}).catch(()=>process.exit(0));" %PORT% >nul 2>&1
set HEALTH_STATUS=%errorlevel%

if "%HEALTH_STATUS%"=="10" (
    echo.
    echo =========================================================================
    echo [提示] AI 作战概念研究工作台当前已在运行中！
    echo 访问地址: %WORKBENCH_URL%
    echo ---------------------------------------------------------------------
    echo 正在为您在默认浏览器中直接打开工作台页面...
    echo =========================================================================
    start %WORKBENCH_URL%
    echo.
    echo 如需重启服务，可先运行 stop.bat 终止旧进程，再重新运行此脚本。
    echo 按任意键关闭本提示窗口...
    pause >nul
    exit /b 0
)

rem 检查是否有其它非工作台程序占用了该端口
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [错误] 端口 %PORT% 已被其他程序占用，且并非工作台健康实例！
    echo 请检查占用端口的进程或运行 stop.bat 释放端口，也可以指定其他端口：
    echo     start.bat 8793
    echo.
    pause
    exit /b 1
)

echo [√] 端口 %PORT% 空闲可用。
echo.
echo =========================================================================
echo 正在启动 AI 作战概念研究工作台...
echo 入口地址: %WORKBENCH_URL%
echo 服务就绪后将自动在默认浏览器中打开页面。
echo 按 Ctrl + C 可随时停止服务。
echo =========================================================================
echo.

rem 6. 后台等待健康检查就绪并自动打开浏览器 (最多等待 15 秒)
start "" /b node -e "const p = process.argv[1]; const url = 'http://127.0.0.1:' + p + '/'; let count = 0; const timer = setInterval(() => { count++; fetch(url + 'api/health', { signal: AbortSignal.timeout(1000) }).then(r => r.json()).then(d => { if (d && d.ok) { clearInterval(timer); const { exec } = require('node:child_process'); exec('start ' + url); process.exit(0); } }).catch(() => {}); if (count >= 30) { clearInterval(timer); process.exit(0); } }, 500);" %PORT%

rem 7. 启动 Node.js 服务器主进程
set PORT=%PORT%
node server.mjs

rem 若异常退出则暂停窗口，方便查看错误详情
if %errorlevel% neq 0 (
    echo.
    echo [提示] 工作台服务已退出 (退出码: %errorlevel%)。
    pause
)
