globalThis.__RuneTVInput = (() => {
    const navigation = __RunePixel3DRuntime.createTvNavigation(__RunePixel3D);
    const timeout = __RunePixel3D.config.tv?.hide_after;
    let until = 0;
    const visible = () => timeout === undefined || Date.now() < until;
    return {
        interactive: true,
        visible,
        input(command) {
            if (timeout !== undefined) {
                const wasVisible = visible();
                until = Date.now() + timeout * 1000;
                if (!wasVisible) return true;
            }
            return navigation.input(command);
        },
        volume: () => navigation.volume(),
        overlay: (...args) => navigation.overlay(...args),
    };
})();
