# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the OSINT Graph Platform desktop app.

Works for both Linux (AppImage base) and Windows (wine) builds.
The built frontend must be staged at <repo>/build/stage/static beforehand
(build.sh does this).
"""
import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata

HERE = Path(os.path.abspath(SPECPATH))
ROOT = HERE.parent

app_name = "osint-graph-platform"

static_dir = ROOT / "build" / "stage" / "static"
if not static_dir.is_dir():
    static_dir = ROOT / "frontend" / "dist"

datas = []
if static_dir.is_dir():
    datas.append((str(static_dir), "static"))

hiddenimports = [
    "app",
    "app.main",
    "app.database",
    "app.models",
    "app.schemas",
    "app.crud",
    "app.auth",
    "app.deps",
    "app.encryption",
    "app.portable",
    "app.routers",
    "app.routers.entities",
    "app.routers.relationships",
    "app.routers.search",
    "app.routers.import_data",
    "app.routers.stats",
    "app.routers.entity_schemas",
    "app.routers.backup",
    "app.routers.webdav_sync",
    "app.routers.attachments",
    "app.routers.relationship_types",
    "app.routers.auth",
    "app.routers.admin",
    "app.routers.entity_groups",
    "app.routers.open_search",
    "uvicorn.logging",
    "uvicorn.loops.asyncio",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "multipart",
    "email_validator",
    "bcrypt",
]

for pkg in ("fastapi", "starlette", "uvicorn", "sqlalchemy", "pydantic",
            "jose", "bcrypt", "cryptography", "httpx", "multipart",
            "email_validator", "anyio"):
    hiddenimports += collect_submodules(pkg)
    datas += collect_data_files(pkg)

datas += copy_metadata("pydantic")
datas += copy_metadata("fastapi")

a = Analysis(
    [str(HERE / "desktop_app.py")],
    pathex=[str(ROOT / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name=app_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
