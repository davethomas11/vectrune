// sandbox.js - Bridges the UI with the Vectrune Wasm module

async function initSandbox() {
    const runButton = document.getElementById('run-button');
    const editor = document.getElementById('sandbox-editor');
    const output = document.getElementById('sandbox-output');

    if (!runButton || !editor || !output) return;

    runButton.addEventListener('click', async () => {
        const code = editor.value;
        output.textContent = "Running...\n";
        
        try {
            // Check if WASM was successfully loaded via the module script in page.rune
            if (window.vectruneWasmLoaded) {
                // wasm_bindgen is the default global when using 'wasm-pack build --target web'
                // without a bundler, if it's been initialized.
                const result = await wasm_bindgen.run_rune_wasm(code, "");
                output.textContent = result;
            } else {
                // Fallback / Error message
                const errorMsg = output.getAttribute('data-error-wasm-missing') || "WASM module not loaded.";
                output.textContent = errorMsg;
                console.error("Sandbox execution failed: Vectrune WASM module not initialized.");
            }
        } catch (err) {
            output.textContent = "Error: " + err;
            console.error("Sandbox runtime error:", err);
        }
    });
}

document.addEventListener('DOMContentLoaded', initSandbox);
