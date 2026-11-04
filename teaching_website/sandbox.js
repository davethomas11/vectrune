// sandbox.js - Bridges the UI with the Vectrune Emulator

let serializeFn = null;
const graphqlRuntimes = new WeakMap();
const sandboxSources = new WeakMap();

function updateSandboxEditStatus(editor) {
    if (!sandboxSources.has(editor)) sandboxSources.set(editor, editor.defaultValue);
    const container = editor.closest('.sandbox-container');
    const status = container?.querySelector('.sandbox-edit-status');
    const button = container?.querySelector('#run-button');
    if (!status || !button) return;
    const pending = editor.value !== sandboxSources.get(editor);
    status.hidden = !pending;
    const label = pending ? button.dataset.changesLabel : button.dataset.runLabel;
    if (button.textContent !== label) button.textContent = label;
    editor.closest('.code-editor').dataset.pendingChanges = String(pending);
    editor.title = pending ? status.textContent : '';
    if (pending) editor.setAttribute('aria-describedby', status.id);
    else editor.removeAttribute('aria-describedby');
}

function markSandboxApplied(editor, source) {
    sandboxSources.set(editor, source);
    updateSandboxEditStatus(editor);
}

document.addEventListener('input', (event) => {
    if (event.target.matches('#sandbox-editor')) updateSandboxEditStatus(event.target);
});

// UI copy comes from the same Rune @I18N bundle as the page.
window.siteText = (path) => path.split('.').reduce((value, key) => value?.[key], window.runeWebApp?.state?.i18n) ?? path;
const t = (key) => window.siteText('Sandbox.' + key);

function getEmulatorUrl() {
    const script = document.querySelector('script[src*="sandbox.js"]');
    const url = new URL('rune-emulator.js', script?.src || new URL('/assets/sandbox.js?v=10', location.href));
    url.search = script ? new URL(script.src).search : '?v=10';
    return url.href;
}

async function loadEmulator() {
    return await import(getEmulatorUrl());
}

function createCodeResult(source, format) {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.className = `code-block language-${format}`;
    code.textContent = source;
    pre.appendChild(code);
    return pre;
}

function renderResponse(response, container) {
    let outText = `${t("status")}: ${response.status}\n\n`;
    if (response.logs && response.logs.length > 0) {
        outText += `${t("logs")}:\n${response.logs.join('\n')}\n\n`;
    }
    const bodyStr = serializeFn ? serializeFn(response.body, 'json') : JSON.stringify(response.body, null, 2);
    outText += t('response') + ':\n';
    container.textContent = outText;
    container.appendChild(createCodeResult(bodyStr, 'json'));
}

window.executeGraphql = (button) => {
    const container = button.closest('.sandbox-container');
    const output = container?.querySelector('#sandbox-output');
    const app = graphqlRuntimes.get(container);
    if (!app || !output) return;
    const consoleUI = container.querySelector('.graphql-console');
    try {
        const variables = JSON.parse(consoleUI.querySelector('.graphql-variables').value || '{}');
        if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
            throw new Error(t('variables_error'));
        }
        const response = app.graphql({
            query: consoleUI.querySelector('.graphql-query').value,
            variables,
            operationName: consoleUI.querySelector('.graphql-operation-name').value.trim() || undefined,
        });
        renderResponse(response, output);
    } catch (error) {
        renderResponse({ status: 400, body: { errors: [{ message: error.message }] }, logs: [] }, output);
    }
};

