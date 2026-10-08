<#
.SYNOPSIS
    AI 作战概念研究工作台 (Combat Concept AI Workbench) - PowerShell 快速启动脚本

.DESCRIPTION
    一键检测运行环境、配置端口与持久化模式、拉起工作台核心服务并自动在浏览器中打开。
    支持自定义端口、纯环境检查、关闭自动拉起浏览器等多种选项。

.PARAMETER Port
    工作台服务监听端口，默认 8792。

.PARAMETER NoBrowser
    启动后不自动在默认浏览器中打开页面。

.PARAMETER CheckOnly
    仅执行环境与依赖检查，不实际启动服务。

.PARAMETER StorageMode
    数据持久化模式，默认 sqlite (建议生产与常态研究使用)。仅测试时可选 file。

.PARAMETER ConceptMapTool
    是否允许自动拉起独立概念图绘制工具 (combat-map-web，默认 true)。

.EXAMPLE
    .\start.ps1
    # 使用默认配置 (8792 端口，SQLite 存储，自动打开浏览器) 快速启动

.EXAMPLE
    .\start.ps1 -Port 8793 -NoBrowser
    # 在 8793 端口启动且不自动打开浏览器

.EXAMPLE
    .\start.ps1 -CheckOnly
    # 仅检查系统 Node.js、端口、数据库和依赖就绪状态
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [int]$Port = 8792,

    [switch]$NoBrowser,

    [switch]$CheckOnly,

    [ValidateSet("sqlite", "file")]
    [string]$StorageMode = "sqlite",

    [ValidateSet("true", "false")]
    [string]$ConceptMapTool = "true"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# 切换至项目根目录
$ProjectRoot = $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host "   $Text" -ForegroundColor White
    Write-Host ("=" * 72) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Text)
    Write-Host " [√] $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host " [i] $Text" -ForegroundColor DarkCyan
}

function Write-Warn {
    param([string]$Text)
    Write-Host " [!] $Text" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Text)
    Write-Host " [×] $Text" -ForegroundColor Red
}

Write-Header "AI 作战概念研究工作台 (Combat Concept AI Workbench) 快速启动"

# 1. 检查 Node.js 环境
$NodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Err "未在系统环境变量 PATH 中找到 Node.js！"
    Write-Host "------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "本工作台依赖 Node.js (推荐 v22.5.0 或更高的 LTS/当前版本以支持原生 SQLite 引擎)。" -ForegroundColor Yellow
    Write-Host "请前往官网下载安装: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------------" -ForegroundColor DarkGray
    exit 1
}

$NodeVersionRaw = (& node -v 2>$null).Trim()
Write-Success "Node.js 环境已就绪: $NodeVersionRaw ($($NodeCmd.Source))"

# 检查 Node.js 主版本
try {
    $MajorVersion = [int]($NodeVersionRaw.TrimStart('v').Split('.')[0])
    if ($MajorVersion -lt 22) {
        Write-Warn "当前 Node.js 版本低于 v22.5.0，可能无法使用原生 node:sqlite 数据库。"
        Write-Warn "建议升级至 Node.js v22.5+ 或 v24+。"
    }
} catch {
    # 忽略版本解析小异常
}

# 2. 检查数据与存储环境
$DataDir = Join-Path $ProjectRoot "data"
if (-not (Test-Path -LiteralPath $DataDir)) {
    New-Item -ItemType Directory -LiteralPath $DataDir -Force | Out-Null
}

$SqliteDb = Join-Path $DataDir "projects.sqlite"
if (Test-Path -LiteralPath $SqliteDb) {
    $DbSize = [math]::Round(((Get-Item -LiteralPath $SqliteDb).Length / 1KB), 1)
    Write-Success "项目数据库: 已就绪 ($SqliteDb, $DbSize KB)"
} else {
    Write-Info "项目数据库: $SqliteDb (首次启动将自动从 projects.json 导入或新建)"
}

$CmoDb = Join-Path $DataDir "DB3K_510.db3"
if (Test-Path -LiteralPath $CmoDb) {
    $CmoSize = [math]::Round(((Get-Item -LiteralPath $CmoDb).Length / 1MB), 1)
    Write-Success "CMO 装备库: 已就绪 (DB3K_510.db3, $CmoSize MB)"
} else {
    Write-Warn "CMO 装备库: 未找到 $CmoDb (装备推荐将降级为概念词映射)"
}

# 3. 检查独立概念图工具目录
$MapToolPath = Resolve-Path (Join-Path $ProjectRoot "..\combat-map-web\server.py") -ErrorAction SilentlyContinue
if ($MapToolPath -and (Test-Path -LiteralPath $MapToolPath)) {
    Write-Success "概念图工具: 已就绪 ($MapToolPath，默认端口 8765)"
} else {
    Write-Info "概念图工具: 独立目录未就绪 (不影响工作台主流程)"
}

