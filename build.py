#!/usr/bin/env python3
"""Builds shdcam.

  python3 build.py                  -> index.html + sw.js next to this file (GitHub Pages / PWA)
  python3 build.py --artifact F     -> also writes the content-only page used for a Claude artifact
"""
import base64, hashlib, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')


def rd(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def main():
    args = sys.argv[1:]
    art_out = None
    out_dir = HERE
    if '--artifact' in args:
        art_out = args[args.index('--artifact') + 1]
    if '--out' in args:
        out_dir = args[args.index('--out') + 1]
    os.makedirs(out_dir, exist_ok=True)

    css = rd('style.css')
    libs = '\n'.join(rd(n) for n in ('grade.js', 'films.js', 'gl.js'))
    app = '\n'.join(rd(n) for n in ('app_a.js', 'app_b.js', 'app_c.js'))
    with open(os.path.join(SRC, 'sample.jpg'), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    js = libs + '\n(function(){\n"use strict";\nconst SAMPLE_B64="' + b64 + '";\n' + app + '\n})();\n'
    if '</script' in js.lower():
        sys.exit('JS contains </script')

    # syntax check with node (when available)
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js)
        tmp = t.name
    try:
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit('node --check failed:\n' + r.stderr)
    except FileNotFoundError:
        print('node not found, skipping syntax check')
    finally:
        os.unlink(tmp)

    tpl = rd('index.tpl.html')
    body = tpl.replace('/*@@CSS@@*/', css).replace('/*@@JS@@*/', js)

    if art_out:
        with open(art_out, 'w', encoding='utf-8') as f:
            f.write(body)
        print('artifact ->', art_out, len(body) // 1024, 'KB')

    # standalone page: lift <title>/<link> into a real <head>
    cut = body.index('<style>')
    head_bits = body[:cut]
    head_bits = re.sub(r'<meta name="claude:[^>]*>\s*', '', head_bits)
    rest = body[cut:]
    html = (
        '<!doctype html>\n<html lang="ar">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        '<meta name="theme-color" content="#0a0a0b">\n'
        '<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="shdcam">\n'
        '<meta name="description" content="shdcam: film-look camera with Fuji FP100 as the default look">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" href="icons/icon-192.png">\n'
        '<link rel="apple-touch-icon" href="icons/icon-192.png">\n'
        '<style>:root{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'html{background:#0a0a0b}body{margin:0}</style>\n'
        + head_bits + '</head>\n<body>\n' + rest +
        '\n<script>\nif("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){'
        'window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})})}\n</script>\n'
        '</body>\n</html>\n'
    )
    with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    ver = hashlib.sha1(html.encode('utf-8')).hexdigest()[:10]
    sw = rd('sw.tpl.js').replace('__VERSION__', ver)
    with open(os.path.join(out_dir, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(sw)
    print('index.html', len(html) // 1024, 'KB, sw version', ver)


if __name__ == '__main__':
    main()
