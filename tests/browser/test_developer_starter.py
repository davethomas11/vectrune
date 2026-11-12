"""Run the published ZIP's exact documented commands on every supported CI host."""
from io import BytesIO
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'teaching_website'))
from build_developer_starter import archive, files, DESTINATION


class StarterTests(unittest.TestCase):
    def test_download_matches_sources_and_passes_documented_workflow(self):
        self.assertEqual(DESTINATION.read_bytes(), archive())
        binary = ROOT / 'target/debug' / ('vectrune.exe' if os.name == 'nt' else 'vectrune')
        with tempfile.TemporaryDirectory(prefix='rune-starter-') as directory:
            with ZipFile(BytesIO(archive())) as bundle:
                self.assertEqual(set(bundle.namelist()), set(files()))
                for name, expected in files().items():
                    self.assertEqual(bundle.read(name), expected)
                bundle.extractall(directory)
            for command in [['doctor', '.'], ['fmt', '.', '--check'], ['check', '.', '--deny-warnings'], ['test', '.', '--json']]:
                result = subprocess.run([str(binary), *command], cwd=directory, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                if command[0] == 'test':
                    report = json.loads(result.stdout)
                    self.assertEqual(report['schema_version'], 1)
                    self.assertEqual(report['passed'], 5)
                    self.assertEqual(report['failed'], 0)
                    self.assertTrue(report['success'])


if __name__ == '__main__':
    unittest.main()
