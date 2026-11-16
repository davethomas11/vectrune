"""Keep the public reference tied to implemented command inventories."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import json

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'teaching_website'))
from reference_inventory import inventory, native_names, web_commands
from build_api_docs import build_docs


class ReferenceInventoryTests(unittest.TestCase):
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
            page = Path(folder, 'docs/library/native/index.html').read_text()
            self.assertIn('href="https://preview.example/guide/docs/library/native/"', page)
            self.assertIn('src="/guide/assets/docs-search.js?v=1"', page)
            self.assertIn('id="memory-set"', page)
            index = json.loads(Path(folder, 'docs/search-index.json').read_text())
            entry = next(item for item in index if item['name'] == 'memory.set')
            self.assertEqual(entry['url'], '/guide/docs/library/native/#memory-set')
            self.assertIn('set-memory', entry['aliases'])


if __name__ == '__main__':
    unittest.main()
