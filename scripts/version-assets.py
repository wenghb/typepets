#!/usr/bin/env python3
"""Stamp every local CSS/JS link in the site's HTML with ?v=<content hash>.

Cloudflare tells browsers to keep CSS and JS for 4 hours, while HTML is
revalidated on every visit. With a hash in the URL, a changed file gets a new
URL and browsers fetch it right away; unchanged files keep their cache.

    python3 scripts/version-assets.py          # update the stamps in place
    python3 scripts/version-assets.py --check  # exit 1 if any stamp is stale

Run it after editing anything in css/ or js/, before committing.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {'.git', '.claude', '.wrangler', 'node_modules'}

# href="../css/style.css" or src="/js/app.js?v=1a2b3c4d" (local paths only: no scheme, no //)
LINK_RE = re.compile(
    r'(?P<attr>\b(?:href|src)=")'
    r'(?P<path>(?!//)[^":?#]+\.(?:css|js))'
    r'(?:\?v=[0-9a-f]*)?'
    r'(?P<end>")'
)

_hashes = {}


def content_hash(path):
    if path not in _hashes:
        _hashes[path] = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    return _hashes[path]


def resolve(html_file, ref):
    target = ROOT / ref.lstrip('/') if ref.startswith('/') else html_file.parent / ref
    return target.resolve()


def stamp(html_file, missing):
    text = html_file.read_text(encoding='utf-8')

    def replace(m):
        target = resolve(html_file, m.group('path'))
        if not target.is_file():
            missing.append(f'{html_file.relative_to(ROOT)}: {m.group("path")}')
            return m.group(0)
        return f'{m.group("attr")}{m.group("path")}?v={content_hash(target)}{m.group("end")}'

    new_text = LINK_RE.sub(replace, text)
    return text, new_text


def html_files():
    for path in sorted(ROOT.rglob('*.html')):
        if not SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
            yield path


def main():
    check = '--check' in sys.argv[1:]
    missing, stale = [], []
    for html_file in html_files():
        old, new = stamp(html_file, missing)
        if old != new:
            stale.append(html_file.relative_to(ROOT))
            if not check:
                html_file.write_text(new, encoding='utf-8')

    for line in missing:
        print(f'warning: file not found for {line}', file=sys.stderr)
    if check:
        if stale:
            print('Stale asset versions in:', *stale, sep='\n  ')
            print('Run: python3 scripts/version-assets.py')
            return 1
        print('Asset versions are up to date.')
        return 0
    print(f'Updated {len(stale)} file(s).')
    for path in stale:
        print(f'  {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
