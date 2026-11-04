// sandbox.js - Bridges the UI with the Vectrune Emulator

let serializeFn = null;

const PAGE_SNIPPETS = {
    rest_get: `@App
name = GET Tutorial
type = REST

@Route/GET /users
run:
    users = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
    log "Returning users..."
    respond 200 users`,

    rest_post: `@App
name = POST Tutorial
type = REST

@Schema/User
name = string
role = string

@Route/POST /users
expect = User
run:
    parse-json
    validate body #User
    log "Creating user: {body.name}"
    created = { id: 42, name: body.name, role: body.role }
    respond 201 created`,

    rest_validation: `@App
name = Validation Tutorial
type = REST

@Schema/Product
title = string
price = number

@Route/POST /products
run:
    parse-json
    validate body #Product
    validate body.price > 0 "Price must be greater than zero"
    log "Product valid: {body.title} at \${body.price}"
    respond 200 "Product validated successfully"`,

    graphql: `@App
name = GraphQL Book API
type = GraphQL

@Type/Book
id = number
title = string
author = string

@Query/books -> [Book]
run:
    books = [
        { id: 1, title: "Designing Data-Intensive Applications", author: "Martin Kleppmann" },
        { id: 2, title: "The Pragmatic Programmer", author: "Andy Hunt & Dave Thomas" }
    ]
    return books`,

    websocket: `@App
name = WebSocket Chat
type = WebSocket

@Route/WS /chat
run:
    on connect:
        log "Client connected to chat stream"
        emit "Welcome to Vectrune real-time!"
    on message:
        log "Received message: {message}"
        broadcast "User: {message}"`,

    rune_web: `@Component/Counter
state:
    count = 0
view:
    div .counter-card:
        h2 "Count: {count}"
        button click="count = count + 1" "Increment"
        button click="count = count - 1" "Decrement"`
};

function detectCurrentPage() {
    const h2 = document.querySelector('.content-area .section-heading h2');
    if (!h2) return 'home';
    const heading = h2.textContent.trim().toLowerCase();
    if (heading.includes('get requests')) return 'rest_get';
    if (heading.includes('post requests')) return 'rest_post';
    if (heading.includes('validation & schemas')) return 'rest_validation';
    if (heading.includes('graphql')) return 'graphql';
    if (heading.includes('web sockets')) return 'websocket';
    if (heading.includes('declarative reactive frontend')) return 'rune_web';
    if (document.getElementById('builtin-list')) return 'builtins';
    return 'home';
}

function updateSandboxSnippet() {
    const page = detectCurrentPage();
    if (page === 'builtins' || page === 'home') return;
    const editor = document.querySelector('#sandbox-editor');
    if (!editor) return;

    if (editor.dataset.currentPage !== page) {
        if (PAGE_SNIPPETS[page]) {
            editor.value = PAGE_SNIPPETS[page];
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.dataset.currentPage = page;
            const output = document.querySelector('#sandbox-output');
            if (output) {
                output.textContent = "Click 'Run' to see output here...";
            }
        }
    }
}

function getEmulatorUrl() {
    const script = document.querySelector('script[src*="sandbox.js"]');
    const base = (script && script.src) ? new URL('rune-emulator.js', script.src).href : '/assets/rune-emulator.js';
    return `${base}?t=${Date.now()}`;
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
    let outText = `Status: ${response.status}\n\n`;
    if (response.logs && response.logs.length > 0) {
        outText += `Logs:\n${response.logs.join('\n')}\n\n`;
    }
    const bodyStr = serializeFn ? serializeFn(response.body, 'json') : JSON.stringify(response.body, null, 2);
    outText += 'Response:\n';
    container.textContent = outText;
    container.appendChild(createCodeResult(bodyStr, 'json'));
}

window.showAst = async (btn) => {
    const container = btn.closest('.sandbox-container');
    if (!container) return;
    
    const editor = container.querySelector('#sandbox-editor');
    const output = container.querySelector('#sandbox-output');
    const astFormat = container.querySelector('#ast-format');
    if (!editor || !output || !astFormat) return;

    const code = editor.value;
    output.innerHTML = "<div>Parsing...</div>";
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
        output.textContent = "Error parsing AST: " + err;
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
    output.innerHTML = "<div>Parsing...</div>";
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
        output.textContent = "Error parsing document: " + err;
    }
};

