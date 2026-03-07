#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[osint]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; }

# ─── Parse args ──────────────────────────────────────────────────────────────
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BUILD_FRONTEND=false
PROD_MODE=false

for arg in "$@"; do
  case $arg in
    --build)   BUILD_FRONTEND=true ;;
    --prod)    PROD_MODE=true; BUILD_FRONTEND=true ;;
    --port=*)  BACKEND_PORT="${arg#*=}" ;;
    --help|-h)
      echo "Usage: ./run.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --build          Build frontend before starting (recommended for first run)"
      echo "  --prod           Production mode: build frontend + serve via uvicorn static"
      echo "  --port=PORT      Backend port (default: 8000)"
      echo "  BACKEND_PORT=X   Same as --port (env var)"
      echo "  FRONTEND_PORT=X  Frontend dev server port (default: 5173)"
      exit 0
    ;;
  esac
done

# ─── Check Python ─────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  err "python3 not found. Please install Python 3.9+"
  exit 1
fi

PYTHON=$(command -v python3)
log "Python: $($PYTHON --version)"

# ─── Backend virtualenv ───────────────────────────────────────────────────────
VENV="$BACKEND_DIR/.venv"
if [ ! -d "$VENV" ]; then
  log "Creating Python virtual environment..."
  $PYTHON -m venv "$VENV"
fi

PIP="$VENV/bin/pip"
UVICORN="$VENV/bin/uvicorn"

log "Installing/updating backend dependencies..."
"$PIP" install -q --upgrade pip
"$PIP" install -q -r "$BACKEND_DIR/requirements.txt"
ok "Backend dependencies ready"

# ─── Frontend ─────────────────────────────────────────────────────────────────
if [ "$BUILD_FRONTEND" = true ] || [ "$PROD_MODE" = true ]; then
  if ! command -v node &>/dev/null; then
    warn "Node.js not found — skipping frontend build (API-only mode)"
  else
    log "Node: $(node --version) / npm: $(npm --version)"
    log "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install --silent
    log "Building frontend..."
    npm run build
    ok "Frontend built to $FRONTEND_DIR/dist"
    cd "$SCRIPT_DIR"
  fi
fi

# ─── Copy built frontend to backend static dir (prod mode) ────────────────────
if [ "$PROD_MODE" = true ] && [ -d "$FRONTEND_DIR/dist" ]; then
  log "Copying frontend dist to backend/static..."
  mkdir -p "$BACKEND_DIR/static"
  cp -r "$FRONTEND_DIR/dist/." "$BACKEND_DIR/static/"
  ok "Static files ready"
fi

# ─── Trap for cleanup ─────────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  ok "Stopped."
}
trap cleanup INT TERM EXIT

# ─── Start backend ────────────────────────────────────────────────────────────
log "Starting backend on http://0.0.0.0:$BACKEND_PORT ..."
cd "$BACKEND_DIR"
"$UVICORN" app.main:app \
  --host 0.0.0.0 \
  --port "$BACKEND_PORT" \
  --reload \
  --reload-dir app \
  --log-level info &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)
cd "$SCRIPT_DIR"

# Wait for backend to be ready
sleep 1
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  err "Backend failed to start. Check logs above."
  exit 1
fi
ok "Backend running (PID $BACKEND_PID)"

# ─── Start frontend dev server (non-prod) ─────────────────────────────────────
if [ "$PROD_MODE" = false ]; then
  if ! command -v node &>/dev/null; then
    warn "Node.js not found — frontend dev server not started"
    warn "API available at: http://localhost:$BACKEND_PORT"
    warn "API docs at:      http://localhost:$BACKEND_PORT/docs"
  else
    log "Starting frontend dev server on http://localhost:$FRONTEND_PORT ..."
    cd "$FRONTEND_DIR"
    # Install deps if needed
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
      log "Installing frontend dependencies..."
      npm install --silent
    fi
    # Use local node_modules/.bin/vite to avoid any system-level vite binary conflicts
    VITE_BIN="./node_modules/.bin/vite"
    VITE_API_URL="" "$VITE_BIN" --port "$FRONTEND_PORT" &
    FRONTEND_PID=$!
    PIDS+=($FRONTEND_PID)
    cd "$SCRIPT_DIR"
    ok "Frontend dev server running (PID $FRONTEND_PID)"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       OSINT Graph Platform — Running             ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  🌐 App:     ${CYAN}http://localhost:$FRONTEND_PORT${NC}            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ⚙️  API:     ${CYAN}http://localhost:$BACKEND_PORT/api${NC}         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  📖 Docs:    ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Press ${RED}Ctrl+C${NC} to stop                           ${GREEN}║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
  fi
else
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║    OSINT Graph Platform — Production Mode        ║${NC}"
  echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
  echo -e "${GREEN}║${NC}  🌐 App:     ${CYAN}http://localhost:$BACKEND_PORT${NC}            ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  📖 API:     ${CYAN}http://localhost:$BACKEND_PORT/docs${NC}         ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}                                                  ${GREEN}║${NC}"
  echo -e "${GREEN}║${NC}  Press ${RED}Ctrl+C${NC} to stop                           ${GREEN}║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
fi

# ─── Wait ─────────────────────────────────────────────────────────────────────
wait
