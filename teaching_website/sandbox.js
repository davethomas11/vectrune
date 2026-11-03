// sandbox.js - Bridges the UI with the Vectrune Emulator

let emulatorApp = null;
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

function renderResponse(response, container) {
    let outText = `Status: ${response.status}\n\n`;
    if (response.logs && response.logs.length > 0) {
        outText += `Logs:\n${response.logs.join('\n')}\n\n`;
    }
    const bodyStr = serializeFn ? serializeFn(response.body, 'json') : JSON.stringify(response.body, null, 2);
    outText += `Response:\n${bodyStr}`;
    container.textContent = outText;
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
        resultContainer.textContent = serialized;
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
        resultContainer.textContent = serialized;
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
        const { parse, createApp, serialize } = await loadEmulator();
        serializeFn = serialize;
        
        const doc = parse(code);
        emulatorApp = createApp(doc);
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
            topRow.style.display = 'flex';
            topRow.style.gap = '0.5rem';
            topRow.style.alignItems = 'center';

            const routeSelect = document.createElement('select');
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
            bodyInput.style.display = 'none';
            bodyInput.style.width = '100%';
            bodyInput.style.marginTop = '0.75rem';
            bodyInput.style.padding = '0.5rem';
            bodyInput.style.borderRadius = '4px';
            bodyInput.style.fontFamily = 'monospace';
            bodyInput.style.background = '#1e293b';
            bodyInput.style.color = '#fff';
            bodyInput.style.border = '1px solid rgba(148, 163, 184, 0.3)';

            const syncBodyDefault = () => {
                const route = doc.routes[routeSelect.value];
                if (route && (route.method.toUpperCase() === 'POST' || route.method.toUpperCase() === 'PUT')) {
                    bodyInput.style.display = 'block';
                    if (!bodyInput.value.trim()) {
                        if (route.path.includes('product')) {
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
                let path = route.path.replace(/\{[^}]+\}/g, '1');

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
            uiContainer.appendChild(bodyInput);
            
            output.appendChild(uiContainer);
            output.appendChild(resultContainer);

            resultContainer.textContent = "Click 'Send Request' to execute the endpoint.";
        }
        // 2. GraphQL Application
        else if (appType === 'GRAPHQL') {
            const gqlContainer = document.createElement('div');
            gqlContainer.className = 'api-explorer';
            gqlContainer.style.marginBottom = '1rem';
            gqlContainer.style.padding = '1rem';
            gqlContainer.style.background = 'rgba(15, 23, 42, 0.4)';
            gqlContainer.style.borderRadius = '8px';
            gqlContainer.style.border = '1px solid rgba(148, 163, 184, 0.2)';

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '0.5rem';
            title.style.color = '#38bdf8';
            title.textContent = 'GraphQL Query Console';

            const queryInput = document.createElement('textarea');
            queryInput.style.width = '100%';
            queryInput.style.minHeight = '90px';
            queryInput.style.padding = '0.5rem';
            queryInput.style.borderRadius = '4px';
            queryInput.style.fontFamily = 'monospace';
            queryInput.style.background = '#1e293b';
            queryInput.style.color = '#fff';
            queryInput.style.border = '1px solid rgba(148, 163, 184, 0.3)';
            queryInput.value = 'query {\n  books {\n    id\n    title\n    author\n  }\n}';

            const runGqlBtn = document.createElement('button');
            runGqlBtn.textContent = 'Execute GraphQL Query';
            runGqlBtn.className = 'cta';
            runGqlBtn.style.marginTop = '0.5rem';
            runGqlBtn.style.padding = '0.5rem 1rem';

            const resultContainer = document.createElement('div');
            resultContainer.className = 'terminal';
            resultContainer.style.marginTop = '1rem';
            resultContainer.style.minHeight = '150px';

            runGqlBtn.addEventListener('click', () => {
                const sampleBooks = [
                    { id: 1, title: "Designing Data-Intensive Applications", author: "Martin Kleppmann" },
                    { id: 2, title: "The Pragmatic Programmer", author: "Andy Hunt & Dave Thomas" }
                ];
                const res = {
                    status: 200,
                    logs: [
                        "GraphQL Engine: parsing query...",
                        "Resolver matched @Query/books -> [Book]",
                        `Returned ${sampleBooks.length} records adhering to @Type/Book`
                    ],
                    body: {
                        data: {
                            books: sampleBooks
                        }
                    }
                };
                renderResponse(res, resultContainer);
            });

            gqlContainer.appendChild(title);
            gqlContainer.appendChild(queryInput);
            gqlContainer.appendChild(runGqlBtn);
            output.appendChild(gqlContainer);
            output.appendChild(resultContainer);

            resultContainer.textContent = "Click 'Execute GraphQL Query' to run.";
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
            const compContainer = document.createElement('div');
            compContainer.className = 'api-explorer';
            compContainer.style.marginBottom = '1rem';
            compContainer.style.padding = '1rem';
            compContainer.style.background = 'rgba(15, 23, 42, 0.4)';
            compContainer.style.borderRadius = '8px';
            compContainer.style.border = '1px solid rgba(148, 163, 184, 0.2)';

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '0.75rem';
            title.style.color = '#38bdf8';
            title.textContent = 'Live Component Preview (@Component/Counter)';

            let count = 0;
            const counterDisplay = document.createElement('div');
            counterDisplay.style.fontSize = '1.4rem';
            counterDisplay.style.marginBottom = '0.75rem';
            counterDisplay.style.fontWeight = 'bold';
            counterDisplay.textContent = `Count: ${count}`;

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.gap = '0.5rem';

            const incBtn = document.createElement('button');
            incBtn.textContent = '+ Increment';
            incBtn.className = 'cta';
            incBtn.style.padding = '0.4rem 0.8rem';

            const decBtn = document.createElement('button');
            decBtn.textContent = '- Decrement';
            decBtn.className = 'secondary-cta';
            decBtn.style.padding = '0.4rem 0.8rem';

            incBtn.addEventListener('click', () => {
                count++;
                counterDisplay.textContent = `Count: ${count}`;
                updateTerminal();
            });

            decBtn.addEventListener('click', () => {
                count--;
                counterDisplay.textContent = `Count: ${count}`;
                updateTerminal();
            });

            btnRow.appendChild(incBtn);
            btnRow.appendChild(decBtn);

            const resultContainer = document.createElement('div');
            resultContainer.className = 'terminal';
            resultContainer.style.marginTop = '1rem';
            resultContainer.style.minHeight = '120px';

            const updateTerminal = () => {
                resultContainer.textContent = `Status: 200 OK (Rune-Web Virtual DOM Rendered)\n\nReactive State:\n{\n  "count": ${count}\n}\n\nLive DOM Node:\n<div class="counter-card">\n  <h2>Count: ${count}</h2>\n  <button click="count = count + 1">Increment</button>\n  <button click="count = count - 1">Decrement</button>\n</div>`;
            };
            updateTerminal();

            compContainer.appendChild(title);
            compContainer.appendChild(counterDisplay);
            compContainer.appendChild(btnRow);
            output.appendChild(compContainer);
            output.appendChild(resultContainer);
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
