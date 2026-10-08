#!/usr/bin/env bash
# =============================================================================
# AI 作战概念研究工作台 (Combat Concept AI Workbench) - 跨平台 Shell 启动脚本
# 支持系统：Git Bash / MSYS2 / WSL / Linux / macOS
# =============================================================================

set -e

# 定位脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-8792}"
NO_BROWSER=0
CHECK_ONLY=0

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    [0-9]*)
      PORT="$1"
      shift
      ;;
    *)
      echo "未知参数: $1"
      echo "用法: $0 [端口号] [--no-browser] [--check-only]"
      exit 1
      ;;
  esac
done

export PORT="$PORT"
WORKBENCH_URL="http://127.0.0.1:${PORT}/"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

echo "========================================================================="
echo "   AI 作战概念研究工作台 (Combat Concept AI Workbench) - 启动向导"
echo "========================================================================="

# 1. 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js！"
  echo "请安装 Node.js (推荐 v22.5.0+ 或 v24+): https://nodejs.org/"
  exit 1
fi

NODE_VER="$(node -v)"
echo "[√] Node.js 环境: ${NODE_VER}"

# 2. 检查数据目录
mkdir -p data
if [ -f "data/projects.sqlite" ]; then
  echo "[√] 项目数据库: 已就绪 (data/projects.sqlite)"
else
  echo "[i] 项目数据库: 将自动初始化 (data/projects.sqlite)"
fi

if [ -f "data/DB3K_510.db3" ]; then
  echo "[√] CMO 装备库: 已就绪 (data/DB3K_510.db3)"
else
  echo "[!] CMO 装备库: 未找到 data/DB3K_510.db3 (装备推荐将降级)"
fi

# 打开浏览器的跨平台辅助函数
open_browser() {
  local target_url="$1"
  if command -v start.exe >/dev/null 2>&1; then
    start.exe "$target_url" >/dev/null 2>&1 &
  elif command -v explorer.exe >/dev/null 2>&1; then
    explorer.exe "$target_url" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$target_url" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$target_url" >/dev/null 2>&1 &
  else
    echo "[提示] 请手动在浏览器中打开: $target_url"
  fi
}

# 3. 检查服务是否已经在运行
echo "正在检测端口 ${PORT} 状态..."
STATUS_CODE=0
node -e "fetch('http://127.0.0.1:' + process.argv[1] + '/api/health', { signal: AbortSignal.timeout(1200) }).then(r=>r.json()).then(d=>{if(d.ok)process.exit(10);else process.exit(11);}).catch(()=>process.exit(0));" "$PORT" || STATUS_CODE=$?

if [ "$STATUS_CODE" -eq 10 ]; then
  echo ""
  echo "========================================================================="
  echo "[提示] 工作台服务当前已在运行中: ${WORKBENCH_URL}"
  echo "========================================================================="
  if [ "$NO_BROWSER" -eq 0 ]; then
    echo "正在为您在默认浏览器中打开页面..."
    open_browser "$WORKBENCH_URL"
  fi
  exit 0
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "[√] 环境与依赖检查完毕，所有配置正常。"
  exit 0
fi

echo "[√] 端口 ${PORT} 空闲可用。"
echo ""
echo "========================================================================="
echo "正在启动 AI 作战概念研究工作台服务..."
echo "访问地址: ${WORKBENCH_URL}"
echo "按 Ctrl + C 可安全停止服务。"
echo "========================================================================="
echo ""

# 4. 后台监听并自动打开浏览器
if [ "$NO_BROWSER" -eq 0 ]; then
  (
    for i in {1..30}; do
      sleep 0.5
      READY_CODE=0
      node -e "fetch('http://127.0.0.1:' + process.argv[1] + '/api/health', { signal: AbortSignal.timeout(1000) }).then(r=>r.json()).then(d=>{if(d.ok)process.exit(10);else process.exit(0);}).catch(()=>process.exit(0));" "$PORT" || READY_CODE=$?
      if [ "$READY_CODE" -eq 10 ]; then
        open_browser "$WORKBENCH_URL"
        break
      fi
    done
  ) >/dev/null 2>&1 &
fi

# 5. 启动服务器前台
exec node server.mjs