function showGraphqlConsole(container, app, output) {
    const info = app.graphqlInfo();
    const consoleUI = container.querySelector('.graphql-console');
    graphqlRuntimes.set(container, app);
    const select = consoleUI.querySelector('.graphql-preset');
    select.replaceChildren(...info.examples.map((example, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = example.label;
        return option;
    }));
    const loadExample = () => {
        const example = info.examples[Number(select.value)];
        for (const [selector, value] of [['.graphql-query', example.query], ['.graphql-variables', JSON.stringify(example.variables, null, 2)]]) {
            const editor = consoleUI.querySelector(selector);
            editor.value = value;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        consoleUI.querySelector('.graphql-operation-name').value = '';
    };
    select.onchange = loadExample;
    consoleUI.querySelector('.graphql-schema code').textContent = info.schema;
    consoleUI.hidden = false;
    loadExample();
    output.textContent = consoleUI.dataset.ready;
}

window.showAst = async (btn) => {
    const container = btn.closest('.sandbox-container');
    if (!container) return;
    
    const editor = container.querySelector('#sandbox-editor');
    const output = container.querySelector('#sandbox-output');
    const astFormat = container.querySelector('#ast-format');
    if (!editor || !output || !astFormat) return;

    const code = editor.value;
    output.textContent = t('parsing');
    try {
        const { parse, serialize } = await loadEmulator();
        const doc = parse(code);
        const serialized = serialize(doc, astFormat.value);
        const resultContainer = document.createElement('div');
        resultContainer.className = 'terminal';
        resultContainer.appendChild(createCodeResult(serialized, astFormat.value));
        output.innerHTML = '';
        output.appendChild(resultContainer);
    } catch (err) {
        output.textContent = t('ast_error') + ': ' + err;
    }
};

window.showDoc = async (btn) => {
    const container = btn.closest('.sandbox-container');
    if (!container) return;
    
    const editor = container.querySelector('#sandbox-editor');
    const output = container.querySelector('#sandbox-output');
    const astFormat = container.querySelector('#ast-format');
    if (!editor || !output || !astFormat) return;

    const code = editor.value;
    output.textContent = t('parsing');
    try {
        const { parse, serialize, toDocument } = await loadEmulator();
        const doc = parse(code);
        const dataDoc = toDocument(doc);
        const serialized = serialize(dataDoc, astFormat.value);
        const resultContainer = document.createElement('div');
        resultContainer.className = 'terminal';
        resultContainer.appendChild(createCodeResult(serialized, astFormat.value));
        output.innerHTML = '';
        output.appendChild(resultContainer);
    } catch (err) {
        output.textContent = t('document_error') + ': ' + err;
    }
};

window.runSandbox = async (btn) => {
    const container = btn.closest('.sandbox-container');
    if (!container) return;
    
    const editor = container.querySelector('#sandbox-editor');
    const output = container.querySelector('#sandbox-output');
    if (!editor || !output) return;

    const code = editor.value;
    output.textContent = t('running');
    const graphqlConsole = container.querySelector('.graphql-console');
    if (graphqlConsole) graphqlConsole.hidden = true;
    graphqlRuntimes.delete(container);
    
    try {
        const { parse, createApp, serialize, toDocument } = await loadEmulator();
        serializeFn = serialize;
        
        const doc = parse(code);
        const emulatorApp = createApp(doc);
        const mode = btn.closest('[data-sandbox-mode]')?.dataset.sandboxMode;
        if (mode === 'data' || (!doc.app && !doc.routes.length && !doc.graphql.fields.length && !/@(?:Component|Page|Frontend)\b/.test(code))) {
            const format = container.querySelector('#ast-format')?.value || 'json';
            output.replaceChildren(createCodeResult(serialize(toDocument(doc), format), format));
            markSandboxApplied(editor, code);
            return;
        }
        output.innerHTML = '';

        const appType = (doc.app && doc.app.type) ? doc.app.type.toUpperCase() : 'REST';

        // 1. REST with defined routes
        if (appType === 'REST' && doc.routes && doc.routes.length > 0) {
            const uiContainer = document.createElement('div');
            uiContainer.className = 'api-explorer';
            uiContainer.style.marginBottom = '1rem';
            uiContainer.style.padding = '1rem';
            uiContainer.style.background = 'rgba(15, 23, 42, 0.4)';
            uiContainer.style.borderRadius = '8px';
            uiContainer.style.border = '1px solid rgba(148, 163, 184, 0.2)';

            const topRow = document.createElement('div');
            topRow.className = 'api-request-row';
            topRow.style.display = 'flex';
            topRow.style.gap = '0.5rem';
            topRow.style.alignItems = 'center';

            const routeSelect = document.createElement('select');
            routeSelect.setAttribute('aria-label', t('endpoint'));
            routeSelect.style.flex = '1';
            routeSelect.style.padding = '0.5rem';
            routeSelect.style.borderRadius = '4px';
            routeSelect.style.background = 'var(--panel-strong)';
            routeSelect.style.color = '#fff';
            routeSelect.style.border = '1px solid rgba(148, 163, 184, 0.3)';
            routeSelect.style.fontSize = '0.95rem';

            doc.routes.forEach((route, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `${route.method.toUpperCase()} ${route.path}`;
                routeSelect.appendChild(opt);
            });

            const bodyInput = document.createElement('textarea');
            bodyInput.placeholder = t('request_body');
            bodyInput.setAttribute('aria-label', t('request_body'));
            bodyInput.style.display = 'none';
            bodyInput.style.width = '100%';
            bodyInput.style.marginTop = '0.75rem';
            bodyInput.style.padding = '0.5rem';
            bodyInput.style.borderRadius = '4px';
            bodyInput.style.fontFamily = 'monospace';
            bodyInput.style.background = 'var(--panel-strong)';
            bodyInput.style.color = '#fff';
            bodyInput.style.border = '1px solid rgba(148, 163, 184, 0.3)';

            const pathInput = document.createElement('input');
            pathInput.className = 'request-path';
            pathInput.setAttribute('aria-label', t('request_path'));

            const syncBodyDefault = () => {
                const route = doc.routes[routeSelect.value];
                pathInput.value = route.path.replace(/\{[^}]+\}/g, '1');
                if (route && ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase())) {
                    bodyInput.style.display = 'block';
                    if (!bodyInput.value.trim()) {
                        if (route.expect && doc.schemas[route.expect]) {
                            const sample = {};
                            for (const [name, type] of Object.entries(doc.schemas[route.expect].fields)) {
                                sample[name] = /number|integer/i.test(type) ? (name === 'price' ? 89.99 : 1)
                                    : /bool/i.test(type) ? true
                                    : name === 'email' ? 'alice@example.com'
                                    : name === 'name' ? 'Alice'
                                    : name === 'role' ? 'developer' : 'Example';
                            }
                            bodyInput.value = JSON.stringify(sample, null, 2);
                        } else if (route.path.includes('product')) {
                            bodyInput.value = JSON.stringify({ title: "Mechanical Keyboard", price: 89.99 }, null, 2);
                        } else if (route.path.includes('user')) {
                            bodyInput.value = JSON.stringify({ name: "Alice", role: "developer" }, null, 2);
                        } else {
                            bodyInput.value = JSON.stringify({ name: "Demo User" }, null, 2);
                        }
                    }
                } else {
                    bodyInput.style.display = 'none';
                }
            };

            routeSelect.addEventListener('change', syncBodyDefault);
            syncBodyDefault();

            const sendBtn = document.createElement('button');
            sendBtn.textContent = t('send');
            sendBtn.className = 'cta';
            sendBtn.style.padding = '0.5rem 1rem';
            sendBtn.style.whiteSpace = 'nowrap';

            topRow.appendChild(routeSelect);
            topRow.appendChild(sendBtn);

            const resultContainer = document.createElement('div');
            resultContainer.className = 'terminal';
            resultContainer.style.marginTop = '1rem';
            resultContainer.style.minHeight = '150px';

            sendBtn.addEventListener('click', () => {
                const route = doc.routes[routeSelect.value];
                const path = pathInput.value.trim() || route.path;

                const req = {
                    method: route.method.toUpperCase(),
                    path: path,
                    body: bodyInput.style.display !== 'none' ? bodyInput.value : undefined
                };
                
                resultContainer.textContent = t('sending');

                setTimeout(() => {
                    const response = emulatorApp.request(req);
                    renderResponse(response, resultContainer);
                }, 300);
            });

            uiContainer.appendChild(topRow);
            uiContainer.appendChild(pathInput);
            uiContainer.appendChild(bodyInput);
            
            output.appendChild(uiContainer);
            output.appendChild(resultContainer);

            resultContainer.textContent = t('request_ready');
        }
        // 2. GraphQL Application
        else if (appType === 'GRAPHQL' || doc.graphql.fields.length) {
            showGraphqlConsole(container, emulatorApp, output);
        }
        // WebSocket hooks need the native server, rather than a simulated stream.
        else if (/@Websocket\//.test(code)) {
            output.textContent = t('native_only');
        }
        // 4. Rune Web Component
        else if (code.includes('@Component')) {
            output.textContent = t('web_compile');
        }
        // 5. Default Fallback
        else {
            const response = emulatorApp.request({ method: 'GET', path: '/' });
            const resultContainer = document.createElement('div');
            renderResponse(response, resultContainer);
            output.appendChild(resultContainer);
        }
        
        markSandboxApplied(editor, code);
    } catch (err) {
        output.textContent = t('error') + ': ' + err;
        console.error("Sandbox runtime error:", err);
    }
};

const pageObserver = new MutationObserver(() => {
    const editor = document.querySelector('#sandbox-editor');
    if (editor && !sandboxSources.has(editor)) updateSandboxEditStatus(editor);
});
pageObserver.observe(document.body, { childList: true, subtree: true });
