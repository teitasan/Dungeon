let currentState = null;
export function isModalOpen() {
    return currentState !== null;
}
export function cancelCurrentModal() {
    if (!currentState)
        return false;
    const { resolve } = currentState;
    cleanup();
    resolve({ type: 'cancel' });
    return true;
}
function cleanup() {
    if (!currentState)
        return;
    window.removeEventListener('keydown', currentState.keyHandler);
    currentState.overlay.remove();
    currentState = null;
}
function renderSelection() {
    if (!currentState)
        return;
    const selectedStyle = '0 0 0 2px #58a6ff inset';
    const items = Array.from(currentState.yesNoContainer.children);
    items.forEach((el, idx) => {
        el.style.boxShadow = idx === currentState.selectedIndex ? selectedStyle : '0 0 0 1px #333 inset';
    });
}
export function openChoiceModal(params) {
    if (currentState) {
        // Only one modal at a time; cancel previous
        cancelCurrentModal();
    }
    const { title, options, defaultIndex = 0 } = params;
    const overlay = document.createElement('div');
    overlay.style.display = 'grid';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.5)';
    overlay.style.placeItems = 'center';
    const panel = document.createElement('div');
    panel.style.background = '#1a1a1a';
    panel.style.color = '#eee';
    panel.style.padding = '16px';
    panel.style.borderRadius = '10px';
    panel.style.minWidth = '320px';
    panel.style.boxShadow = '0 0 0 1px #333 inset';
    const header = document.createElement('div');
    header.textContent = title;
    header.style.fontWeight = '600';
    header.style.marginBottom = '8px';
    const opts = document.createElement('div');
    opts.style.display = 'flex';
    opts.style.gap = '12px';
    options.forEach(opt => {
        const item = document.createElement('div');
        item.textContent = opt.label;
        item.style.padding = '6px 12px';
        item.style.borderRadius = '8px';
        item.style.boxShadow = '0 0 0 1px #333 inset';
        opts.appendChild(item);
    });
    const hint = document.createElement('div');
    hint.textContent = '左右キーで選択 / Z:決定 / X:キャンセル';
    hint.style.opacity = '0.8';
    hint.style.fontSize = '12px';
    hint.style.marginTop = '8px';
    panel.appendChild(header);
    panel.appendChild(opts);
    panel.appendChild(hint);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    const promise = new Promise((resolve) => {
        const keyHandler = (e) => {
            const key = e.key;
            if (!currentState)
                return;
            if (key === 'ArrowLeft' || key === 'ArrowRight') {
                const max = currentState.options.length;
                const delta = key === 'ArrowLeft' ? -1 : 1;
                currentState.selectedIndex = (currentState.selectedIndex + delta + max) % max;
                renderSelection();
                e.preventDefault();
            }
            else if (key.toLowerCase() === 'z') {
                const idx = currentState.selectedIndex;
                const id = currentState.options[idx].id;
                cleanup();
                resolve({ type: 'ok', selectedIndex: idx, selectedId: id });
                e.preventDefault();
            }
            else if (key.toLowerCase() === 'x') {
                cleanup();
                resolve({ type: 'cancel' });
                e.preventDefault();
            }
        };
        currentState = {
            overlay,
            yesNoContainer: opts,
            options,
            selectedIndex: Math.max(0, Math.min(options.length - 1, defaultIndex)),
            keyHandler,
            resolve,
        };
        window.addEventListener('keydown', keyHandler);
        renderSelection();
    });
    return promise;
}
//# sourceMappingURL=Modal.js.map