// sandbox.js - Bridges the UI with the Vectrune Emulator

let emulatorApp = null;
let serializeFn = null;

function renderResponse(response, container) {
    let outText = `Status: ${response.status}\n\n`;
    if (response.logs && response.logs.length > 0) {
        outText += `Logs:\n${response.logs.join('\n')}\n\n`;
    }
    outText += `Response:\n${serializeFn(response.body, 'json')}`;
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
        const { parse, serialize } = await import('./rune-emulator.js');
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
        const { parse, serialize, toDocument } = await import('./rune-emulator.js');
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
        const { parse, createApp, serialize } = await import('./rune-emulator.js');
        serializeFn = serialize;
        
        const doc = parse(code);
        emulatorApp = createApp(doc);
        
        output.innerHTML = '';

        const isRest = doc.app && doc.app.type && doc.app.type.toUpperCase() === 'REST';
        
        if (isRest && doc.routes && doc.routes.length > 0) {
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

            routeSelect.addEventListener('change', () => {
                const route = doc.routes[routeSelect.value];
                if (route.method.toUpperCase() === 'POST' || route.method.toUpperCase() === 'PUT') {
                    bodyInput.style.display = 'block';
                } else {
                    bodyInput.style.display = 'none';
                }
            });
            routeSelect.dispatchEvent(new Event('change'));

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
                }, 400);
            });

            uiContainer.appendChild(topRow);
            uiContainer.appendChild(bodyInput);
            
            output.appendChild(uiContainer);
            output.appendChild(resultContainer);

            resultContainer.textContent = "Click 'Send Request' to execute the endpoint.";
        } else {
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
