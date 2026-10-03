import struct
import zlib

width = height = 256
raw = bytearray()
for _ in range(height):
    raw.append(0)
    for _ in range(width):
        raw.extend((18, 101, 57, 255))


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack('!I', len(data))
        + tag
        + data
        + struct.pack('!I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    )

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(raw), level=9))
png += chunk(b'IEND', b'')

with open('src-tauri/icons/icon.png', 'wb') as f:
    f.write(png)

print('created src-tauri/icons/icon.png')
