"""Build every teaching-site route and locale for static hosting.

    python3 teaching_website/build_site.py --binary target/release/vectrune --output _site
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SITE = Path(__file__).resolve().parent
LOCALES = [("en_us", ""), ("es", "es"), ("fr", "fr")]
MIN_COMPILER = (0, 2, 20)


def check_compiler(binary):
    result = subprocess.run([str(binary), "--version"], capture_output=True, text=True, check=True)
    version = re.search(r'\b(\d+)\.(\d+)\.(\d+)\b', result.stdout)
    if not version or tuple(map(int, version.groups())) < MIN_COMPILER:
        raise RuntimeError(
            f"{binary} embeds an older browser runtime ({result.stdout.strip()}). "
            "This site requires Vectrune 0.2.20 or newer for language routing. "
            "Omit --binary to build the compiler from this checkout; "
            "do not use an older Homebrew binary to render the updated teaching templates."
        )


def workspace_compiler():
    root = SITE.parent
    subprocess.run(["npm", "run", "build"], cwd=root / "runtime/rune-web", check=True)
    subprocess.run(["cargo", "build", "--bin", "vectrune"], cwd=root, check=True)
    return root / "target/debug/vectrune"


def routes():
    """Use the actual navigation cases as the inventory, including aliases."""
    layout = (SITE / "parts/components/layout.rune").read_text(encoding="utf-8")
    return sorted(set(re.findall(r'^\s*"([\w-]+)"\s*->', layout, re.MULTILINE)))


def build_site(destination, binary, base="/", selected_routes=None):
    destination = Path(destination).resolve()
    binary = str(Path(binary).resolve())
    check_compiler(binary)
    base = "/" + base.strip("/") + "/" if base.strip("/") else "/"
    inventory = selected_routes if selected_routes is not None else routes()
    assets = destination / "assets"
    chunks = assets / "routes"
    chunks.mkdir(parents=True, exist_ok=True)
    source = (SITE / "teaching.rune").read_text(encoding="utf-8")
    with tempfile.NamedTemporaryFile(dir=SITE, suffix=".rune", delete=False) as file:
        temporary = Path(file.name)
    try:
        for locale, folder in LOCALES:
            temporary.write_text(source.replace("locale = en_us", f"locale = {locale}"), encoding="utf-8")
            for route in dict.fromkeys(["home", *inventory]):
                prefix = f"/{folder}" if folder else ""
                request = prefix + (f"/{route}" if route != "home" else "/")
                command = [binary, str(temporary), "-o", "html", "--path", request]
                if route == "home":
                    command += ["--chunks-dir", str(chunks)]
                result = subprocess.run(
                    command,
                    capture_output=True, text=True, encoding="utf-8", check=True,
                )
                output = destination / folder / (route if route != "home" else "")
                output.mkdir(parents=True, exist_ok=True)
                html = result.stdout
                if base != "/":
                    html = re.sub(r'(src|content)="(/assets/[^\"]*)"', lambda match: match[1] + '="' + base.rstrip('/') + match[2] + '"', html)
                    html = re.sub(r'href="(/(?!/)[^"]*)"', lambda match: 'href="' + (match[1] if match[1].startswith(base) else base.rstrip('/') + match[1]) + '"', html)
                    html = html.replace("<head>", f'<head><meta name="rune-base-path" content="{base}">', 1)
                (output / "index.html").write_text(html, encoding="utf-8")
    finally:
        temporary.unlink(missing_ok=True)
    for pattern in ["*.js", "*.css", "*.png", "*.ico"]:
        for asset in SITE.glob(pattern):
            shutil.copyfile(asset, assets / asset.name)
    for name in ["favicon.ico", "favicon.png"]:
        if (SITE / name).exists():
            shutil.copyfile(SITE / name, destination / name)
    # A stable same-origin game URL preserves localStorage across locale changes
    # and reloads; data-URI previews have opaque origins and cannot do that.
    game = assets / "games/monster-city"
    game.mkdir(parents=True, exist_ok=True)
    result = subprocess.run([binary, str(SITE.parent / "examples/monster_city/site_shell.rune"), "-o", "html"], capture_output=True, text=True, encoding="utf-8", check=True)
    (game / "index.html").write_text(result.stdout, encoding="utf-8")
    from build_developer_starter import archive
    developer = assets / 'content/developer'
    developer.mkdir(parents=True, exist_ok=True)
    (developer / 'starter.zip').write_bytes(archive())
    shutil.copyfile(SITE / "content/quickstart/app.rune", assets / "first-api.rune")
    (assets / 'content/quickstart').mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SITE / 'content/quickstart/app.rune', assets / 'content/quickstart/app.rune')
    if (SITE / "pkg").exists():
        shutil.copytree(SITE / "pkg", assets / "pkg", dirs_exist_ok=True)
    shutil.copyfile(destination / "index.html", destination / "404.html")
    (destination / ".nojekyll").touch()
    manifest = {"locales": [folder for _, folder in LOCALES], "routes": list(dict.fromkeys(["home", *inventory]))}
    (destination / "routes.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def serve_site(destination, port, base="/"):
    """Preview the generated routes with the same 404 fallback as Pages."""
    prefix = '/' + base.strip('/') if base.strip('/') else ''

    class Handler(SimpleHTTPRequestHandler):
        def translate_path(self, path):
            if prefix and (path == prefix or path.startswith(prefix + '/')):
                path = path[len(prefix):] or '/'
            return super().translate_path(path)

        def send_error(self, code, message=None, explain=None):
            if code != 404:
                return super().send_error(code, message, explain)
            body = (Path(self.directory) / '404.html').read_bytes()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)

    server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(Path(destination).resolve())))
    print(f"Preview: http://127.0.0.1:{server.server_port}{prefix}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", help="Use an existing compiler (0.2.20+); otherwise build this checkout")
    parser.add_argument("--output", required=True)
    parser.add_argument("--base", default="/")
    parser.add_argument("--serve", action="store_true", help="Serve the generated site on localhost")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    try:
        binary = args.binary or workspace_compiler()
        manifest = build_site(args.output, binary, args.base)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(2, str(error) + "\n")
    print(f"Rendered {len(manifest['routes'])} routes in {len(LOCALES)} locales to {args.output}")
    if args.serve:
        serve_site(args.output, args.port, args.base)
