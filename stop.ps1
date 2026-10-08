<#
.SYNOPSIS
    AI 作战概念研究工作台 - 停止服务脚本 (PowerShell)

.DESCRIPTION
    查找并安全停止占用 8792 端口的工作台服务进程；支持通过 -All 同时停止 8765 概念图绘制工具。

.PARAMETER Port
    目标端口，默认 8792。

.PARAMETER All
    同时检测并停止 8765 端口的独立概念图工具。

.EXAMPLE
    .\stop.ps1
    # 停止 8792 端口的工作台主服务

.EXAMPLE
    .\stop.ps1 -All
    # 同时停止 8792 工作台主服务与 8765 概念图绘制工具
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [int]$Port = 8792,

    [switch]$All
)

$ErrorActionPreference = "SilentlyContinue"

function Stop-PortProcess {
    param([int]$TargetPort, [string]$ServiceName)
    
    Write-Host "正在检测端口 $TargetPort ($ServiceName)..." -ForegroundColor DarkGray
    $PidsFound = @()
    
    # 尝试 Get-NetTCPConnection
    try {
        $conns = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            if ($c.OwningProcess -and $c.OwningProcess -notin $PidsFound) {
                $PidsFound += $c.OwningProcess
            }
        }
    } catch {}

    # 兜底 netstat
    if ($PidsFound.Count -eq 0) {
        $lines = netstat -ano | Select-String ":$TargetPort\s+.*LISTENING"
        foreach ($line in $lines) {
            $tokens = ($line.ToString().Trim() -split '\s+')
            $foundPid = [int]$tokens[-1]
            if ($foundPid -and $foundPid -notin $PidsFound) {
                $PidsFound += $foundPid
            }
        }
    }

    if ($PidsFound.Count -eq 0) {
        Write-Host " [i] 端口 $TargetPort 当前未被占用 ($ServiceName 未运行)。" -ForegroundColor Cyan
        return
    }

    foreach ($pidToStop in $PidsFound) {
        $p = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
        $pName = if ($p) { $p.ProcessName } else { "PID $pidToStop" }
        Write-Host " [!] 发现进程: $pName (PID: $pidToStop)，正在停止..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $pidToStop -Force -ErrorAction Stop
            Write-Host " [√] 成功停止: $pName (PID: $pidToStop)，端口 $TargetPort 已释放。" -ForegroundColor Green
        } catch {
            Write-Host " [×] 停止进程失败: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "   AI 作战概念研究工作台 - 服务终止向导" -ForegroundColor White
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

Stop-PortProcess -TargetPort $Port -ServiceName "工作台核心服务"

if ($All) {
    Write-Host ""
    Stop-PortProcess -TargetPort 8765 -ServiceName "概念图绘制工具"
}

Write-Host ""
Write-Host "操作完成。" -ForegroundColor Green
Write-Host ""
