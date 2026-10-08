@echo off
@rem =========================================================================
@rem AI 作战概念研究工作台 (Combat Concept AI Workbench) - 停止服务脚本
@rem 用途：安全终止正在运行的工作台服务进程（释放 8792 端口）
@rem =========================================================================
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0"
title 停止 AI 作战概念研究工作台服务

echo.
echo =========================================================================
echo       AI 作战概念研究工作台 - 停止服务与释放端口
echo =========================================================================
echo.

set TARGET_PORT=8792
if not "%~1"=="" set TARGET_PORT=%~1

echo 正在检索端口 %TARGET_PORT% 对应的进程...

rem 使用 powershell 准确定位监听该端口的 PID 并关闭
powershell -NoProfile -Command ^
  "$port = %TARGET_PORT%; " ^
  "$killed = $false; " ^
  "try { " ^
  "  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; " ^
  "  foreach ($c in $conns) { " ^
  "    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; " ^
  "    if ($proc) { " ^
  "      Write-Host (' [!] 发现目标进程: ' + $proc.ProcessName + ' (PID: ' + $proc.Id + ') 正在占用端口 ' + $port) -ForegroundColor Yellow; " ^
  "      Stop-Process -Id $proc.Id -Force; " ^
  "      Write-Host (' [√] 已成功终止进程: ' + $proc.ProcessName + ' (PID: ' + $proc.Id + ')') -ForegroundColor Green; " ^
  "      $killed = $true; " ^
  "    } " ^
  "  } " ^
  "} catch {} " ^
  "if (-not $killed) { " ^
  "  $lines = netstat -ano | Select-String (': ' + $port + '\s+.*LISTENING'); " ^
  "  foreach ($line in $lines) { " ^
  "    $tokens = ($line.ToString().Trim() -split '\s+'); " ^
  "    $pidVal = $tokens[-1]; " ^
  "    if ($pidVal -match '^\d+$') { " ^
  "      try { " ^
  "        $p = Get-Process -Id [int]$pidVal -ErrorAction SilentlyContinue; " ^
  "        Write-Host (' [!] 正在终止 PID: ' + $pidVal + ' (' + $p.ProcessName + ')') -ForegroundColor Yellow; " ^
  "        Stop-Process -Id [int]$pidVal -Force; " ^
  "        Write-Host (' [√] 已成功释放端口 ' + $port) -ForegroundColor Green; " ^
  "        $killed = $true; " ^
  "      } catch {} " ^
  "    } " ^
  "  } " ^
  "} " ^
  "if (-not $killed) { " ^
  "  Write-Host (' [i] 端口 ' + $port + ' 当前未被占用，无正在运行的服务。') -ForegroundColor Cyan; " ^
  "}"

echo.
echo =========================================================================
echo 操作已完成。
echo =========================================================================
echo.
if "%~2"=="" (
    timeout /t 3 >nul 2>&1 || pause
)
