// wasm-init.js - Loads and initializes the Vectrune WASM module

async function loadWasm() {
    try {
        const { default: init } = await import('./pkg/rune_runtime.js');
        await init();
        window.vectruneWasmLoaded = true;
        console.log('Vectrune WASM initialized');
    } catch (e) {
        console.warn('Vectrune WASM failed to load:', e);
        window.vectruneWasmLoaded = false;
    }
}

loadWasm();

