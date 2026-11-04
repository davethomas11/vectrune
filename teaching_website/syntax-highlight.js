(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createStash(source) {
    const tokens = new Map();
    let nextIndex = 0;
    let prefix = 'VTTOK';
    while (source.includes(prefix)) prefix += 'X';

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
        const key = `${prefix}${encodeIndex(nextIndex)}END`;
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
    let quote = '';
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
      if (ch === '"' || ch === "'") {
        if (!quote) quote = ch;
        else if (quote === ch) quote = '';
        continue;
      }
      if (!quote && ch === '#' && line[index + 1] !== '!') {
        // Schema references and style colors are code, rather than comments.
        if (line.slice(0, index).trim() && /^#[A-Za-z0-9_]/.test(line.slice(index))) continue;
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
    let escaped = raw.replace(/\\./g, (match) => stash(wrap('escape', escapeHtml(match))));
    escaped = escapeHtml(escaped);
    escaped = escaped.replace(/\{[^{}\n]+\}|%i18n\.[\w.]+%|%[A-Z_]+%/g, (match) => stash(wrap('interpolation', match)));
    return wrap('string', escaped);
  }

  function applyRuneLinePatterns(escapedLine, stash) {
    let line = escapedLine;

    line = line.replace(/^(\s*)(import)(\b)/, (_m, indent, keyword, boundary) => {
      return `${indent}${stash(wrap('keyword', keyword))}${boundary}`;
    });

    line = line.replace(/^([ \t]*)(@)([A-Za-z][A-Za-z0-9_-]*)(.*)$/, (_m, indent, at, section, tail) => {
      const [, path, qualifier] = tail.match(/^((?:\/[A-Za-z0-9_-]+)*)(.*)$/);
      const ids = path.replace(/(\/)([^/]+)/g, (_segment, slash, id) =>
        stash(wrap('section-punctuation', slash)) + stash(wrap('section-id', id)));
      const rest = qualifier.replace(/^(\s*)(.+)$/, (_qualifier, gap, value) => gap + stash(wrap('section-qualifier', value)));
      return indent + stash(wrap('section-punctuation', at)) + stash(wrap('section-type', section)) + ids + rest;
    });

    line = line.replace(/^(\s*)(action)(\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*\([^)]*\))?(\s*:?)$/, (_m, indent, keyword, gap, name, params = '', suffix) => {
      return `${indent}${stash(wrap('keyword', keyword))}${gap}${stash(wrap('function', name))}${params ? stash(wrap('parameters', params)) : ''}${suffix}`;
    });

    line = line.replace(/^(\s*)(func)(\s+)([A-Za-z_][A-Za-z0-9_-]*)(\s*\([^)]*\))?(\s*:?)$/, (_m, indent, keyword, gap, name, params = '', suffix) => {
      return `${indent}${stash(wrap('keyword', keyword))}${gap}${stash(wrap('function', name))}${params ? stash(wrap('parameters', params)) : ''}${suffix}`;
    });

    line = line.replace(/^(\s*)(run|state|view|derive|tokens|presets|rules|responsive|fields|props|bindings)(\s*:)/, (_m, indent, keyword, colon) => {
      return `${indent}${stash(wrap('block-keyword', keyword))}${stash(wrap('punctuation', colon))}`;
    });

    line = line.replace(/^(\s*)(\+)(\s+)/, (_m, indent, marker, gap) => {
      return `${indent}${stash(wrap('record-marker', marker))}${gap}`;
    });

    line = line.replace(/^(\s*)([A-Za-z_][A-Za-z0-9_.:\[\]-]*)(\s*)(=)(?!=)/, (_m, indent, property, gap, operator) => {
      return `${indent}${stash(wrap('property', property))}${gap}${stash(wrap('operator', operator))}`;
    });

    line = line.replace(/^(\s*)(div|main|section|article|header|footer|nav|aside|h[1-6]|p|span|a|ul|ol|li|pre|code|button|input|textarea|select|option|iframe|details|summary|label|form|img|script)(?=[\s.#:]|$)/,
      (_m, indent, tag) => `${indent}${stash(wrap('tag', tag))}`);
    line = line.replace(/^(\s*)([A-Z][A-Za-z0-9]*)(?=\s|$)/,
      (_m, indent, name) => `${indent}${stash(wrap('function', name))}`);

    return line;
  }

  function applyRuneGenericPatterns(escapedLine, stash) {
    let line = escapedLine;

    line = highlightInterpolation(line, stash);

    line = line.replace(/%[A-Z_]+%/g, (match) => stash(wrap('placeholder', match)));
    line = line.replace(/\b(respond|log|validate|parse-json|csv\.(read|write|append)|json\.(read|write)|memory\.(get|set|append|clear|del)|ws\.(id|send|broadcast)|uuid(?:\.v4)?|load-rune|set-memory|get-memory|clear-memory|del-memory|is-set|to-number|to-string|to-bool|now|summarize|increment|decrement|append|delete|clone|sum|avg|min|max|count|flatten|unique|randomize)\b/g, (match) => stash(wrap('builtin', match)));
    line = line.replace(/#[\da-fA-F]{3,8}\b/g, (match) => stash(wrap('number', match)));
    line = line.replace(/#[A-Za-z_][\w-]*/g, (match) => stash(wrap('type', match)));
    line = line.replace(/\.[A-Za-z_][\w-]*/g, (match) => stash(wrap('selector', match)));
    line = line.replace(/\b(if|else|then|for|each|in|return|stop|when|from|by|use|swap|full|or|and|not|match)\b/g, (match) => stash(wrap('keyword', match)));
    line = line.replace(/\b(string|number|boolean|bool|integer|String|Number|Boolean|Integer|Object|Array)\b/g, (match) => stash(wrap('type', match)));
    line = line.replace(/\b([A-Za-z_][\w-]*)(?=\s*=)/g, (match) => stash(wrap('attribute', match)));
    line = line.replace(/\b([A-Za-z_][\w-]*)(?=\s*:)/g, (match) => stash(wrap('property', match)));
    line = line.replace(/\b(true|false|null|draw)\b/g, (match) => stash(wrap('constant', match)));
    line = line.replace(/\b-?(0|[1-9][0-9]*)(\.[0-9]+)?\b/g, (match) => stash(wrap('number', match)));
    line = line.replace(/(==|!=|&lt;=|&gt;=|&lt;-|=&gt;|\+\+|--|\?\?|&amp;|&lt;|&gt;|[=+*/|!-])/g, (match) => stash(wrap('operator', match)));
    line = line.replace(/[{}()[\],:]/g, (match) => stash(wrap('punctuation', match)));

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
      const { stash, restore } = createStash(rawLine);

      let line = codePart.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => stash(highlightRuneString(match, stash)));
      line = escapeHtml(line);
      line = applyRuneLinePatterns(line, stash);
      line = applyRuneGenericPatterns(line, stash);
      line = restore(line);

      const highlightedComment = commentPart ? wrap('comment', escapeHtml(commentPart)) : '';
      return line + highlightedComment;
    }).join('\n');
  }

  function highlightShellString(raw, stash) {
    const escaped = raw.replace(/\\./g, (match) => stash(wrap('escape', escapeHtml(match))));
    return wrap('string', escapeHtml(escaped));
  }

  function highlightShell(source) {
    return source.split('\n').map((rawLine) => {
      const trimmed = rawLine.trimStart();
      if (trimmed.startsWith('#')) {
        return wrap('comment', escapeHtml(rawLine));
      }

      const { stash, restore } = createStash(rawLine);
      let line = rawLine.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match) => stash(highlightShellString(match, stash)));
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

  function highlightData(source, language) {
    const { stash, restore } = createStash(source);
    if (language === 'xml') {
      return escapeHtml(source).replace(/(&lt;[/?]?)([\w:-]+)(.*?)([/?]?&gt;)/g, (_match, open, tag, attributes, close) => {
        const middle = attributes.replace(/([\w:-]+)(=)(&quot;.*?&quot;|&#39;.*?&#39;)/g,
          (_m, name, equals, value) => wrap('attribute', name) + wrap('operator', equals) + wrap('string', value));
        return wrap('punctuation', open) + wrap('tag', tag) + middle + wrap('punctuation', close);
      });
    }
    let text = source.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (match, offset) => {
      const property = /^\s*:/.test(source.slice(offset + match.length));
      return stash(wrap(property ? 'property' : 'string', escapeHtml(match)));
    });
    text = escapeHtml(text);
    if (language === 'yaml' || language === 'yml') {
      text = text.replace(/(^|\s)#.*$/gm, (match) => stash(wrap('comment', match)));
      text = text.replace(/^(\s*(?:-\s*)?)([\w.-]+)(\s*:)/gm,
        (_m, indent, key, colon) => indent + stash(wrap('property', key)) + colon);
    }
    text = text.replace(/\b(true|false|null)\b/g, (match) => stash(wrap('constant', match)));
    text = text.replace(/-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/gi, (match) => stash(wrap('number', match)));
    text = text.replace(/[{}[\],:]/g, (match) => stash(wrap('punctuation', match)));
    return restore(text);
  }

  function highlightGraphql(source) {
    const { stash, restore } = createStash(source);
    let text = source.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*/g,
      match => stash(wrap(match.startsWith('#') ? 'comment' : 'string', escapeHtml(match))));
    text = escapeHtml(text);
    text = text.replace(/\b(query|mutation|subscription|fragment|on|type|input|enum|scalar|interface|union|implements|schema|directive|extend|repeatable)\b/g,
      match => stash(wrap('keyword', match)));
    text = text.replace(/\$[_A-Za-z]\w*/g, match => stash(wrap('interpolation', match)));
    text = text.replace(/@[_A-Za-z]\w*/g, match => stash(wrap('builtin', match)));
    text = text.replace(/\b[A-Z][_A-Za-z0-9]*\b/g, match => stash(wrap('type', match)));
    text = text.replace(/\b(true|false|null)\b/g, match => stash(wrap('constant', match)));
    text = text.replace(/-?\b\d+(?:\.\d+)?\b/g, match => stash(wrap('number', match)));
    text = text.replace(/[{}()[\],:!]|\.{3}/g, match => stash(wrap('punctuation', match)));
    return restore(text);
  }

  function highlight(source, language) {
    if (language === 'rune' || language === 'vectrune') return highlightRune(source);
    if (['powershell', 'bash', 'shell'].includes(language)) return highlightShell(source);
    if (['json', 'yaml', 'yml', 'xml'].includes(language)) return highlightData(source, language);
    if (language === 'graphql' || language === 'gql') return highlightGraphql(source);
    return escapeHtml(source);
  }

  const highlighted = new WeakMap();

  function highlightElement(element) {
    if (element.closest('.editor-highlight')) return;
    const language = languageFromClassName(element.className);
    const source = element.textContent.replace(/\r\n?/g, '\n');
    const key = `${language}\n${source}`;
    const previous = highlighted.get(element);
    if (previous?.key === key && previous.html === element.innerHTML) return;
    element.innerHTML = highlight(source, language);
    highlighted.set(element, { key, html: element.innerHTML });
  }

  function syncEditor(editor) {
    const wrapper = editor.closest('.code-editor');
    const backdrop = wrapper?.querySelector('.editor-highlight');
    const code = backdrop?.querySelector('code');
    if (!code) return;
    if (highlighted.get(editor) !== editor.value) {
      highlighted.set(editor, editor.value);
      code.innerHTML = highlight(editor.value, languageFromClassName(code.className) || 'rune') + '\n';
    }
    wrapper.classList.add('highlight-ready');
    backdrop.scrollTop = editor.scrollTop;
    backdrop.scrollLeft = editor.scrollLeft;
  }

  document.addEventListener('input', (event) => {
    if (event.target.matches('.code-editor textarea')) syncEditor(event.target);
  });
  document.addEventListener('scroll', (event) => {
    if (event.target.matches?.('.code-editor textarea')) syncEditor(event.target);
  }, true);

  function start() {
    const selector = 'code[class*="language-"]';
    const pending = new Set();
    let frame = null;
    function queue(root) {
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      if (root.matches(selector)) pending.add(root);
      root.querySelectorAll(selector).forEach((node) => pending.add(node));
      if (root.matches('.code-editor textarea')) pending.add(root);
      root.querySelectorAll('.code-editor textarea').forEach((node) => pending.add(node));
      if (frame !== null || !pending.size) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const nodes = [...pending];
        pending.clear();
        nodes.forEach((node) => {
          if (!node.isConnected) return;
          if (node.matches('textarea')) syncEditor(node);
          else highlightElement(node);
        });
      });
    }
    queue(document.body);
    new MutationObserver((records) => {
      records.forEach((record) => {
        const parent = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        const code = parent.closest?.(selector);
        if (code) queue(code);
        record.addedNodes.forEach(queue);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();



