#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  run_desktop.sh — запускает OSINT Platform как настольное приложение
#
#  Что делает:
#    1. Поднимает backend + frontend (через run.sh --prod или dev)
#    2. Ждёт, пока сервер ответит
#    3. Открывает сайт в Chrome/Chromium в режиме --app (без адресной строки)
#
#  Настройки (менять здесь один раз):
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# Режим запуска: "dev" (Vite dev server) или "prod" (всё через uvicorn)
LAUNCH_MODE="dev"

# Размер окна приложения (ширина x высота)
WINDOW_SIZE="1280,800"

# Имя профиля Chrome для изоляции (не будет мешать личному браузеру)
CHROME_PROFILE_NAME="GOSINTApp"

# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[desktop]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1" >&2; }

# ─── Найти Chrome / Chromium ──────────────────────────────────────────────────
find_browser() {
  local candidates=(
    "google-chrome"
    "google-chrome-stable"
    "chromium"
    "chromium-browser"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "C:/Program Files/Google/Chrome/Application/chrome.exe"
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  )
  for b in "${candidates[@]}"; do
    if command -v "$b" &>/dev/null 2>&1 || [ -f "$b" ]; then
      echo "$b"
      return 0
    fi
  done
  return 1
}

BROWSER=$(find_browser || true)
if [ -z "$BROWSER" ]; then
  err "Google Chrome или Chromium не найден."
  err "Установи Chrome: https://www.google.com/chrome/"
  err "Или задай переменную: BROWSER=/path/to/chrome ./run_desktop.sh"
  exit 1
fi
ok "Браузер: $BROWSER"

# ─── Определить URL приложения ────────────────────────────────────────────────
if [ "$LAUNCH_MODE" = "prod" ]; then
  APP_URL="http://localhost:$BACKEND_PORT"
  RUN_ARGS="--prod --port=$BACKEND_PORT"
else
  APP_URL="http://localhost:$FRONTEND_PORT"
  RUN_ARGS="--port=$BACKEND_PORT"
fi

# ─── Папка профиля Chrome (изолированный, не трогает личный браузер) ──────────
CHROME_PROFILE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/gosint-desktop-profile"
# macOS fallback
[ "$(uname)" = "Darwin" ] && CHROME_PROFILE_DIR="$HOME/Library/Application Support/gosint-desktop-profile"

# ─── Запустить backend + frontend ─────────────────────────────────────────────
log "Запускаем сервер (режим: $LAUNCH_MODE)..."

"$SCRIPT_DIR/run.sh" $RUN_ARGS &
SERVER_PID=$!

cleanup() {
  echo ""
  log "Завершаем..."
  kill "$SERVER_PID" 2>/dev/null || true
  # Закрыть окно Chrome если оно ещё открыто (по профилю)
  # Chrome сам закроется когда процесс сервера умрёт — пользователь увидит ошибку
  wait "$SERVER_PID" 2>/dev/null || true
  ok "Остановлено."
}
trap cleanup INT TERM EXIT

# ─── Подождать пока сервер поднимется ─────────────────────────────────────────
log "Ожидаем запуска сервера на $APP_URL ..."
MAX_WAIT=30
WAITED=0
while ! curl -s --max-time 1 "$APP_URL" > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ "$WAITED" -ge "$MAX_WAIT" ]; then
    err "Сервер не ответил за ${MAX_WAIT}с. Проверь логи выше."
    exit 1
  fi
  # Проверяем что серверный процесс ещё жив
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    err "Серверный процесс неожиданно завершился."
    exit 1
  fi
done
ok "Сервер готов → $APP_URL"

# ─── Открыть в Chrome app mode ────────────────────────────────────────────────
log "Открываем окно приложения..."

"$BROWSER" \
  --app="$APP_URL" \
  --window-size="$WINDOW_SIZE" \
  --user-data-dir="$CHROME_PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-translate \
  --disable-infobars \
  2>/dev/null &

CHROME_PID=$!
ok "Приложение запущено (Chrome PID $CHROME_PID)"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        OSINT Platform — Desktop Mode            ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  🖥️  Окно приложения открыто                    ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🌐 URL:  ${CYAN}$APP_URL${NC}"
echo -e "${GREEN}║${NC}  📖 API:  ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}"
echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Закрой окно приложения или нажми ${RED}Ctrl+C${NC}        ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"

# Ждём пока Chrome закроется — тогда гасим сервер тоже
wait "$CHROME_PID" 2>/dev/null || true
log "Окно закрыто — останавливаем сервер..."