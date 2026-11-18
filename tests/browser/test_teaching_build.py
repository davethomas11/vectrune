"""Build safety checks: new templates must not ship with the old locale router."""
from pathlib import Path
import subprocess
import re
import json
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'teaching_website'))
from build_site import build_site, starfall_web_app


class TeachingBuildTests(unittest.TestCase):
    def test_starfall_installed_launch_stays_in_its_scope_at_any_hosting_prefix(self):
        from urllib.parse import urljoin
        with tempfile.TemporaryDirectory() as folder:
            html = starfall_web_app('<html><head><link rel="apple-touch-icon" href="/old-icon.png"></head><body>Game</body></html>', Path(folder))
            manifest = json.loads(Path(folder,'manifest.webmanifest').read_text())
            self.assertIn('rel="manifest" href="./manifest.webmanifest"',html)
            self.assertIn('name="apple-mobile-web-app-capable" content="yes"',html)
            self.assertEqual(html.count('rel="apple-touch-icon"'),1)
            self.assertEqual(manifest['display'],'fullscreen')
            self.assertEqual(manifest['display_override'],['fullscreen','standalone'])
            for prefix in ['', '/preview']:
                base='https://example.com'+prefix+'/assets/games/starfall/'
                self.assertTrue(urljoin(base,manifest['start_url']).startswith(urljoin(base,manifest['scope'])))
                self.assertEqual(urljoin(base,manifest['icons'][0]['src']), 'https://example.com'+prefix+'/assets/rune-logo.png')
    def test_games_menu_orders_examples_by_increasing_complexity(self):
        layout = (Path(__file__).resolve().parents[2] / 'teaching_website/parts/components/layout.rune').read_text()
        games = layout.split('h3 "%i18n.Nav.games%"', 1)[1].split('div .nav-group:', 1)[0]
        self.assertEqual(
            re.findall(r'click="navigate\(\'([\w-]+)\'\)"', games),
            ['games', 'vectworms', 'monster-city', 'vect-breach', 'rune-crypt', 'skybound-2', 'starfall'],
        )

    def test_stale_compiler_is_rejected_before_overwriting_a_working_site(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / 'site'
            destination.mkdir()
            previous = destination / 'index.html'
            previous.write_text('Working site')
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.2.18\n')) as command:
                with self.assertRaisesRegex(RuntimeError, '0.3.6.*Starfall Protocol'):
                    build_site(destination, Path(folder) / 'old-compiler')
                self.assertEqual(command.call_count, 1)
            self.assertEqual(previous.read_text(), 'Working site')
            self.assertFalse((destination / 'assets').exists())

    def test_previous_pixel_compiler_is_rejected_for_starfall(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.3.5\n')):
                with self.assertRaisesRegex(RuntimeError, '0.3.6.*Starfall Protocol'):
                    build_site(Path(folder) / 'site', Path(folder) / 'old-compiler')


if __name__ == '__main__':
    unittest.main()