window.runSandbox = async (btn) => {
    const container = btn.closest('.sandbox-container');
    if (!container) return;
    
    const editor = container.querySelector('#sandbox-editor');
    const output = container.querySelector('#sandbox-output');
    if (!editor || !output) return;

    const code = editor.value;
    output.innerHTML = "<div>Running...</div>";
    
    try {
        const { parse, createApp, serialize, toDocument } = await loadEmulator();
        serializeFn = serialize;
        
        const doc = parse(code);
        const emulatorApp = createApp(doc);
        const mode = btn.closest('[data-sandbox-mode]')?.dataset.sandboxMode;
        if (mode === 'data' || (!doc.app && !doc.routes.length && !/@(?:Component|Page|Frontend)\b/.test(code))) {
            const format = container.querySelector('#ast-format')?.value || 'json';
            output.replaceChildren(createCodeResult(serialize(toDocument(doc), format), format));
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
            routeSelect.setAttribute('aria-label', 'Endpoint');
            routeSelect.style.flex = '1';
            routeSelect.style.padding = '0.5rem';
            routeSelect.style.borderRadius = '4px';
            routeSelect.style.background = '#1e293b';
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
            bodyInput.placeholder = 'Request body (JSON)';
            bodyInput.setAttribute('aria-label', 'Request body');
            bodyInput.style.display = 'none';
            bodyInput.style.width = '100%';
            bodyInput.style.marginTop = '0.75rem';
            bodyInput.style.padding = '0.5rem';
            bodyInput.style.borderRadius = '4px';
            bodyInput.style.fontFamily = 'monospace';
            bodyInput.style.background = '#1e293b';
            bodyInput.style.color = '#fff';
            bodyInput.style.border = '1px solid rgba(148, 163, 184, 0.3)';

            const pathInput = document.createElement('input');
            pathInput.className = 'request-path';
            pathInput.setAttribute('aria-label', 'Request path');

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
            sendBtn.textContent = 'Send Request';
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
                
                resultContainer.innerHTML = '<div style="display:flex;align-items:center;gap:0.5rem;"><div style="width:1rem;height:1rem;border:2px solid rgba(148,163,184,0.3);border-top-color:#38bdf8;border-radius:50%;animation:sandbox-spin 1s linear infinite;"></div><div>Sending request...</div></div>';
                if (!document.getElementById('sandbox-spinner-style')) {
                    const style = document.createElement('style');
                    style.id = 'sandbox-spinner-style';
                    style.textContent = '@keyframes sandbox-spin { to { transform: rotate(360deg); } }';
                    document.head.appendChild(style);
                }

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

            resultContainer.textContent = "Click 'Send Request' to execute the endpoint.";
        }
        // 2. GraphQL Application
        else if (appType === 'GRAPHQL') {
            output.textContent = 'GraphQL resolvers require the local Vectrune runtime. Open the GraphQL example in Example Lab to read the source and see the run command.';
        }
        // 3. WebSocket Application
        else if (appType === 'WEBSOCKET' || code.includes('@Route/WS')) {
            const wsContainer = document.createElement('div');
            wsContainer.className = 'api-explorer';
            wsContainer.style.marginBottom = '1rem';
            wsContainer.style.padding = '1rem';
            wsContainer.style.background = 'rgba(15, 23, 42, 0.4)';
            wsContainer.style.borderRadius = '8px';
            wsContainer.style.border = '1px solid rgba(148, 163, 184, 0.2)';

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '0.5rem';
            title.style.color = '#38bdf8';
            title.textContent = 'WebSocket Real-Time Stream (ws://localhost:3000/chat)';

            const msgRow = document.createElement('div');
            msgRow.style.display = 'flex';
            msgRow.style.gap = '0.5rem';

            const msgInput = document.createElement('input');
            msgInput.type = 'text';
            msgInput.value = 'Hello Vectrune team!';
            msgInput.style.flex = '1';
            msgInput.style.padding = '0.5rem';
            msgInput.style.borderRadius = '4px';
            msgInput.style.background = '#1e293b';
            msgInput.style.color = '#fff';
            msgInput.style.border = '1px solid rgba(148, 163, 184, 0.3)';

            const sendWsBtn = document.createElement('button');
            sendWsBtn.textContent = 'Send Frame';
            sendWsBtn.className = 'cta';
            sendWsBtn.style.padding = '0.5rem 1rem';

            msgRow.appendChild(msgInput);
            msgRow.appendChild(sendWsBtn);

            const resultContainer = document.createElement('div');
            resultContainer.className = 'terminal';
            resultContainer.style.marginTop = '1rem';
            resultContainer.style.minHeight = '150px';

            const wsLogs = [
                "[WS CONNECTED] Established full-duplex session with /chat",
                "[WS INCOMING] Server: \"Welcome to Vectrune real-time!\""
            ];
            resultContainer.textContent = `Status: 101 Switching Protocols\n\nLogs:\n${wsLogs.join('\n')}\n\nStream Active. Type a frame above to broadcast.`;

            sendWsBtn.addEventListener('click', () => {
                const text = msgInput.value.trim() || 'ping';
                wsLogs.push(`[WS CLIENT -> SERVER] "${text}"`);
                wsLogs.push(`[WS SERVER LOG] Received message: ${text}`);
                wsLogs.push(`[WS BROADCAST] "User: ${text}"`);
                resultContainer.textContent = `Status: 101 Switching Protocols\n\nLogs:\n${wsLogs.join('\n')}\n\nStream Active.`;
            });

            wsContainer.appendChild(title);
            wsContainer.appendChild(msgRow);
            output.appendChild(wsContainer);
            output.appendChild(resultContainer);
        }
        // 4. Rune Web Component
        else if (code.includes('@Component')) {
            output.textContent = 'Rune-Web apps need to be compiled before previewing. Open Counter or Tic Tac Toe in Example Lab for a live preview compiled from its actual Rune source.';
        }
        // 5. Default Fallback
        else {
            const response = emulatorApp.request({ method: 'GET', path: '/' });
            const resultContainer = document.createElement('div');
            renderResponse(response, resultContainer);
            output.appendChild(resultContainer);
        }
        
    } catch (err) {
        output.textContent = "Error: " + err;
        console.error("Sandbox runtime error:", err);
    }
};

// Auto-sync snippet on page changes
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSandboxSnippet);
} else {
    updateSandboxSnippet();
}

const pageObserver = new MutationObserver(() => {
    updateSandboxSnippet();
});
pageObserver.observe(document.body, { childList: true, subtree: true });
