"""Build safety checks: new templates must not ship with the old locale router."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'teaching_website'))
from build_site import build_site


class TeachingBuildTests(unittest.TestCase):
    def test_stale_compiler_is_rejected_before_overwriting_a_working_site(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / 'site'
            destination.mkdir()
            previous = destination / 'index.html'
            previous.write_text('Working site')
            with patch('build_site.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'vectrune 0.2.18\n')) as command:
                with self.assertRaisesRegex(RuntimeError, '0.2.20.*language routing'):
                    build_site(destination, Path(folder) / 'old-compiler')
                self.assertEqual(command.call_count, 1)
            self.assertEqual(previous.read_text(), 'Working site')
            self.assertFalse((destination / 'assets').exists())


if __name__ == '__main__':
    unittest.main()
