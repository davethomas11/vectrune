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
from release_metadata import sync_release

SITE = Path(__file__).resolve().parent
LOCALES = [("en_us", ""), ("es", "es"), ("fr", "fr")]
def check_compiler(binary):
    try:
        release_version, _ = sync_release()
    except (KeyError, OSError, ValueError) as error:
        raise RuntimeError(str(error)) from error
    minimum = tuple(map(int, release_version.split(".")))
    result = subprocess.run([str(binary), "--version"], capture_output=True, text=True, check=True)
    version = re.search(r'\b(\d+)\.(\d+)\.(\d+)\b', result.stdout)
    if not version or tuple(map(int, version.groups())) < minimum:
        raise RuntimeError(
            f"{binary} embeds an older browser runtime ({result.stdout.strip()}). "
            f"This site requires Vectrune {release_version} or newer. "
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
    return sorted(set(re.findall(r'^\s*"([\w/-]+)"\s*->', layout, re.MULTILINE)))


def starfall_web_app(html, directory):
    """Give the standalone game a Home Screen launch with no browser chrome."""
    html = re.sub(r'''<link\b[^>]*\brel=["']apple-touch-icon["'][^>]*>\s*''', '', html, flags=re.IGNORECASE)
    manifest = {
        "id": "./", "name": "Starfall Protocol", "short_name": "Starfall",
        "start_url": "./index.html?launch=homescreen", "scope": "./",
        "display": "fullscreen", "display_override": ["fullscreen", "standalone"],
        "orientation": "landscape", "theme_color": "#080d1b", "background_color": "#080d1b",
        "icons": [{"src": "../../rune-logo.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any"}],
    }
    (directory / 'manifest.webmanifest').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    metadata = '''<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="../../rune-logo.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Starfall">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="theme-color" content="#080d1b">
'''
    return html.replace('</head>', metadata + '</head>', 1)


def build_site(destination, binary, base="/", selected_routes=None, site_url="https://vectrune.com"):
    destination = Path(destination).resolve()
    binary = str(Path(binary).resolve())
    check_compiler(binary)
    base = "/" + base.strip("/") + "/" if base.strip("/") else "/"
    navigation = routes()
    requested = selected_routes if selected_routes is not None else navigation
    inventory = [route for route in requested if route != 'docs' and not route.startswith('docs/')]
    assets = destination / "assets"
    chunks = assets / "routes"
    chunks.mkdir(parents=True, exist_ok=True)
    # Chunk export writes <route>.json; nested docs routes need parent folders.
    for route in navigation:
        (chunks / route).parent.mkdir(parents=True, exist_ok=True)
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
    for slug, entry in [("vectraiders", "space_invaders/space_invaders.rune"),
                        ("vectworms", "vectworms/vectworms.rune"),
                        ("tic-tac-toe", "tic_tac_toe/tic_tac_toe.rune"),
                        ("monster-city", "monster_city/site_shell.rune"),
                        ("vect-breach", "vect_breach/site_shell.rune"),
                        ("rune-crypt", "rune_crypt/rune_crypt.rune"),
                        ("skybound-2", "skybound_2/skybound_2.rune"),
                        ("starfall", "starfall/starfall.rune"),
                        ("marble-run", "marble_run/marble_run.rune"),
                        ("dog-walker", "dog_walker/dog_walker.rune"),
                        ("neon-circuit", "neon_circuit/neon_circuit.rune")]:
        game = assets / "games" / slug
        game.mkdir(parents=True, exist_ok=True)
        result = subprocess.run([binary, str(SITE.parent / "examples/games" / entry), "-o", "html"], capture_output=True, text=True, encoding="utf-8", check=True)
        if slug not in {"vectraiders", "vectworms", "tic-tac-toe"} and not re.search(r'"controls"\s*:\s*\{', result.stdout):
            raise RuntimeError(f"{binary} did not compile {slug}'s @Controls profile. "
                               "Build the compiler from this checkout (omit --binary).")
        html = starfall_web_app(result.stdout, game) if slug == 'starfall' else result.stdout
        (game / "index.html").write_text(html, encoding="utf-8")
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
    from build_api_docs import build_docs
    docs_selected = None if selected_routes is None else [route for route in selected_routes if route == 'docs' or route.startswith('docs/')]
    docs_routes = build_docs(destination, binary, base, site_url, docs_selected)
    manifest = {"locales": [folder for _, folder in LOCALES], "routes": list(dict.fromkeys(["home", *inventory, *docs_routes]))}
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
    parser.add_argument("--binary", help="Use a compiler at least as new as release.json; otherwise build this checkout")
    parser.add_argument("--output", required=True)
    parser.add_argument("--base", default="/")
    parser.add_argument("--site-url", default="https://vectrune.com", help="Public site origin for docs canonical URLs and sitemap")
    parser.add_argument("--serve", action="store_true", help="Serve the generated site on localhost")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    try:
        binary = args.binary or workspace_compiler()
        manifest = build_site(args.output, binary, args.base, site_url=args.site_url)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(2, str(error) + "\n")
    print(f"Rendered {len(manifest['routes'])} routes in {len(LOCALES)} locales to {args.output}")
    if args.serve:
        serve_site(args.output, args.port, args.base)
