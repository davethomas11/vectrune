"""Exercise the .vect manual renderer with the actual CLI and docs inventory."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import tarfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'teaching_website'))
from build_man_pages import build_man_pages

BINARY = ROOT / ('target/debug/vectrune.exe' if os.name == 'nt' else 'target/debug/vectrune')
SCRIPT = ROOT / 'teaching_website/generate_man_pages.vect'


class ManPageTests(unittest.TestCase):
    def test_portable_object_examples_are_runnable(self):
        topics = {'object-property-shorthand', 'object-replication', 'object-grid',
                  'local-templates', 'object-overlays', 'matching-object-lookup',
                  'compound-assignment'}
        catalog = json.loads((ROOT / 'knowledge/reference/library.json').read_text(encoding='utf-8'))
        examples = [entry for entry in catalog['entries'] if entry['id'] in topics]
        self.assertEqual(len(examples), len(topics))
        with tempfile.TemporaryDirectory() as folder:
            for entry in examples:
                with self.subTest(topic=entry['id']):
                    source = Path(folder, entry['id'] + '.vect')
                    source.write_text(entry['example'] + '\nstdio -> "example complete"\n')
                    result = subprocess.run([str(BINARY), str(source)], text=True, encoding='utf-8',
                                            capture_output=True, check=True, cwd=folder)
                    self.assertEqual(result.stdout.strip(), 'example complete')

    def test_reference_details_and_roff_escaping(self):
        entry = dict(
            name='sample', category='native', signature='sample <value>',
            summary='.so file\n\'control\n\\path --flag', runtime='Native / server',
            sources=['src/sample.rs'], aliases=['other'],
            parameters=[dict(name='value', description='Input')],
            returns='Result', errors='Failure', notes=['Limited'],
            fields=[dict(name='flag', type='bool', default='false', description='A flag')],
            example='.literal\nsample "value"',
        )
        with tempfile.TemporaryDirectory() as folder:
            for section in ['man1', 'man7']:
                Path(folder, section).mkdir()
            payload = dict(
                output=folder, version='vectrune 1.2.3', date='2026-01-01',
                catalog=dict(categories=[dict(id='native', title='Native', description='Functions')],
                             entries=[entry]),
            )
            subprocess.run([str(BINARY), str(SCRIPT)], input=json.dumps(payload) + '\n',
                           text=True, encoding='utf-8', check=True, cwd=folder)
            page = Path(folder, 'man7/vectrune-language.7').read_text(encoding='utf-8')
            for value in ['Aliases: other', 'value: Input', 'Returns / effects: Result',
                          'Errors / edge cases: Failure', 'Note: Limited',
                          'flag (bool; default: false): A flag', '\\&.literal',
                          "\\&.so file\n\\&'control\n\\&\\epath \\-\\-flag"]:
                self.assertIn(value, page)

    def test_real_inventory_produces_deterministic_versioned_manuals(self):
        with tempfile.TemporaryDirectory() as folder:
            pages = build_man_pages(folder, BINARY)
            first = [page.read_bytes() for page in pages]
            build_man_pages(folder, BINARY)
            self.assertEqual(first, [page.read_bytes() for page in pages])
            cli, language = [page.read_text(encoding='utf-8') for page in pages]
            version = subprocess.check_output([str(BINARY), '--version'], text=True).strip()
            self.assertIn(f'"{version}"', cli)
            self.assertIn('Usage: vectrune', cli)
            self.assertIn('vectrune test', cli)
            for command in ['vectrune ascii generate', 'vectrune ascii image',
                            'vectrune ascii text', 'vectrune ascii run']:
                self.assertIn(command, cli)
            for flag in ['\\-\\-font', '\\-\\-char', '\\-\\-background',
                         '\\-\\-commands', '\\-\\-mute']:
                self.assertIn(flag, cli)
            self.assertIn('\\-\\-play', cli)
            self.assertIn('\\-\\-rune', cli)
            for declaration in ['@AsciiAnimator', '@Ascii3D', '@AsciiSprite', '@AsciiTone']:
                self.assertIn(declaration, language)
            animator = language.split('\\&@AsciiAnimator', 1)[1].split('.SS', 1)[0]
            self.assertIn('Terminal\\-only ASCII canvas (v0.3.12)', animator)
            self.assertIn('Unreleased \\-\\-desktop', animator)
            self.assertIn('memory.set', language)
            self.assertIn('Runtime: Native / server', language)
            self.assertIn('Runtime: Rune\\-Web', language)
            self.assertIn('Implementation:', language)
            self.assertIn('DATABASE AND EVENT EXAMPLES', cli)
            self.assertIn('secondary\\-app', cli)
            self.assertIn('single\\-server.rune', language)
            self.assertIn('allow_origins', language)
            self.assertIn('Run a server\\-side database with Rune\\-Web', language)
            self.assertIn('purchase.completed', language)
            self.assertIn('Replayed the first page of server events', language)
            for topic in ['object property shorthand', 'object replication', 'object grid',
                          'local templates', 'object overlays', 'matching object lookup',
                          'compound assignment']:
                self.assertIn('\\&' + topic, language)
            self.assertIn('orders[]id.items[]sku.qty += 4', language)
            self.assertIn('Missing\\-match writes and compound writes do nothing.', language)
            self.assertIn('Runtime: Vect scripts / backend Rune / Rune\\-Web / browser emulator', language)
            if shutil.which('mandoc'):
                subprocess.run(['mandoc', '-Tlint', *map(str, pages)], check=True)

    @unittest.skipIf(os.name == 'nt', 'Release archive assembly runs on Linux')
    def test_release_packaging_preserves_binaries_and_bundles_both_manuals(self):
        workflow = (ROOT / '.github/workflows/release.yml').read_text(encoding='utf-8')
        self.assertNotIn('export ALSA_STATIC=1', workflow)
        self.assertNotIn('goto-bus-stop/setup-zig', workflow)
        self.assertIn('ziglang==0.14.1', workflow)
        self.assertIn('cargo install cargo-zigbuild --version 0.24.1 --locked', workflow)
        for name in ['Install Zig', 'Install cargo-zigbuild']:
            step_text = workflow.split(f'      - name: {name}\n', 1)[1].split('\n      - name:', 1)[0]
            self.assertIn("if: contains(matrix.platform.target, 'linux')", step_text)
        audio_build = (ROOT / '.github/scripts/build-linux-audio.sh').read_text(encoding='utf-8')
        self.assertIn('-lstatic=asound -lm -lpthread -ldl', audio_build)
        self.assertIn('CFLAGS="-Os -fPIC"', audio_build)
        step = workflow.split('      - name: Bundle offline manuals with every platform\n', 1)[1]
        script = textwrap.dedent(step.split('        run: |\n', 1)[1].split('\n      - name:', 1)[0])
        with tempfile.TemporaryDirectory() as folder:
            artifacts = Path(folder, 'artifacts')
            manuals = artifacts / 'man'
            build_man_pages(manuals, BINARY)
            for name in ['vectrune', 'vectrune.exe']:
                binary = Path(folder, name)
                binary.write_bytes(b'unchanged binary payload')
                with tarfile.open(artifacts / f'{name}-platform.tar.gz', 'w:gz') as archive:
                    archive.add(binary, arcname=name)
            subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script], cwd=folder, check=True,
                           capture_output=True, text=True)
            for name in ['vectrune', 'vectrune.exe']:
                with tarfile.open(artifacts / f'{name}-platform.tar.gz') as archive:
                    self.assertEqual(archive.extractfile(name).read(), b'unchanged binary payload')
                    for page in ['man1/vectrune.1', 'man7/vectrune-language.7']:
                        self.assertEqual(archive.extractfile('man/' + page).read(),
                                         (manuals / page).read_bytes())


if __name__ == '__main__':
    unittest.main()
