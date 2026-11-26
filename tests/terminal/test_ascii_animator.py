"""Native POSIX terminal checks; run after cargo build --bin vectrune."""
import fcntl
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import sys
import tempfile
import termios
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
BINARY = ROOT / "target/debug/vectrune"


@unittest.skipUnless(os.name == "posix", "PTY checks require POSIX")
class AsciiTerminalTests(unittest.TestCase):
    def play(self, args, key=None, resize=False, exit_after=None):
        master, slave = pty.openpty()
        original = termios.tcgetattr(slave)
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 90, 0, 0))
        process = subprocess.Popen(
            [str(BINARY), *args], stdin=slave, stdout=slave, stderr=slave, cwd=ROOT
        )
        output = bytearray()
        deadline = time.monotonic() + 8
        sent = False
        try:
            while time.monotonic() < deadline:
                if select.select([master], [], [], 0.05)[0]:
                    output.extend(os.read(master, 65536))
                if b"ASCII Animator |" in output and not sent:
                    if resize:
                        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 5, 20, 0, 0))
                    if key is not None:
                        os.write(master, key)
                    sent = True
                if exit_after is not None and exit_after in output:
                    os.write(master, b"\x1b")
                    exit_after = None
                if process.poll() is not None:
                    while select.select([master], [], [], 0)[0]:
                        output.extend(os.read(master, 65536))
                    break
            self.assertIsNotNone(process.poll(), "Terminal animation failed to exit")
            restored = termios.tcgetattr(slave)
            # macOS may set the kernel's pending-input redisplay flag after cooked output.
            for settings in (restored, original):
                settings[3] &= ~getattr(termios, "PENDIN", 0)
            self.assertEqual(restored, original, "Input mode was not restored")
            self.assertIn(b"\x1b[?1049h", output)
            self.assertIn(b"\x1b[?1049l", output)
            self.assertIn(b"\x1b[?25h", output)
            return process.returncode, bytes(output)
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=3)
            os.close(master)
            os.close(slave)

    def test_bounded_interactive_playback(self):
        code, output = self.play(["ascii", "run", "examples/ascii/aquarium.rune", "--frames", "3"])
        self.assertEqual(code, 0, output)
        self.assertIn(b"\x1b[", output)

    def test_gif_playback_and_keyboard_exit_restore_terminal(self):
        gif = bytes.fromhex(
            "47494638396101000100800000000000ffffff"
            "21f904000a0000002c0000000001000100000202440100"
            "21f90400140000002c00000000010001000002024c01003b"
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "animation.gif"
            path.write_bytes(gif)
            args = ["ascii", "image", str(path), "--play", "--width", "2"]
            code, output = self.play([*args, "--frames", "20"])
            self.assertEqual(code, 0, output)
            self.assertIn(b"@@", output)
            code, output = self.play(args, key=b"q")
            self.assertEqual(code, 0, output)

    def test_clean_keyboard_exits(self):
        for key in [b"q", b"\x1b", b"\x03"]:
            with self.subTest(key=key):
                code, output = self.play(["ascii", "run", "examples/ascii/paddle.rune"], key=key)
                self.assertEqual(code, 0, output)

    def test_ascii3d_bounded_playback(self):
        for demo in ["sentinel", "halls", "descent"]:
            with self.subTest(demo=demo):
                code, output = self.play(["ascii", "run", f"examples/ascii/{demo}.rune", "--frames", "3", "--mute"])
                self.assertEqual(code, 0, output)

    def test_direct_ascii_launch_can_skip_audio_device(self):
        code, output = self.play(["examples/ascii/sentinel.rune", "--mute"], key=b"q")
        self.assertEqual(code, 0, output)

    def test_adventure_prompt_edits_input_and_does_not_reserve_q(self):
        code, output = self.play(
            ["ascii", "run", "examples/ascii/borrowed_morning.rune", "--mute"],
            key=b"q\x15begin\rtalk to kettlex\x7f\r",
            exit_after=b"seventeen times",
        )
        self.assertEqual(code, 0, output)
        self.assertIn(b"seventeen times", output)

    def test_can_exit_after_terminal_shrinks(self):
        code, output = self.play(["ascii", "run", "examples/ascii/paddle.rune"], key=b"q", resize=True)
        self.assertEqual(code, 0, output)

    def test_runtime_error_restores_terminal(self):
        source = (ROOT / "examples/ascii/paddle.rune").read_text()
        source = source.replace("action tick:\n", 'action tick:\n    canvas = [{"type": "invalid"}]\n    stop\n')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "error.rune"
            path.write_text(source)
            code, output = self.play(["ascii", "run", str(path)])
        self.assertNotEqual(code, 0)
        self.assertIn(b"Invalid ASCII canvas", output)


if __name__ == "__main__":
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        BINARY = Path(sys.argv.pop(1)).resolve()
    unittest.main()
