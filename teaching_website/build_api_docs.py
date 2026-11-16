"""Build the technical dictionary and supporting guides as small static HTML pages.

Content: knowledge/reference/library.json and api-docs.json.
Inventory: native names are checked; frontend commands and CLI help are extracted.
No version paths are used during alpha. Search works entirely in the browser.
"""
from html import escape
import json
from pathlib import Path
import re
import shutil
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

from reference_inventory import ROOT, inventory

GUIDES = ROOT / 'knowledge/reference/api-docs.json'


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def code(value, label='Example'):
    return f'<div class="code-example"><div class="code-caption">{escape(label)}<button type="button" class="docs-copy">Copy</button></div><pre><code>{escape(value)}</code></pre></div>'


def source_links(entry):
    return ' · '.join(f'<a href="https://github.com/davethomas11/vectrune/blob/main/{quote(source)}">{escape(source)}</a>' for source in entry['sources'])


def render_entry(entry):
    symbol = entry['id']
    name = escape(entry['name'])
    parts = [f'<section class="reference-entry" id="{symbol}">',
             f'<h2><code>{name}</code><a class="permalink" href="#{symbol}" aria-label="Link to {name}">¶</a></h2>',
             f'<pre class="signature"><code>{escape(entry["signature"])}</code></pre>',
             f'<p>{escape(entry["summary"])}</p>',
             f'<p class="availability"><strong>Runtime:</strong> {escape(entry["runtime"])}</p>']
    if entry.get('aliases'):
        parts.append('<p><strong>Aliases:</strong> ' + ', '.join('<code>' + escape(alias) + '</code>' for alias in entry['aliases']) + '</p>')
    if entry.get('parameters'):
        parts.append('<h3>Parameters</h3><dl class="parameters">' + ''.join('<dt><code>' + escape(parameter['name']) + '</code></dt><dd>' + escape(parameter['description']) + '</dd>' for parameter in entry['parameters']) + '</dl>')
    for key, label in [('returns', 'Returns / effects'), ('errors', 'Errors / edge cases')]:
        if entry.get(key):
            parts.append(f'<h3>{label}</h3><p>{escape(entry[key])}</p>')
    if entry.get('fields'):
        parts.append('<h3>Fields</h3><div class="table-scroll"><table><thead><tr><th>Field</th><th>Type</th><th>Default</th><th>Meaning</th></tr></thead><tbody>')
        for field in entry['fields']:
            anchor = symbol + '--' + slug(field['name'])
            parts.append(f'<tr id="{anchor}"><th scope="row"><a href="#{anchor}"><code>{escape(field["name"])}</code></a></th><td>{escape(field["type"])}</td><td><code>{escape(field["default"])}</code></td><td>{escape(field["description"])}</td></tr>')
        parts.append('</tbody></table></div>')
    if entry.get('notes'):
        parts.append('<aside class="note"><strong>Note</strong><ul>' + ''.join('<li>' + escape(note) + '</li>' for note in entry['notes']) + '</ul></aside>')
    if entry.get('example'):
        parts.append(code(entry['example']))
    if entry.get('help'):
        parts.append('<details class="command-help"><summary>Complete command help</summary><pre><code>' + escape(entry['help']) + '</code></pre></details>')
    parts.append('<p class="source"><strong>Implementation:</strong> ' + source_links(entry) + '</p></section>')
    return ''.join(parts)


