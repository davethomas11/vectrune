"""Validate release metadata and generate the Rune state used by the site."""

import argparse
from datetime import date
import json
from pathlib import Path
import re
import tomllib

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
SOURCE = SITE / "release.json"
GENERATED = SITE / "parts/release.generated.rune"
LOCALES = ("en_us", "es", "fr")
GITHUB = "https://github.com/davethomas11/vectrune"


def release_archive(data):
    """Validate the checked-in history and derive its public destinations."""
    releases = data.get("releases")
    current_tag = f"v{data['version']}"
    if not isinstance(releases, list) or not releases:
        raise ValueError(f"{SOURCE.name} needs a release archive")

    archive = []
    previous = None
    for entry in releases:
        tag = entry.get("tag", "") if isinstance(entry, dict) else ""
        if not isinstance(tag, str) or not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
            raise ValueError(f"Invalid release archive tag: {tag!r}")
        number = tuple(map(int, tag[1:].split(".")))
        if previous is not None and number >= previous:
            raise ValueError(f"Release archive tags must be unique and newest first: {tag}")
        previous = number
        summary = entry.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            raise ValueError(f"{tag} needs a release summary")
        for field in ("tagged_on", "published_on"):
            if field not in entry:
                raise ValueError(f"{tag} needs {field}")
            value = entry[field]
            if value is not None:
                if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                    raise ValueError(f"{tag} {field} must use YYYY-MM-DD or null")
                date.fromisoformat(value)
        tagged = entry["tagged_on"]
        published = entry["published_on"]
        remote = entry.get("github_tag")
        if not isinstance(remote, bool) or (published and not remote) or (remote and not tagged):
            raise ValueError(f"{tag} has inconsistent GitHub publication metadata")
        if not tagged and tag != current_tag:
            raise ValueError(f"Past release {tag} needs a tag date")
        status = "published" if published else "tag" if remote else "unpublished"
        url = f"{GITHUB}/releases/tag/{tag}" if published else f"{GITHUB}/tree/{tag}" if remote else None
        archive.append({
            "tag": tag,
            "date": published or tagged,
            "status": status,
            "url": url,
            "summary": summary,
            "current": tag == current_tag,
        })
    if archive[0]["tag"] != current_tag:
        raise ValueError(f"Release archive must start with {current_tag}")
    return archive


def sync_release(*, write=False, expected_version=None, tag=None):
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    version = data["version"]
    if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError(f"{SOURCE.name} needs a numeric major.minor.patch version")
    if expected_version is None:
        expected_version = tomllib.loads((ROOT / "Cargo.toml").read_text(encoding="utf-8"))["package"]["version"]
    if version != expected_version:
        raise ValueError(f"{SOURCE.name} version {version} does not match {expected_version}")
    if tag is not None and tag != f"v{version}":
        raise ValueError(f"Release tag {tag} does not match {SOURCE.name} (v{version})")
    locales = data["locales"]
    for locale in LOCALES:
        for field in ("intro", "summary"):
            value = locales.get(locale, {}).get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{SOURCE.name} needs {locale}.{field} text")
    notes = ROOT / "docs/releases" / f"v{version}.md"
    if not notes.is_file() or not notes.read_text(encoding="utf-8").strip():
        raise ValueError(f"Missing release notes: {notes.relative_to(ROOT)}")
    archive = release_archive(data)
    state = {
        "version": version,
        "locales": locales,
        "releases": archive,
        "github_url": f"{GITHUB}/releases",
        "current_url": archive[0]["url"] or f"{GITHUB}/releases",
    }
    payload = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    rune = f"# Generated from teaching_website/release.json. Do not edit.\n@Logic/teaching\nstate:\n    release_info = {payload}\n"
    if write:
        GENERATED.write_text(rune, encoding="utf-8")
    elif not GENERATED.is_file() or GENERATED.read_text(encoding="utf-8") != rune:
        raise ValueError("Stale release state. Run python3 teaching_website/release_metadata.py --write")
    return version, notes


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Regenerate the Rune state from release.json")
    parser.add_argument("--version", help="Check a planned version in place of the current Cargo version")
    parser.add_argument("--tag", help="Check the release tag before publishing")
    args = parser.parse_args()
    try:
        version, _ = sync_release(write=args.write, expected_version=args.version, tag=args.tag)
    except (KeyError, OSError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    print(f"Release metadata validated for {version}")
