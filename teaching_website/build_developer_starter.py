"""Produce a reproducible, checked-in download from the tested starter sources."""
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
DESTINATION = ROOT / 'teaching_website/content/developer/starter.zip'
README = '''Vectrune 0.3.1 developer starter

Install Vectrune 0.3.1 or newer from:
https://github.com/davethomas11/vectrune/releases
macOS/Homebrew: brew install davethomas11/vectrune/vectrune
For an existing installation: brew update && brew upgrade vectrune

Open a terminal in the extracted folder and run:
  vectrune --version
  vectrune doctor .
  vectrune fmt . --check
  vectrune check . --deny-warnings
  vectrune test .
Expected: 5 passed, 0 failed.

During development:
  vectrune test . --watch

The fixture and suite hooks are in api.test.rune. Tests use the real native
router without opening a port. Each test starts with fresh Rune memory.
External files/databases are not rolled back. Main execution and cleanup each
have a bounded timeout. Ctrl-C stops watch mode; abrupt process termination
cannot guarantee teardown. The included GitHub workflow is pinned to 0.3.1.

Run the server separately if wanted:
  vectrune app.rune
  curl http://127.0.0.1:3000/health
'''


def files():
    return {
        'app.rune': (ROOT / 'examples/testing/app.rune').read_text(encoding='utf-8').encode('utf-8'),
        'api.test.rune': (ROOT / 'examples/testing/api.test.rune').read_text(encoding='utf-8').encode('utf-8'),
        '.github/workflows/rune.yml': (ROOT / 'examples/testing/ci.yml').read_text(encoding='utf-8').encode('utf-8'),
        'README.txt': README.encode('utf-8'),
    }


def archive():
    result = BytesIO()
    with ZipFile(result, 'w', compression=ZIP_DEFLATED) as target:
        for name, content in sorted(files().items()):
            info = ZipInfo(name, date_time=(2026, 11, 12, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            target.writestr(info, content)
    return result.getvalue()


if __name__ == '__main__':
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_bytes(archive())
    print(DESTINATION)
