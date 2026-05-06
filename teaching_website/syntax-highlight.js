(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createStash() {
    const tokens = new Map();
    let nextIndex = 0;

    function encodeIndex(index) {
      let current = index + 1;
      let encoded = '';
      while (current > 0) {
        current -= 1;
        encoded = String.fromCharCode(65 + (current % 26)) + encoded;
        current = Math.floor(current / 26);
      }
      return encoded;
    }

    return {
      stash(html) {
        const key = `VTTOK${encodeIndex(nextIndex)}END`;
        tokens.set(key, html);
        nextIndex += 1;
        return key;
      },
      restore(text) {
        let output = text;
        let previous = null;
        while (output !== previous) {
          previous = output;
          tokens.forEach((value, key) => {
            output = output.split(key).join(value);
          });
        }
        return output;
      }
    };
  }

  function wrap(className, text) {
    return `<span class="token ${className}">${text}</span>`;
  }

  function findCommentStart(line) {
    let inString = false;
    let escaped = false;

    for (let index = 0; index < line.length; index += 1) {
      const ch = line[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString && ch === '#' && line[index + 1] !== '!') {
        return index;
      }
    }

    return -1;
  }

  function highlightInterpolation(escapedText, stash) {
    return escapedText.replace(/\{[A-Za-z_][A-Za-z0-9_.:\[\]-]*\}/g, (match) => {
      return stash(wrap('interpolation', match));
    });
  }

  function highlightRuneString(raw, stash) {
    let escaped = escapeHtml(raw);
    escaped = escaped.replace(/\\./g, (match) => wrap('escape', match));
    escaped = highlightInterpolation(escaped, stash);
    return wrap('string', escaped);
  }

  function applyRuneLinePatterns(escapedLine, stash) {
    let line = escapedLine;

    line = line.replace(/^(\s*)(import)(\b)/, (_m, indent, keyword, boundary) => {
      return `${indent}${stash(wrap('keyword', keyword))}${boundary}`;
    });

    line = line.replace(/^([ \t]*)(@)([A-Za-z][A-Za-z0-9]*)(?:(\/)([A-Za-z0-9_-]+)(?:\s+(.+))?)?$/, (_m, indent, at, section, slash, id, qualifier) => {
      let output = indent;
      output += stash(wrap('section-punctuation', at));
      output += stash(wrap('section-type', section));
      if (slash && id) {
        output += stash(wrap('section-punctuation', slash));
        output += stash(wrap('section-id', id));
      }
      if (qualifier) {
        output += ` ${stash(wrap('section-qualifier', qualifier))}`;
      }
      return output;
    });

    line = line.replace(/^(\s*)(action)(\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*\([^)]*\))?(\s*:?)$/, (_m, indent, keyword, gap, name, params = '', suffix) => {
      return `${indent}${stash(wrap('keyword', keyword))}${gap}${stash(wrap('function', name))}${params ? stash(wrap('parameters', params)) : ''}${suffix}`;
    });

    line = line.replace(/^(\s*)(func)(\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*\([^)]*\))?(\s*:?)$/, (_m, indent, keyword, gap, name, params = '', suffix) => {
      return `${indent}${stash(wrap('keyword', keyword))}${gap}${stash(wrap('function', name))}${params ? stash(wrap('parameters', params)) : ''}${suffix}`;
    });

    line = line.replace(/^(\s*)(run|state|view|derive|tokens|presets|rules|fields)(\s*:)/, (_m, indent, keyword, colon) => {
      return `${indent}${stash(wrap('block-keyword', keyword))}${stash(wrap('punctuation', colon))}`;
    });

    line = line.replace(/^(\s*)(\+)(\s+)/, (_m, indent, marker, gap) => {
      return `${indent}${stash(wrap('record-marker', marker))}${gap}`;
    });

    line = line.replace(/^(\s*)([A-Za-z_][A-Za-z0-9_.:\[\]-]*)(\s*)(=)(?!=)/, (_m, indent, property, gap, operator) => {
      return `${indent}${stash(wrap('property', property))}${gap}${stash(wrap('operator', operator))}`;
    });

    return line;
  }

  function applyRuneGenericPatterns(escapedLine, stash) {
    let line = escapedLine;

    line = highlightInterpolation(line, stash);

    line = line.replace(/%[A-Z_]+%/g, (match) => stash(wrap('placeholder', match)));
    line = line.replace(/\b(respond|log|validate|parse-json|csv\.read|csv\.write|csv\.append|load-rune|set-memory|get-memory|append)\b/g, (match) => stash(wrap('builtin', match)));
    line = line.replace(/\b(if|else|then|for|in|return|stop|when|from|use|swap|full|or|and|not)\b/g, (match) => stash(wrap('keyword', match)));
    line = line.replace(/\b(true|false|null|draw)\b/g, (match) => stash(wrap('constant', match)));
    line = line.replace(/\b-?(0|[1-9][0-9]*)(\.[0-9]+)?\b/g, (match) => stash(wrap('number', match)));
    line = line.replace(/(==|!=|&lt;=|&gt;=|&lt;-|=&gt;|\+\+|--|\+|-|\*|\/|&amp;|\|)/g, (match) => stash(wrap('operator', match)));

    return line;
  }

  function highlightRune(source) {
    return source.split('\n').map((rawLine) => {
      if (/^#!RUNE\b/.test(rawLine.trimStart())) {
        return wrap('shebang', escapeHtml(rawLine));
      }

      const commentStart = findCommentStart(rawLine);
      const codePart = commentStart === -1 ? rawLine : rawLine.slice(0, commentStart);
      const commentPart = commentStart === -1 ? '' : rawLine.slice(commentStart);
      const { stash, restore } = createStash();

      let line = codePart.replace(/"(?:\\.|[^"\\])*"/g, (match) => stash(highlightRuneString(match, stash)));
      line = escapeHtml(line);
      line = applyRuneLinePatterns(line, stash);
      line = applyRuneGenericPatterns(line, stash);
      line = restore(line);

      const highlightedComment = commentPart ? wrap('comment', escapeHtml(commentPart)) : '';
      return line + highlightedComment;
    }).join('\n');
  }

  function highlightShellString(raw) {
    let escaped = escapeHtml(raw);
    escaped = escaped.replace(/\\./g, (match) => wrap('escape', match));
    return wrap('string', escaped);
  }

  function highlightShell(source) {
    return source.split('\n').map((rawLine) => {
      const trimmed = rawLine.trimStart();
      if (trimmed.startsWith('#')) {
        return wrap('comment', escapeHtml(rawLine));
      }

      const { stash, restore } = createStash();
      let line = rawLine.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => stash(highlightShellString(match)));
      line = escapeHtml(line);

      line = line.replace(/^(\s*)([A-Za-z_.:-][A-Za-z0-9_.:-]*)(?=\s|$)/, (_m, indent, command) => {
        return `${indent}${stash(wrap('command', command))}`;
      });
      line = line.replace(/(^|\s)(--?[A-Za-z][\w-]*|--)(?=\s|$)/g, (_m, prefix, flag) => `${prefix}${stash(wrap('flag', flag))}`);
      line = line.replace(/https?:\/\/[^\s]+/g, (match) => stash(wrap('url', match)));
      line = line.replace(/\b-?(0|[1-9][0-9]*)(\.[0-9]+)?\b/g, (match) => stash(wrap('number', match)));

      return restore(line);
    }).join('\n');
  }

  function languageFromClassName(className) {
    const match = String(className || '').match(/language-([\w-]+)/);
    return match ? match[1].toLowerCase() : '';
  }

  function highlightElement(element) {
    const language = languageFromClassName(element.className);
    const source = element.textContent.replace(/\r\n?/g, '\n');

    if (language === 'rune') {
      element.innerHTML = highlightRune(source);
    } else if (language === 'powershell' || language === 'bash' || language === 'shell') {
      element.innerHTML = highlightShell(source);
    } else {
      element.innerHTML = escapeHtml(source);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre code[class*="language-"]').forEach(highlightElement);
  });
})();



