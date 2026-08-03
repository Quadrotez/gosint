"""Generate a simple placeholder PNG icon for the desktop bundle (stdlib only)."""
import struct
import sys
import zlib

W = H = 256


def _chunk(tag, data):
    out = struct.pack(">I", len(data)) + tag + data
    out += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return out


def make_png(path):
    rows = b""
    for y in range(H):
        row = b"\x00"
        for x in range(W):
            dx = x - 128
            dy = y - 128
            d = dx * dx + dy * dy
            if d < 4200 or (abs(x - 90) < 16 and 60 < y < 196) or (abs(y - 128) < 16 and 60 < x < 196):
                r, g, b = 0, 212, 255
            elif d < 14400:
                r, g, b = 56, 189, 248
            else:
                r, g, b = 24, 28, 34
            row += bytes((r, g, b, 255))
        rows += row
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += _chunk(b"IHDR", ihdr)
    png += _chunk(b"IDAT", zlib.compress(rows))
    png += _chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


if __name__ == "__main__":
    make_png(sys.argv[1])
    print(f"icon written: {sys.argv[1]}")
