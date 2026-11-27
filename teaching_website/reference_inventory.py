"""Read public command registries without mistaking internal methods for language APIs."""
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'knowledge/reference/library.json'


def native_names():
    source = (ROOT / 'src/builtins.rs').read_text(encoding='utf-8')
    blocks = re.findall(r'let (?:core_builtins|ws_builtins|db_builtins) = \[([\s\S]*?)\];', source)
    if not blocks:
        raise ValueError('Native builtin registry changed; update reference inventory extraction')
    return {name for block in blocks for name in re.findall(r'"([^"\n]+)"', block)}


def web_commands():
    directory = ROOT / 'runtime/rune-web/src/builtins'
    registered = set(re.findall(r'registerCommand\((\w+)\)', (directory / 'index.ts').read_text(encoding='utf-8')))
    if not registered:
        raise ValueError('Frontend command registry changed; update reference inventory extraction')
    entries = []
    parsed = set()
    for path in sorted(directory.glob('*.ts')):
        source = path.read_text(encoding='utf-8')
        for symbol, body in re.findall(r'export const (\w+): BuiltinCommand = \{(.*?)^\}', source, re.S | re.M):
            if symbol not in registered:
                continue
            names = []
            for block in re.findall(r'(?:prefix|postfix|infix):\s*\[([^]]*)\]', body):
                names.extend(match[1] for match in re.findall(r"""(['"])([^'"\n]+)\1""", block))
                if re.search(r'\bSTOP\b', block):
                    names.append('stop')
            signature = re.search(r"""signature:\s*(['"])([^'"\n]+)\1""", body)
            description = re.search(r"""description:\s*(['"])([^'"\n]+)\1""", body)
            if not names or not description:
                raise ValueError(f'Add a reference parser for command {symbol} in {path}')
            name = names[0]
            entries.append(dict(
                id=name, category='web', name=name,
                signature=signature[2] if signature else name,
                summary=description[2].rstrip('.') + '.', aliases=names[1:],
                sources=[str(path.relative_to(ROOT))],
                notes=['Rune-Web command; this registration does not make it a native REST builtin.'],
                returns=WEB_RESULTS.get(name, 'Command-specific value or state mutation as described by its signature.'),
                errors=WEB_ERRORS.get(name, 'An unmatched command form is not handled. These commands do not return HTTP status codes.'),
            ))
            parsed.add(symbol)
            if symbol == 'locationCommand':
                current = entries[-1]
                current['aliases'] = []
                current['summary'] = 'Request the browser location, prompting for permission if necessary.'
                current['returns'] = 'Calls the success action with latitude, longitude, accuracy and timestamp.'
                current['errors'] = 'Calls the optional catch action on failure; otherwise logs a warning.'
                entries.append({**current, 'id': 'location.if-granted', 'name': 'location.if-granted',
                                'signature': current['signature'].replace('location.current', 'location.if-granted'),
                                'summary': 'Request the browser location only when permission is already granted.',
                                'errors': 'Calls the optional catch action if permission is not granted or location fails; otherwise logs a warning.'})
    if parsed != registered:
        raise ValueError('Every registered frontend command must have a reference entry')
    return entries