# 4. 检查 AI 服务配置
$AiConfigFile = Join-Path $ProjectRoot "ai-service-config.json"
if (Test-Path -LiteralPath $AiConfigFile) {
    try {
        $AiConfig = Get-Content -LiteralPath $AiConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $Provider = $AiConfig.provider
        $Model = $AiConfig.model
        Write-Success "AI 服务配置: 提供商 [$Provider], 模型 [$Model]"
    } catch {
        Write-Info "AI 服务配置: 已存在 ($AiConfigFile)"
    }
} else {
    Write-Info "AI 服务配置: 将使用内置预设 (首次启动后可在右上角 AI 配置中设定)"
}

# 5. 检测端口与健康状态
$WorkbenchUrl = "http://127.0.0.1:$Port/"
$HealthUrl = "http://127.0.0.1:$Port/api/health"

Write-Host ""
Write-Host "正在检测端口 $Port 状态..." -ForegroundColor DarkGray

# 快速 TCP 端口探活 (毫秒级响应，避免卡顿等待)
$PortOpen = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $async = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(250, $false)) {
        $tcp.EndConnect($async)
        $PortOpen = $true
    }
    $tcp.Close()
} catch {
    $PortOpen = $false
}

if ($PortOpen) {
    # 端口已被占用，进一步判断是否是工作台服务
    $ServerHealthy = $false
    try {
        $HealthResponse = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($HealthResponse -and $HealthResponse.ok -eq $true) {
            $ServerHealthy = $true
        }
    } catch {
        $ServerHealthy = $false
    }

    if ($ServerHealthy) {
        Write-Header "工作台服务当前已在运行中"
        Write-Success "服务地址: $WorkbenchUrl"
        Write-Success "持久化模式: $($HealthResponse.projectRepository.mode)"
        Write-Success "AI 模型: $($HealthResponse.model) ($($HealthResponse.provider))"
        
        if (-not $NoBrowser) {
            Write-Host ""
            Write-Host "正在为您在默认浏览器中打开工作台..." -ForegroundColor Green
            Start-Process $WorkbenchUrl
        }
        
        Write-Host ""
        Write-Host "如需停止或重启服务，可运行 .\stop.ps1 或在服务终端按 Ctrl+C。" -ForegroundColor DarkGray
        exit 0
    } else {
        # 端口被非工作台进程占用
        Write-Err "端口 $Port 已被占用，但未响应工作台健康检查！"
        try {
            $OccupyingConns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
            if ($OccupyingConns) {
                Write-Warn "占用进程 PID: $($OccupyingConns[0].OwningProcess)"
            }
        } catch {}
        Write-Host "建议运行 .\stop.ps1 终止冲突进程，或指定其他端口运行：" -ForegroundColor Yellow
        Write-Host "    .\start.ps1 -Port 8793" -ForegroundColor Cyan
        exit 1
    }
}

Write-Success "端口 $Port 空闲可用"

if ($CheckOnly) {
    Write-Host ""
    Write-Host "=== 纯检查模式完成：运行环境完全就绪 ===" -ForegroundColor Green
    exit 0
}

# 6. 配置启动环境变量
$env:PORT = "$Port"
$env:PROJECT_STORAGE_MODE = "$StorageMode"
$env:CONCEPT_MAP_TOOL_ENABLED = "$ConceptMapTool"

Write-Header "正在启动工作台核心服务"
Write-Host "服务地址: $WorkbenchUrl" -ForegroundColor Cyan
Write-Host "存储模式: $StorageMode" -ForegroundColor White
Write-Host "概念图联动: $ConceptMapTool" -ForegroundColor White
Write-Host ""
Write-Host "服务就绪后将自动在默认浏览器中打开页面..." -ForegroundColor Green
Write-Host "按 Ctrl + C 可安全停止服务。" -ForegroundColor DarkGray
Write-Host ""

# 7. 后台监测就绪并在健康后自动拉起浏览器
if (-not $NoBrowser) {
    $browserScript = "const p = $Port; const url = 'http://127.0.0.1:' + p + '/'; let count = 0; const timer = setInterval(() => { count++; fetch(url + 'api/health', { signal: AbortSignal.timeout(1000) }).then(r => r.json()).then(d => { if (d && d.ok) { clearInterval(timer); const { exec } = require('node:child_process'); exec('start ' + url); process.exit(0); } }).catch(() => {}); if (count >= 30) { clearInterval(timer); process.exit(0); } }, 400);"
    Start-Process -FilePath "node" -ArgumentList @("-e", $browserScript) -WindowStyle Hidden | Out-Null
}

# 8. 启动服务器前台进程
& node "server.mjs"
