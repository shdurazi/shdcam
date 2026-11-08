"""Regenerates the app icons (needs Python Playwright + Chromium)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

def svg(rounded):
    rx = 112 if rounded else 0
    scale = 1 if rounded else 0.84   # keep artwork inside the maskable safe zone
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1d21"/><stop offset="1" stop-color="#08080a"/></linearGradient>
<radialGradient id="glass" cx=".36" cy=".32" r=".85"><stop offset="0" stop-color="#43606a"/><stop offset=".42" stop-color="#18262d"/><stop offset="1" stop-color="#05080a"/></radialGradient>
<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f3eb"/><stop offset="1" stop-color="#a9a193"/></linearGradient>
</defs>
<rect width="512" height="512" rx="{rx}" fill="url(#bg)"/>
<g transform="translate(256 256) scale({scale}) translate(-256 -256)">
<circle cx="256" cy="268" r="160" fill="#0c0c0e" stroke="url(#ring)" stroke-width="16"/>
<circle cx="256" cy="268" r="116" fill="url(#glass)"/>
<circle cx="256" cy="268" r="92" fill="none" stroke="#f7f3eb" stroke-opacity=".22" stroke-width="3"/>
<circle cx="256" cy="268" r="52" fill="#04070a"/>
<ellipse cx="212" cy="222" rx="34" ry="20" fill="#fff" fill-opacity=".17" transform="rotate(-36 212 222)"/>
<circle cx="380" cy="128" r="21" fill="#e5432a"/>
<circle cx="380" cy="128" r="34" fill="#e5432a" fill-opacity=".18"/>
</g>
</svg>'''

jobs = [(os.path.join(ROOT, 'icons/icon-512.png'), 512, True), (os.path.join(ROOT, 'icons/icon-192.png'), 192, True), (os.path.join(ROOT, 'icons/icon-maskable-512.png'), 512, False)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for path, size, rounded in jobs:
        pg = b.new_page(viewport={'width': size, 'height': size})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(rounded)}</body></html>')
        pg.screenshot(path=path, omit_background=True)
        pg.close()
    b.close()
for path, *_ in jobs:
    print(path, os.path.getsize(path))
