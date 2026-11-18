"""Collect the website inventory and invoke the .vect manual generator.

Python only supplies registry/help extraction and filesystem orchestration.
All manual content and roff rendering live in generate_man_pages.vect.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

from reference_inventory import ROOT, inventory


def build_man_pages(destination, binary):
    binary = Path(binary).resolve()
    version = subprocess.run(
        [str(binary), '--version'], capture_output=True, text=True, check=True
    ).stdout.strip()
    if not re.fullmatch(r'[\w.+ -]+', version):
        raise ValueError(f'Unexpected compiler version: {version!r}')
    catalog = inventory(binary)
    if not any(entry.get('help') and entry['name'] == 'vectrune' for entry in catalog['entries']):
        raise ValueError('CLI inventory must contain the root command help')
    date = subprocess.run(
        ['git', 'log', '-1', '--format=%cs'], cwd=ROOT,
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        raise ValueError(f'Unexpected source date: {date!r}')
    destination = Path(destination).resolve()
    for section in ['man1', 'man7']:
        (destination / section).mkdir(parents=True, exist_ok=True)
    payload = dict(version=version, date=date, catalog=catalog, output=str(destination))
    subprocess.run(
        [str(binary), str(ROOT / 'teaching_website/generate_man_pages.vect')],
        input=json.dumps(payload, ensure_ascii=False) + '\n',
        text=True, check=True,
    )
    pages = [destination / 'man1/vectrune.1', destination / 'man7/vectrune-language.7']
    if not all(page.is_file() and page.stat().st_size for page in pages):
        raise ValueError('Manual generator did not produce both nonempty pages')
    return pages


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--binary', default=ROOT / 'target/debug/vectrune', type=Path)
    args = parser.parse_args()
    for page in build_man_pages(args.output, args.binary):
        print(page)
