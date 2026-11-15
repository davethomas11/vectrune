"""Build safety checks: new templates must not ship with the old locale router."""
from pathlib import Path
import subprocess
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'teaching_website'))
from build_site import build_site


class TeachingBuildTests(unittest.TestCase):
    def test_games_menu_orders_examples_by_increasing_complexity(self):
        layout = (Path(__file__).resolve().parents[2] / 'teaching_website/parts/components/layout.rune').read_text()
        games = layout.split('h3 "%i18n.Nav.games%"', 1)[1].split('div .nav-group:', 1)[0]
        self.assertEqual(
            re.findall(r'click="navigate\(\'([\w-]+)\'\)"', games),
            ['games', 'vectworms', 'monster-city', 'vect-breach', 'rune-crypt'],
        )

    def test_stale_compiler_is_rejected_before_overwriting_a_working_site(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / 'site'
            destination.mkdir()
            previous = destination / 'index.html'
            previous.write_text('Working site')
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.2.18\n')) as command:
                with self.assertRaisesRegex(RuntimeError, '0.3.4.*Pixel 3D'):
                    build_site(destination, Path(folder) / 'old-compiler')
                self.assertEqual(command.call_count, 1)
            self.assertEqual(previous.read_text(), 'Working site')
            self.assertFalse((destination / 'assets').exists())

    def test_previous_pixel_compiler_is_rejected_for_rune_crypt(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.3.3\n')):
                with self.assertRaisesRegex(RuntimeError, '0.3.4.*Rune Crypt'):
                    build_site(Path(folder) / 'site', Path(folder) / 'old-compiler')


if __name__ == '__main__':
    unittest.main()