def build_docs(destination, binary, base='/', site_url='https://vectrune.com', selected_routes=None):
    catalog = inventory(binary)
    categories = catalog['categories']
    entries = catalog['entries']
    guides = [page for page in json.loads(GUIDES.read_text())['pages'] if page['route'] != 'docs']
    base = '/' + base.strip('/') + '/' if base.strip('/') else '/'
    destination = Path(destination)
    assets = destination / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    site = ROOT / 'teaching_website'
    for name in ['docs.css', 'docs-search.js']:
        shutil.copyfile(site / name, assets / name)
    downloads = assets / 'content/docs'
    shutil.copytree(site / 'content/docs', downloads, dirs_exist_ok=True)
    for name, source in [('graphql', 'graphql_example'), ('websocket', 'websocket_example')]:
        shutil.copyfile(site / f'parts/pages/examples/{source}.rune', downloads / f'{name}.rune')
    docs_base = base + 'docs/'
    category_map = {category['id']: category for category in categories}
    search = []
    for entry in entries:
        entry['url'] = docs_base + 'library/' + entry['category'] + '/#' + entry['id']
        category = category_map[entry['category']]['title']
        text = json.dumps(entry, ensure_ascii=False)
        search.append(dict(name=entry['name'], category=entry['category'], category_title=category,
                           runtime=entry['runtime'], summary=entry['summary'], signature=entry['signature'],
                           aliases=entry.get('aliases', []), text=text, url=entry['url']))
        for field in entry.get('fields', []):
            name = entry['name'] + '.' + field['name']
            search.append(dict(name=name, category=entry['category'], category_title=category,
                               runtime=entry['runtime'], summary=field['description'],
                               signature=field['name'] + ' = ' + field['type'] + ' (default: ' + field['default'] + ')',
                               aliases=[], text=name + ' ' + json.dumps(field, ensure_ascii=False),
                               url=entry['url'] + '--' + slug(field['name'])))
    search.sort(key=lambda entry: entry['name'].lstrip('@.-').casefold())
    count = len(search)
    sidebar = '<a class="sidebar-home" href="' + docs_base + '">Reference manual</a><a href="' + docs_base + 'index/">A–Z dictionary</a><h2>Library reference</h2>'
    sidebar += ''.join(f'<a href="{docs_base}library/{category["id"]}/">{escape(category["title"])}</a>' for category in categories)
    sidebar += '<h2>Guides</h2>' + ''.join(f'<a href="{base}{page["route"]}/">{escape(page["label"])}</a>' for page in guides)
    sidebar += '<h2>About this reference</h2><a href="' + docs_base + 'coverage/">Coverage and implementation</a>'
    options = '<option value="">All topics</option>' + ''.join(f'<option value="{category["id"]}">{escape(category["title"])}</option>' for category in categories)
    routes = []

    def write(route, title, description, body, toc=''):
        if selected_routes is not None and route not in selected_routes:
            return
        canonical = site_url.rstrip('/') + base + route + '/'
        html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} — Vectrune documentation</title><meta name="description" content="{escape(description, quote=True)}">
