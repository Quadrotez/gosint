"""Desktop launcher for the packaged OSINT Graph Platform.

Starts the FastAPI/uvicorn server on localhost and opens the app in a
dedicated Chromium/Chrome app-mode window. All persistent data (SQLite DB,
logs, browser profile) lives next to the executable (portable mode).
"""
import logging
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser

import uvicorn

from app import main as app_main
from app.portable import portable_dir

DEFAULT_PORT = 8765

BROWSER_CANDIDATES = (
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "msedge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
)


def find_free_port(preferred=DEFAULT_PORT):
    for port in range(preferred, preferred + 200):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return 0


def find_browser():
    for name in BROWSER_CANDIDATES:
        if os.path.isfile(name):
            return name
        if shutil.which(name):
            return name
    return None


def wait_for_server(url, timeout=20):
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.3)
    return False


def main():
    data_dir = portable_dir() or os.getcwd()

    log_file = os.path.join(data_dir, "osint-app.log")
    logging.basicConfig(
        filename=log_file,
        level=logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    port = find_free_port()
    url = f"http://127.0.0.1:{port}"

    config = uvicorn.Config(
        app_main.app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        log_config=None,
        access_log=False,
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    if not wait_for_server(url):
        logging.error("Server failed to start on %s", url)

    browser_proc = None
    browser = find_browser()
    if browser and os.environ.get("OSINT_NO_BROWSER") != "1":
        profile = os.path.join(data_dir, "browser-profile")
        os.makedirs(profile, exist_ok=True)
        cmd = [
            browser,
            f"--app={url}",
            "--window-size=1280,800",
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-translate",
            "--disable-infobars",
        ]
        browser_proc = subprocess.Popen(cmd)
    elif os.environ.get("OSINT_NO_BROWSER") != "1":
        webbrowser.open(url)

    try:
        if browser_proc is not None:
            while browser_proc.poll() is None and server_thread.is_alive():
                time.sleep(1)
        else:
            while server_thread.is_alive():
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.should_exit = True
        server_thread.join(timeout=10)


if __name__ == "__main__":
    sys.exit(main())