WEB_RESULTS = {
    'log': 'Writes the evaluated message to the host console.',
    'delete': 'Removes a value at the supplied path from frontend state/locals.',
    'invert': 'Negates the current truth value and stores the new boolean at the path.',
    'increment': 'Updates the path and returns its new numeric value. Postfix ++ adds one.',
    'decrement': 'Updates the path and returns its new numeric value. Postfix -- subtracts one.',
    'swap': 'With A and B: switches the target between those values. With one value: assigns it.',
    'stop': 'Stops the current action statement sequence.',
    'push': 'Appends a value and writes the array back to its state path.',
    'max': 'Maximum after numeric coercion. Requires a nonempty array.',
    'min': 'Minimum after numeric coercion. Requires a nonempty array.',
    'sum': 'Sum after numeric coercion; the empty array produces zero.',
    'avg': 'Arithmetic mean after numeric coercion. Requires a nonempty array.',
    'count': 'Array length or object key count; other values produce zero.',
    'flatten': 'New recursively flattened array; nested arrays of any depth are expanded.',
    'unique': 'New array with JavaScript Set uniqueness semantics; objects compare by identity.',
    'clone': 'JSON deep copy; use the to form to write it to a destination.',
    'randomize': 'An inclusive random integer for numeric bounds, or a shuffled copy of an array.',
    'delay': 'Blocks synchronously for the duration. Bare numbers and ms use milliseconds; s uses seconds.',
    'start-timer': 'Starts the app periodic timer calling the named action; not a returned timer ID.',
    'stop-timer': 'Stops the app active periodic timer.',
}
WEB_ERRORS = {'delay': 'Malformed duration is not handled. The implementation busy-waits and blocks the UI; avoid long delays.'}


def help_entries(binary):
    """Only --help is executed; subcommand usage remains tied to the build compiler."""
    entries = []
    queue = [((), 'Run scripts, serve apps, and convert structured documents.')]
    while queue:
        command, summary = queue.pop(0)
        output = subprocess.run([str(Path(binary).resolve()), *command, '--help'], capture_output=True, text=True, encoding='utf-8', check=True).stdout
        usage = re.search(r'^Usage: (.+)$', output, re.M)
        name = 'vectrune' + (' ' + ' '.join(command) if command else '')
        entries.append(dict(id='-'.join(command) or 'vectrune', category='cli', name=name,
                            signature=usage[1] if usage else name, summary=summary,
                            sources=['src/main.rs'], help=output,
                            notes=['Usage and options are read from the compiler used to build this site.']))
        block = re.search(r'^Commands:\n(.*?)(?:\n\n|\Z)', output, re.S | re.M)
        if block:
            for child, description in re.findall(r'^  ([\w-]+)\s{2,}(.+)$', block[1], re.M):
                if child != 'help':
                    queue.append(((*command, child), description))
        for option, description in re.findall(r'^ +(-\S.*?) {2,}(\S.*)$', output, re.M):
            flags = re.findall(r'--[\w-]+', option)
            if flags and not (command and flags[0] == '--help'):
                entries.append(dict(id='-'.join([*command, flags[0].lstrip('-')]), category='cli', name=name + ' ' + flags[0], signature=name + ' ' + option,
                                    summary=description, sources=['src/main.rs'], aliases=[name + ' ' + flag for flag in re.findall(r'(?<!\S)-\w\b', option)]))
    return entries


def inventory(binary=None):
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    entries = catalog['entries'] + web_commands()
    covered = {name for entry in entries for name in [entry['name'], *entry.get('aliases', [])]}
    missing = native_names() - covered - {'#'}
    if missing:
        raise ValueError('Document native builtins before publishing: ' + ', '.join(sorted(missing)))
    if binary:
        entries += help_entries(binary)
    keys = set()
    categories = {category['id'] for category in catalog['categories']}
    for entry in entries:
        key = (entry['category'], entry['id'])
        if key in keys or entry['category'] not in categories:
            raise ValueError(f'Duplicate or unknown reference entry: {key}')
        keys.add(key)
        for source in entry['sources']:
            if not (ROOT / source).is_file():
                raise ValueError(f'Reference source is missing: {source}')
        entry.setdefault('runtime', {
            'native': 'Native / server', 'collections': 'Native / server',
            'web': 'Rune-Web', 'expressions': 'Rune-Web / game logic', 'host': 'Rune-Web host',
            'cli': 'CLI', 'testing': 'Test harness', 'games': 'Pixel / Pixel 3D',
            'declarations': 'Declaration compiler / host-specific',
            'language': 'Document / runtime-specific syntax', 'environment': 'Native / CLI',
        }.get(entry['category'], 'Host-specific'))
    catalog['entries'] = entries
    return catalog
