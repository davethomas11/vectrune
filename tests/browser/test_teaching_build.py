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
from release_metadata import GITHUB, release_archive, sync_release


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
        header = (Path(__file__).resolve().parents[2] / 'teaching_website/parts/components/header.rune').read_text()
        games = header.split('h3 "%i18n.Nav.games%"', 1)[1].split('GamePreview', 1)[0]
        self.assertEqual(
            re.findall(r'click="navigate\(\'([\w-]+)\'\)"', games),
            ['games', 'vectworms', 'monster-city', 'vect-breach', 'rune-crypt', 'skybound-2', 'starfall', 'marble-run', 'dog-walker', 'neon-circuit'],
        )

    def test_stale_compiler_is_rejected_before_overwriting_a_working_site(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / 'site'
            destination.mkdir()
            previous = destination / 'index.html'
            previous.write_text('Working site')
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.2.18\n')) as command:
                version, _ = sync_release()
                with self.assertRaisesRegex(RuntimeError, f'requires Vectrune {re.escape(version)}'):
                    build_site(destination, Path(folder) / 'old-compiler')
                self.assertEqual(command.call_count, 1)
            self.assertEqual(previous.read_text(), 'Working site')
            self.assertFalse((destination / 'assets').exists())

    def test_previous_pixel_compiler_is_rejected_for_marble_run(self):
        version, _ = sync_release()
        major, minor, patch_number = map(int, version.split("."))
        older_version = f'{major}.{minor}.{patch_number - 1}' if patch_number else '0.0.0'
        with tempfile.TemporaryDirectory() as folder:
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, f'vectrune {older_version}\n')):
                with self.assertRaisesRegex(RuntimeError, f'requires Vectrune {re.escape(version)}'):
                    build_site(Path(folder) / 'site', Path(folder) / 'old-compiler')

    def test_release_guard_rejects_a_stale_generated_site_module_and_wrong_tag(self):
        with tempfile.TemporaryDirectory() as folder:
            generated = Path(folder) / 'release.generated.rune'
            generated.write_text('old version')
            with patch('release_metadata.GENERATED', generated):
                with self.assertRaisesRegex(ValueError, 'Stale release state'):
                    sync_release()
                version, _ = sync_release(write=True)
                self.assertEqual(sync_release(tag=f'v{version}')[0], version)
                with self.assertRaisesRegex(ValueError, 'Release tag .* does not match'):
                    sync_release(tag='v0.0.0')

    def test_archive_destinations_match_publication_status(self):
        entries = [
            dict(tag='v1.0.2', tagged_on=None, github_tag=False, published_on=None, summary='Current'),
            dict(tag='v1.0.1', tagged_on='2026-01-12', github_tag=True, published_on='2026-01-13', summary='Released'),
            dict(tag='v1.0.0', tagged_on='2026-01-10', github_tag=True, published_on=None, summary='Tagged'),
        ]
        metadata = {'version': '1.0.2', 'releases': entries}
        current, published, tagged = release_archive(metadata)
        self.assertIsNone(current['url'])
        self.assertTrue(current['current'])
        self.assertEqual(published['url'], f'{GITHUB}/releases/tag/v1.0.1')
        self.assertEqual(published['date'], '2026-01-13')
        self.assertEqual(tagged['url'], f'{GITHUB}/tree/v1.0.0')
        self.assertEqual(tagged['date'], '2026-01-10')
        with self.assertRaisesRegex(ValueError, 'unique and newest first'):
            release_archive({'version': '1.0.2', 'releases': [*entries, entries[-1]]})
        entries[1]['github_tag'] = False
        with self.assertRaisesRegex(ValueError, 'inconsistent GitHub publication'):
            release_archive(metadata)


if __name__ == '__main__':
    unittest.main()
