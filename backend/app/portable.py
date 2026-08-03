import os
import sys


def portable_dir():
    """Directory where all persistent data lives for a packaged desktop app.

    Returns None when running from source (not a frozen/packaged build).
    """
    appimage = os.environ.get("APPIMAGE")
    if appimage:
        return os.path.dirname(os.path.abspath(appimage))
    if getattr(sys, "frozen", False):
        return os.path.dirname(os.path.abspath(sys.executable))
    return None
