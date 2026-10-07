import base64
import re
import shutil
import struct
import sys
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tileset_files'
TILES_OUT = ROOT / 'static' / 'assets' / 'room' / 'tiles'
SVG_OUT = ROOT / 'src' / 'lib' / 'assets' / 'room' / 'room.svg'
TILES_URL = '/assets/room/tiles'
TILE = 32

RENAMES = {
    'InteriorTiles.png': 'interior.png',
    'Tileset-D by LamiaJerinLJ.png': 'furniture-d.png',
    'Tileset A5 by LamiaJerinLJ.png': 'floor-a5.png',
    'MainTileMap.png': 'office-interior.png',
    'HPK3vDAW0AA10Fd.jpeg': 'poster-umi.jpeg',
    'image_2x1_tiles_32px.png': 'poster-wide.png',
    'CatBedPink.png': 'cat-bed-pink.png',
    'SleepCatb.png': 'cat-sleep.png',
    'bri.png': 'avatar.png',
    'bri_retro.png': 'avatar-retro.png',
}
SLOT_RENAMES = {'bri': 'avatar'}


def load_tilesets(tmx):
    tilesets = []
    for entry in tmx.findall('tileset'):
        tsx = ET.parse(SOURCE / entry.get('source')).getroot()
        image = SOURCE / Path(tsx.find('image').get('source')).name
        width, height = Image.open(image).size
        tilesets.append(
            {
                'firstgid': int(entry.get('firstgid')),
                'file': image,
                'columns': width // TILE,
                'width': width,
                'height': height,
            }
        )
    return sorted(tilesets, key=lambda t: t['firstgid'])


def tileset_for(gid, tilesets):
    match = None
    for tileset in tilesets:
        if gid >= tileset['firstgid']:
            match = tileset
    return match


def decode(layer, map_width):
    raw = zlib.decompress(base64.b64decode(layer.find('data').text.strip()))
    gids = struct.unpack(f'<{len(raw) // 4}I', raw)
    return [
        (i % map_width, i // map_width, gid & 0x1FFFFFFF)
        for i, gid in enumerate(gids)
        if gid & 0x1FFFFFFF
    ]


def slot_name(name):
    base = re.sub(r'[\s\d]+$', '', name).strip().lower().replace(' ', '-')
    return SLOT_RENAMES.get(base, base)


def offset(element):
    return float(element.get('offsetx', 0)), float(element.get('offsety', 0))


def layer_tiles(layer, map_width, tilesets, used, dx=0.0, dy=0.0):
    ox, oy = offset(layer)
    tiles = []
    for col, row, gid in decode(layer, map_width):
        tileset = tileset_for(gid, tilesets)
        local = gid - tileset['firstgid']
        sx = (local % tileset['columns']) * TILE
        sy = (local // tileset['columns']) * TILE
        x = round(col * TILE + ox + dx)
        y = round(row * TILE + oy + dy)
        href = f"{TILES_URL}/{RENAMES[tileset['file'].name]}"
        used.add(tileset['file'])
        tiles.append(
            f'<svg x="{x}" y="{y}" width="{TILE}" height="{TILE}" viewBox="{sx} {sy} {TILE} {TILE}">'
            f'<image href="{href}" width="{tileset["width"]}" height="{tileset["height"]}"/></svg>'
        )
    return tiles


def main():
    tmx = ET.parse(SOURCE / 'map.tmx').getroot()
    map_width, map_height = int(tmx.get('width')), int(tmx.get('height'))
    tilesets = load_tilesets(tmx)
    used = set()
    variants = {}
    order = []

    for element in tmx:
        if element.tag == 'layer':
            tiles = layer_tiles(element, map_width, tilesets, used)
        elif element.tag == 'group':
            gx, gy = offset(element)
            tiles = [
                tile
                for child in element.findall('layer')
                for tile in layer_tiles(child, map_width, tilesets, used, gx, gy)
            ]
        else:
            continue
        if not tiles:
            continue
        name = element.get('name')
        key = (slot_name(name), name)
        if key not in variants:
            variants[key] = {'tiles': [], 'visible': False}
            order.append(key)
        variants[key]['tiles'].extend(tiles)
        variants[key]['visible'] |= element.get('visible') != '0'

    defaults = {}
    for slot, name in order:
        if variants[(slot, name)]['visible'] and slot not in defaults:
            defaults[slot] = name
    for slot, name in order:
        defaults.setdefault(slot, name)

    width, height = map_width * TILE, map_height * TILE
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" overflow="hidden" shape-rendering="crispEdges">'
    ]
    for slot, name in order:
        default = ' data-default=""' if defaults[slot] == name else ''
        lines.append(f'<g data-slot="{slot}" data-variant="{name}"{default}>')
        lines.extend(variants[(slot, name)]['tiles'])
        lines.append('</g>')
    lines.append('</svg>')

    SVG_OUT.parent.mkdir(parents=True, exist_ok=True)
    SVG_OUT.write_text('\n'.join(lines) + '\n')
    TILES_OUT.mkdir(parents=True, exist_ok=True)
    for file in used:
        shutil.copyfile(file, TILES_OUT / RENAMES[file.name])
    print(f'{SVG_OUT.relative_to(ROOT)}: {len(order)} variants, {len(used)} images', file=sys.stderr)


if __name__ == '__main__':
    main()
