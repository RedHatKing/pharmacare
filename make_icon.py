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

# Also create a simple .ico containing this PNG (Windows supports PNG-compressed images inside ICO)
try:
    png_data = png
    # ICONDIR header: reserved (2 bytes), type (2 bytes), count (2 bytes)
    icon_dir = struct.pack('<HHH', 0, 1, 1)

    # ICONDIRENTRY: width(1), height(1), color count(1), reserved(1), planes(2), bitcount(2), bytes in resource(4), image offset(4)
    width_byte = 0 if width == 256 else width
    height_byte = 0 if height == 256 else height
    color_count = 0
    reserved = 0
    planes = 1
    bitcount = 32
    bytes_in_res = len(png_data)
    image_offset = 6 + 16  # ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes)

    entry = struct.pack('<BBBBHHII', width_byte, height_byte, color_count, reserved, planes, bitcount, bytes_in_res, image_offset)

    ico = icon_dir + entry + png_data

    with open('src-tauri/icons/icon.ico', 'wb') as f:
        f.write(ico)

    print('created src-tauri/icons/icon.ico')
except Exception as e:
    print('failed to create icon.ico:', e)
