"""Keep the public reference tied to implemented command inventories."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import json
import zipfile
import subprocess
import os

ROOT = Path(__file__).resolve().parents[2]
BINARY = Path(os.environ.get(
    'VECTRUNE_BINARY',
    str(ROOT / 'target/debug' / ('vectrune.exe' if os.name == 'nt' else 'vectrune')),
)).resolve()
sys.path.insert(0, str(ROOT / 'teaching_website'))
from reference_inventory import inventory, native_names, web_commands
from build_api_docs import build_docs


class ReferenceInventoryTests(unittest.TestCase):
    def test_example_catalog_sources_and_companions_exist(self):
        catalog = json.loads((ROOT / 'language/docs/data/examples.json').read_text(encoding='utf-8'))
        for entry in catalog['examples']:
            for source in [entry['source_path'], *(entry.get('companion_files') or [])]:
                with self.subTest(example=entry['id'], source=source):
                    self.assertTrue((ROOT / source).is_file(), source)

    def test_portable_object_syntax_reaches_library_and_search(self):
        topics = ['object-property-shorthand', 'object-replication', 'object-grid',
                  'local-templates', 'object-overlays', 'matching-object-lookup',
                  'compound-assignment']
        with tempfile.TemporaryDirectory() as folder:
            with patch('reference_inventory.help_entries', return_value=[]):
                build_docs(folder, ROOT / 'target/debug/vectrune', selected_routes=['docs/library/language'])
            page = Path(folder, 'docs/library/language/index.html').read_text(encoding='utf-8')
            search = json.loads(Path(folder, 'docs/search-index.json').read_text(encoding='utf-8'))
            for topic in topics:
                self.assertIn(f'id="{topic}"', page)
                entry = next(item for item in search if item['url'].endswith('#' + topic))
                self.assertEqual(entry['runtime'], 'Vect scripts / backend Rune / Rune-Web / browser emulator')
            self.assertIn('orders[]id.items[]sku.qty += 4', page)
            self.assertIn('Missing-match writes and compound writes do nothing.', page)
            self.assertIn('Updating one generated or overlaid object does not change the template', page)

    def test_native_registry_and_aliases_are_documented(self):
        entries = inventory()['entries']
        names = {name for entry in entries for name in [entry['name'], *entry.get('aliases', [])]}
        self.assertFalse(native_names() - names - {'#'})

    def test_undocumented_new_builtin_blocks_publication(self):
        with patch('reference_inventory.native_names', return_value=native_names() | {'new-undocumented-builtin'}):
            with self.assertRaisesRegex(ValueError, 'new-undocumented-builtin'):
                inventory()

    def test_web_aliases_signatures_and_timer_are_extracted(self):
        commands = {entry['name']: entry for entry in web_commands()}
        self.assertIn('++', commands['increment']['aliases'])
        self.assertIn('by', commands['increment']['signature'])
        self.assertIn('interval', commands['start-timer']['aliases'])
        self.assertEqual(commands['stop']['signature'], 'stop')

    def test_static_docs_preserve_hosting_prefix_and_canonical_origin(self):
        with tempfile.TemporaryDirectory() as folder:
            selected = ['docs', 'docs/index', 'docs/library/native']
            # CLI extraction is tested by the integration build using the actual compiler.
            with patch('reference_inventory.help_entries', return_value=[]):
                routes = build_docs(folder, ROOT / 'target/debug/vectrune', '/guide/', 'https://preview.example', selected)
            self.assertEqual(set(routes), set(selected))
            self.assertTrue(Path(folder, 'assets/docs-search.js').is_file())
            self.assertTrue(Path(folder, 'assets/content/docs/app.rune').is_file())
            page = Path(folder, 'docs/library/native/index.html').read_text(encoding='utf-8')
            self.assertIn('href="https://preview.example/guide/docs/library/native/"', page)
            self.assertIn('src="/guide/assets/docs-search.js?v=1"', page)
            self.assertIn('id="memory-set"', page)
            index = json.loads(Path(folder, 'docs/search-index.json').read_text(encoding='utf-8'))
            entry = next(item for item in index if item['name'] == 'memory.set')
            self.assertEqual(entry['url'], '/guide/docs/library/native/#memory-set')
            self.assertIn('set-memory', entry['aliases'])

    def test_storage_guide_ships_runnable_sources_and_complete_download(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch('reference_inventory.help_entries', return_value=[]):
                build_docs(folder, ROOT / 'target/debug/vectrune', '/guide/', selected_routes=['docs/storage'])
            page = Path(folder, 'docs/storage/index.html').read_text(encoding='utf-8')
            self.assertIn('One note. A shared source of truth.', page)
            self.assertIn('--secondary-app', page)
            self.assertIn('purchase.completed', page)
            self.assertIn('href="/guide/assets/content/docs/rune-storage.zip" download', page)
            with zipfile.ZipFile(Path(folder, 'assets/content/docs/rune-storage.zip')) as archive:
                for name in ['fullstack/database.rune', 'fullstack/app.rune', 'fullstack/single-server.rune',
                             'fullstack/ui.rune', 'fullstack/style.rune', 'checkout.vect',
                             'replay.vect', 'local.rune', 'README.md']:
                    self.assertEqual(archive.read('rune_storage/' + name),
                                     (ROOT / 'examples/data/storage' / name).read_bytes())
                self.assertFalse(any('.vectrune/' in name for name in archive.namelist()))

    def test_ascii3d_reference_guide_and_demo_download(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch('reference_inventory.help_entries', return_value=[]):
                build_docs(folder, ROOT / 'target/debug/vectrune', '/guide/',
                           selected_routes=['docs/ascii-animator', 'docs/library/declarations'])
            page = Path(folder, 'docs/ascii-animator/index.html').read_text(encoding='utf-8')
            self.assertIn('@Ascii3D/corridor', page)
            self.assertIn('repeat_y = true', page)
            self.assertIn('href="/guide/assets/content/docs/ascii-animator.zip" download', page)
            self.assertIn('actual slopes and vertical physics are not modeled', page)
            self.assertIn('Simple native sound cues', page)
            self.assertIn('--mute', page)
            self.assertIn('vectrune ascii generate', page)
            self.assertIn('vectrune ascii image', page)
            self.assertIn('vectrune ascii text', page)
            self.assertIn('The Kingdom of Borrowed Mornings', page)
            self.assertIn('AsciiMusic scores (unreleased prototype)', page)
            self.assertIn('@AsciiMusic/haunted', page)
            self.assertIn('160x48 terminal', page)
            self.assertIn('--commands', page)
            self.assertNotIn('vectrune ascii demo', page)
            library = Path(folder, 'docs/library/declarations/index.html').read_text(encoding='utf-8')
            self.assertIn('id="ascii3d--repeat-y"', library)
            self.assertIn('id="ascii-tone--end-frequency"', library)
            self.assertIn('id="ascii-music--tempo"', library)
            search = json.loads(Path(folder, 'docs/search-index.json').read_text(encoding='utf-8'))
            entry = next(item for item in search if item['name'] == '@Ascii3D')
            self.assertEqual(entry['runtime'], 'ASCII Animator native CLI only')
            tone = next(item for item in search if item['name'] == '@AsciiTone')
            self.assertEqual(tone['runtime'], 'ASCII Animator native CLI only')
            with zipfile.ZipFile(Path(folder, 'assets/content/docs/ascii-animator.zip')) as archive:
                for name in ['sentinel', 'halls', 'descent']:
                    self.assertEqual(archive.read('ascii/' + name + '.rune'),
                                     (ROOT / 'examples/ascii' / (name + '.rune')).read_bytes())
                for name in ['borrowed_morning.rune', 'borrowed_morning/scenes.rune', 'borrowed_morning/README.md']:
                    self.assertEqual(archive.read('ascii/' + name), (ROOT / 'examples/ascii' / name).read_bytes())
                clockwork = ROOT / 'examples/ascii/games/clockwork'
                for source in [clockwork / 'forest.rune', clockwork / 'README.md',
                               clockwork / 'build_assets.py', *sorted((clockwork / 'assets').glob('*.gif'))]:
                    self.assertEqual(archive.read('ascii/games/clockwork/' + source.relative_to(clockwork).as_posix()),
                                     source.read_bytes())
                self.assertEqual(len(archive.namelist()), 24)
                archive.extractall(Path(folder, 'extracted'))
            output = subprocess.run(
                [str(BINARY), 'ascii', 'run', 'ascii/borrowed_morning.rune',
                 '--plain', '--commands', 'begin'],
                cwd=Path(folder, 'extracted'), capture_output=True, text=True, check=True)
            self.assertIn("Royal Sock-Mender", output.stdout)
            output = subprocess.run(
                [str(BINARY), 'ascii', 'run', 'ascii/games/clockwork/forest.rune',
                 '--plain', '--frames', '2', '--keys', 'Enter'],
                cwd=Path(folder, 'extracted'), capture_output=True, text=True, check=True)
            self.assertIn('THE THIRTEENTH BELL', output.stdout)
            self.assertEqual(output.stderr, '')


if __name__ == '__main__':
    unittest.main()
