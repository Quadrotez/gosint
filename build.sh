#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  build.sh — собирает OSINT Graph Platform в портативные настольные приложения
#
#  Результат кладётся в build/:
#    * AppImage (Linux)  — build/OSINT-Graph-Platform-<VERSION>-x86_64.AppImage
#    * exe      (Windows) — build/OSINT-Graph-Platform-<VERSION>-win64.exe
#
#  Портативный режим: все данные (SQLite, логи, профиль браузера) пишутся
#  рядом с исполняемым файлом.
#
#  Требования: docker не нужен; нужны python3, node/npm, и для exe — wine.
#
#  Использование:
#    ./build.sh                     # собрать AppImage и exe
#    ./build.sh --appimage          # только AppImage
#    ./build.sh --exe               # только exe
#    ./build.sh --version=3.4.0     # задать версию (по умолчанию 3.3.0)
#    ./build.sh --clean             # очистить build/ и выйти
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$ROOT/build"
DESKTOP_DIR="$ROOT/desktop"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_DIR="$ROOT/backend"

APP_NAME="osint-graph-platform"
APP_TITLE="OSINT Graph Platform"
VERSION="${OSINT_VERSION:-3.3.0}"

TARGET_APPIMAGE=0
TARGET_EXE=0

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${CYAN}[build]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1" >&2; }

for arg in "$@"; do
  case $arg in
    --appimage)        TARGET_APPIMAGE=1 ;;
    --exe)             TARGET_EXE=1 ;;
    --all)             TARGET_APPIMAGE=1; TARGET_EXE=1 ;;
    --version=*)       VERSION="${arg#*=}" ;;
    --clean)           rm -rf "$BUILD_DIR"; ok "build/ очищен"; exit 0 ;;
    --help|-h)
      echo "Usage: ./build.sh [--appimage|--exe|--all] [--version=X] [--clean]"
      exit 0 ;;
    *) warn "Неизвестный аргумент: $arg";;
  esac
done

if [ "$TARGET_APPIMAGE" -eq 0 ] && [ "$TARGET_EXE" -eq 0 ]; then
  TARGET_APPIMAGE=1; TARGET_EXE=1
fi

mkdir -p "$BUILD_DIR"

# ─── 1. Сборка фронтенда ─────────────────────────────────────────────────────
log "Сборка фронтенда..."
if [ ! -f "$FRONTEND_DIR/package-lock.json" ]; then
  (cd "$FRONTEND_DIR" && npm install --silent)
else
  (cd "$FRONTEND_DIR" && npm ci --silent)
fi
(cd "$FRONTEND_DIR" && npm run build)
mkdir -p "$BUILD_DIR/stage"
rm -rf "$BUILD_DIR/stage/static"
cp -r "$FRONTEND_DIR/dist" "$BUILD_DIR/stage/static"
ok "Фронтенд собран → $BUILD_DIR/stage/static"

# ─── 2. Python-окружение для сборки ──────────────────────────────────────────
if [ ! -d "$BUILD_DIR/venv" ]; then
  log "Создание виртуального окружения..."
  python3 -m venv "$BUILD_DIR/venv"
fi
log "Установка зависимостей сборки..."
"$BUILD_DIR/venv/bin/pip" install -q --upgrade pip
"$BUILD_DIR/venv/bin/pip" install -q -r "$DESKTOP_DIR/requirements-desktop.txt" pyinstaller
ok "Окружение готово"

PYINSTALLER="$BUILD_DIR/venv/bin/pyinstaller"