<link rel="canonical" href="{escape(canonical, quote=True)}"><link rel="stylesheet" href="{base}assets/docs.css?v=1">
<link rel="icon" href="{base}favicon.ico"><script defer src="{base}assets/docs-search.js?v=1"></script></head>
<body data-search-index="{docs_base}search-index.json"><a class="skip-link" href="#docs-main">Skip to content</a>
<header class="docs-header"><a class="docs-brand" href="{docs_base}">Vectrune <span>documentation</span></a><span class="alpha-label">Alpha reference</span><a class="site-link" href="{base}">Learning site ↗</a></header>
<div class="docs-layout"><aside class="docs-sidebar"><form class="docs-search" role="search" action="{docs_base}">
<label for="reference-search">Search the reference</label><div class="search-input-row"><input id="reference-search" name="q" type="search" autocomplete="off" placeholder="Function, section, or command…" aria-controls="search-results"><button type="submit" aria-label="Search">⌕</button></div>
<label class="filter-label" for="reference-category">Topic</label><select id="reference-category" name="topic">{options}</select></form>
<noscript><p>Search needs JavaScript. <a href="{docs_base}index/">Browse the A–Z index</a>.</p></noscript>
<details class="docs-menu" open><summary>Contents</summary><nav aria-label="Documentation">{sidebar}</nav></details></aside>
<main id="docs-main" tabindex="-1"><section id="search-panel" hidden aria-label="Search results"><h1>Search results</h1><p id="search-status" role="status" aria-live="polite"></p><button id="clear-search" type="button">Clear search</button><ol id="search-results"></ol></section>
<article id="reference-content"><div class="breadcrumbs"><a href="{docs_base}">Reference</a> / {escape(title)}</div><h1>{escape(title)}</h1>{body}</article>
<footer class="docs-footer">Vectrune alpha reference · English · <a href="{docs_base}coverage/">Coverage and source information</a></footer></main>{toc}</div></body></html>'''
        output = destination / route
        output.mkdir(parents=True, exist_ok=True)
        (output / 'index.html').write_text(html, encoding='utf-8')
        routes.append(route)
        # Keep earlier localized docs links usable while content is English.
        for locale in ['es', 'fr']:
            localized = destination / locale / route
            localized.mkdir(parents=True, exist_ok=True)
            (localized / 'index.html').write_text(html, encoding='utf-8')

    intro = f'<p class="lead">A dictionary of language features, functions, declarations, and tools implemented in Vectrune.</p><p>Look up a name, read its signature, and check parameters, results, runtime availability, and implementation limits. This alpha reference uses stable, unversioned URLs.</p><p><a href="{docs_base}index/">Browse all {count} entries and fields alphabetically →</a></p><h2>Library reference</h2><table class="chapter-index"><thead><tr><th>Chapter</th><th>Contents</th></tr></thead><tbody>'
    for category in categories:
        size = sum(entry['category'] == category['id'] for entry in entries)
        intro += f'<tr><th scope="row"><a href="{docs_base}library/{category["id"]}/">{escape(category["title"])}</a><small>{size} entries</small></th><td>{escape(category["description"])}</td></tr>'
    intro += '</tbody></table><aside class="note"><strong>Runtime matters.</strong><p>Native server functions and Rune-Web commands have separate interpreters. Each entry identifies its runtime; a browser command is not automatically available in an HTTP handler.</p></aside>'
    intro += f'<h2>Learning and examples</h2><p><a href="{docs_base}getting-started/">Build your first REST API</a> · <a href="{docs_base}graphql/">GraphQL example</a> · <a href="{docs_base}websockets/">WebSocket example</a></p>'
    write('docs', 'Vectrune reference manual', 'Search the Vectrune language and library reference: functions, sections, parameters, returns, runtime support, and command-line tools.', intro)
    for category in categories:
        chapter = [entry for entry in entries if entry['category'] == category['id']]
        chapter.sort(key=lambda entry: entry['name'].casefold())
        toc = '<aside class="page-toc"><nav aria-label="On this page"><h2>On this page</h2>' + ''.join(f'<a href="#{entry["id"]}">{escape(entry["name"])}</a>' for entry in chapter) + '</nav></aside>'
        body = '<p class="lead">' + escape(category['description']) + '</p>' + ''.join(render_entry(entry) for entry in chapter)
        write('docs/library/' + category['id'], category['title'], category['description'], body, toc)
    # Index aliases separately, pointing to the same canonical definition.
    terms = [(entry['name'], entry, '') for entry in search]
    for entry in search:
        terms.extend((alias, entry, 'Alias of ' + entry['name'] + '. ') for alias in entry['aliases'])
    terms.sort(key=lambda term: term[0].lstrip('@.-').casefold())
    index_body = '<p>Functions, declarations, fields, command-line options, and aliases. Search by name or browse the alphabet.</p>'
    letters = sorted({(name.lstrip('@.-')[:1] or '#').upper() for name, _, _ in terms})
    index_body += '<nav class="alphabet" aria-label="Alphabet">' + ' '.join('<a href="#letter-' + letter + '">' + letter + '</a>' for letter in letters) + '</nav>'
    for letter in letters:
        index_body += f'<section class="index-group" id="letter-{letter}"><h2>{letter}</h2><dl>'
        for name, entry, prefix in terms:
            if (name.lstrip('@.-')[:1] or '#').upper() == letter:
                index_body += f'<dt><a href="{entry["url"]}"><code>{escape(name)}</code></a><span class="index-category">{escape(entry["category_title"])}</span></dt><dd>{escape(prefix + entry["summary"])}</dd>'
        index_body += '</dl></section>'
    write('docs/index', 'General index: A–Z', 'An alphabetical dictionary of implemented Vectrune features, functions, fields, and aliases.', index_body)
    coverage = '<p>This reference follows the current repository implementation. It includes public language/runtime interfaces, not internal Rust or TypeScript methods. Alpha features can change without versioned documentation.</p><h2>Coverage</h2><dl class="parameters">'
    coverage += ''.join('<dt>' + escape(label) + '</dt><dd>' + escape(text) + '</dd>' for label, text in catalog['coverage'].items()) + '</dl>'
    coverage += f'<p>The current build contains {len(entries)} primary entries and {count - len(entries)} field entries. Aliases are indexed separately. Search covers signatures, summaries, aliases, fields, effects, edge cases, and runtime labels.</p><h2>Reading an entry</h2><p>Angle-bracket arguments are placeholders. Square brackets in signatures indicate optional arguments unless they are part of a Rune literal. Examples are fragments unless an application header is shown. Default values marked “—” are unspecified, not necessarily null.</p><h2>Keeping the dictionary current</h2><p>Native builtin coverage is checked against the Rust registry. Frontend command signatures and aliases are extracted from registered TypeScript definitions. Command-line help is read from the compiler used for this build. Declaration fields and semantic descriptions are curated against the linked implementation files.</p><p>The rest of the language is indexed by supported feature families. This inventory does not claim exhaustive field-level coverage of every host-specific extension. Missing detail should be filled from implementation and tests, rather than inferred from an example.</p><h2>Partial integration</h2><p>Memory hooks have parser and observer infrastructure, but the native memory.set path still contains a signal-delivery integration placeholder. Do not assume that declaring a hook automatically makes every memory write broadcast.</p>'
    write('docs/coverage', 'Coverage and implementation', 'How Vectrune documentation is derived from current code and where reference coverage is still being expanded.', coverage)
    for page in guides:
        body = '<p class="lead">' + escape(page['description']) + '</p>'
        for section in page['sections']:
            body += '<section id="' + slug(section['title']) + '"><h2>' + escape(section['title']) + '</h2>'
            body += ''.join('<p>' + escape(paragraph) + '</p>' for paragraph in section.get('paragraphs', []))
            if section.get('items'):
                body += '<ul>' + ''.join('<li>' + escape(item) + '</li>' for item in section['items']) + '</ul>'
            if section.get('source'):
                body += code((ROOT / section['source']).read_text(), 'Rune source')
            if section.get('command'):
                body += code(section['command'], 'Command / usage')
            for link in section.get('links', []):
                href = base + link['route'] + '/' if 'route' in link else base.rstrip('/') + link['href']
                body += '<p><a href="' + escape(href, quote=True) + '"' + (' download' if 'href' in link else '') + '>' + escape(link['label']) + '</a></p>'
            body += '</section>'
        write(page['route'], page['title'], page['description'], body)
    (destination / 'docs').mkdir(parents=True, exist_ok=True)
    (destination / 'docs/search-index.json').write_text(json.dumps(search, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    urls = ''.join('<url><loc>' + xml_escape(site_url.rstrip('/') + base + route + '/') + '</loc></url>' for route in routes)
    (destination / 'docs/sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + '</urlset>\n', encoding='utf-8')
    return routes


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--binary', default=ROOT / 'target/debug/vectrune', type=Path)
    args = parser.parse_args()
    print(f'Rendered {len(build_docs(args.output, args.binary))} documentation pages')