# ─── 3. AppImage (Linux) ─────────────────────────────────────────────────────
build_appimage() {
  log "Сборка Linux-бинаря (PyInstaller)..."
  "$PYINSTALLER" --clean --noconfirm \
    --distpath "$BUILD_DIR/dist-linux" \
    --workpath "$BUILD_DIR/work-linux" \
    "$DESKTOP_DIR/osint.spec"

  APPIMAGE_BIN="$BUILD_DIR/dist-linux/$APP_NAME"
  [ -f "$APPIMAGE_BIN" ] || { err "Бинарь не найден: $APPIMAGE_BIN"; exit 1; }

  APPDIR="$BUILD_DIR/appdir"
  rm -rf "$APPDIR"
  mkdir -p "$APPDIR/usr/bin"

  cp "$APPIMAGE_BIN" "$APPDIR/usr/bin/$APP_NAME"
  chmod +x "$APPDIR/usr/bin/$APP_NAME"

  cat > "$APPDIR/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
exec "$HERE/usr/bin/osint-graph-platform" "$@"
EOF
  chmod +x "$APPDIR/AppRun"

  cat > "$APPDIR/$APP_NAME.desktop" <<EOF
[Desktop Entry]
Name=$APP_TITLE
Comment=OSINT Graph Intelligence Platform
Exec=$APP_NAME
Icon=$APP_NAME
Type=Application
Categories=Utility;Security;
Terminal=false
EOF

  python3 "$DESKTOP_DIR/make_icon.py" "$APPDIR/$APP_NAME.png"

  APPIMAGETOOL="$BUILD_DIR/tools/appimagetool-x86_64.AppImage"
  if [ ! -f "$APPIMAGETOOL" ]; then
    log "Скачивание appimagetool..."
    mkdir -p "$BUILD_DIR/tools"
    curl -sL -o "$APPIMAGETOOL" \
      "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    chmod +x "$APPIMAGETOOL"
  fi

  OUTPUT="$BUILD_DIR/OSINT-Graph-Platform-$VERSION-x86_64.AppImage"
  log "Сборка AppImage..."
  ARCH=x86_64 "$APPIMAGETOOL" --appimage-extract-and-run "$APPDIR" "$OUTPUT"
  chmod +x "$OUTPUT"
  ok "AppImage: $OUTPUT"
}

# ─── 4. exe (Windows) через wine ─────────────────────────────────────────────
WINPY_VERSION="3.12.10"

build_exe() {
  if ! command -v wine >/dev/null 2>&1; then
    err "wine не найден — сборка exe невозможна. Установите wine или используйте --appimage."
    exit 1
  fi
  if ! command -v unzip >/dev/null 2>&1; then
    err "unzip не найден — требуется для распаковки Windows Python."
    exit 1
  fi

  TOOLS="$BUILD_DIR/tools"
  mkdir -p "$TOOLS"

  # Полноценный Windows-Python в виде nuget-пакета (zip, без установщика —
  # установщик python.org нестабилен под wine).
  WINPY_DIR="$TOOLS/winpy"
  WINPY_ARCHIVE="$TOOLS/python-$WINPY_VERSION-nuget.zip"
  WINPY="$WINPY_DIR/python.exe"
  WINPY_URL="https://www.nuget.org/api/v2/package/python/$WINPY_VERSION"

  if [ ! -f "$WINPY_ARCHIVE" ]; then
    log "Скачивание Windows Python $WINPY_VERSION (nuget)..."
    curl -sL -o "$WINPY_ARCHIVE" "$WINPY_URL"
  fi
  if [ ! -f "$WINPY_DIR/python.exe" ]; then
    log "Распаковка Windows Python..."
    mkdir -p "$WINPY_DIR"
    unzip -q -o "$WINPY_ARCHIVE" -d "$WINPY_DIR"
    mv "$WINPY_DIR"/tools/* "$WINPY_DIR/"
    rmdir "$WINPY_DIR/tools" 2>/dev/null || true
  fi

  winpy_ok=0
  for _try in 1 2 3 4 5; do
    if wine "$WINPY" -c "print('winpy ok')" >/dev/null 2>&1; then
      winpy_ok=1
      break
    fi
    sleep 2
  done
  if [ "$winpy_ok" -eq 0 ]; then
    err "Не удалось запустить Windows Python через wine."
    exit 1
  fi

  log "Установка зависимостей для Windows..."
  (cd "$DESKTOP_DIR" && wine "$WINPY" -m pip install --no-warn-script-location -q \
    -r requirements-desktop.txt pyinstaller)

  log "Сборка Windows exe (PyInstaller под wine)..."
  (cd "$ROOT" && wine "$WINPY" -m PyInstaller --clean --noconfirm \
    --distpath "$BUILD_DIR/dist-win" \
    --workpath "$BUILD_DIR/work-win" \
    "$DESKTOP_DIR/osint.spec")

  WIN_EXE="$BUILD_DIR/dist-win/$APP_NAME.exe"
  [ -f "$WIN_EXE" ] || { err "exe не найден: $WIN_EXE"; exit 1; }

  OUTPUT="$BUILD_DIR/OSINT-Graph-Platform-$VERSION-win64.exe"
  cp "$WIN_EXE" "$OUTPUT"
  ok "exe: $OUTPUT"
}

if [ "$TARGET_APPIMAGE" -eq 1 ]; then
  build_appimage
fi

if [ "$TARGET_EXE" -eq 1 ]; then
  build_exe
fi

echo ""
ok "Готово. Артефакты в $BUILD_DIR"
