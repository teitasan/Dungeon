import { FontManager, FONTS } from '../../core/FontManager.js';

type Choice = { id: string; label: string };

type ChoiceResult =
  | { type: 'ok'; selectedIndex: number; selectedId: string }
  | { type: 'cancel' };

let currentState: {
  overlay: HTMLElement;
  yesNoContainer: HTMLElement;
  options: Choice[];
  selectedIndex: number;
  keyHandler: (e: KeyboardEvent) => void;
  resolve: (r: ChoiceResult) => void;
} | null = null;

export function isModalOpen(): boolean {
  return currentState !== null;
}

export function cancelCurrentModal(): boolean {
  if (!currentState) return false;
  const { resolve } = currentState;
  cleanup();
  resolve({ type: 'cancel' });
  return true;
}

function cleanup(): void {
  if (!currentState) return;
  window.removeEventListener('keydown', currentState.keyHandler);
  currentState.overlay.remove();
  // 通知: モーダルが閉じられた（OK/キャンセル問わず）
  try {
    window.dispatchEvent(new CustomEvent('ui-modal-closed'));
  } catch {}
  currentState = null;
}

function renderSelection(): void {
  if (!currentState) return;
  const items = Array.from(currentState.yesNoContainer.children) as HTMLElement[];
  items.forEach((el, idx) => {
    const isSel = idx === currentState!.selectedIndex;
    // 先頭にカーソル用の▶を表示（フォントにあればそのまま表示）
    const label = currentState!.options[idx].label;
    el.textContent = `${isSel ? '▶ ' : '  '}${label}`;
  });
}

export function openChoiceModal(params: {
  title: string;
  options: Choice[];
  defaultIndex?: number;
}): Promise<ChoiceResult> {
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
  panel.style.background = '#303030'; /* ステータスウインドウに合わせた背景色 */
  panel.style.color = '#eee';
  panel.style.padding = '16px';
  panel.style.borderRadius = '10px';
  panel.style.minWidth = '320px';
  panel.style.textShadow = '-0.5px -0.5px 0 #8c7251, 0.5px -0.5px 0 #8c7251, -0.5px 0.5px 0 #8c7251, 0.5px 0.5px 0 #8c7251';
  // 枠線は付けない

  const header = document.createElement('div');
  header.textContent = title;
  header.style.fontFamily = FontManager.createDefault().getCSSFontFamily();
  header.style.fontWeight = '600';
  header.style.marginBottom = '8px';
  header.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

  const opts = document.createElement('div');
  // 縦並びの選択肢
  opts.style.display = 'flex';
  opts.style.flexDirection = 'column';
  opts.style.gap = '10px';

  options.forEach(opt => {
    const item = document.createElement('div');
    item.textContent = opt.label;
    item.style.fontFamily = FontManager.createDefault().getCSSFontFamily();
    item.style.padding = '8px 12px';
    item.style.borderRadius = '8px';
    item.style.width = '100%';
    item.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    opts.appendChild(item);
  });

  const hint = document.createElement('div');
  hint.textContent = '上下キーで選択 / Z:決定 / X:キャンセル';
  hint.style.fontFamily = FontManager.createDefault().getCSSFontFamily();
  hint.style.opacity = '0.8';
  hint.style.fontSize = '12px';
  hint.style.marginTop = '8px';
  hint.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';

  panel.appendChild(header);
  panel.appendChild(opts);
  panel.appendChild(hint);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const promise = new Promise<ChoiceResult>((resolve) => {
    const keyHandler = (e: KeyboardEvent) => {
      const key = e.key;
      if (!currentState) return;
      // 選択移動は上下キーのみに限定（左右キーでは動かさない）
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const max = currentState.options.length;
        let delta = 0;
        if (key === 'ArrowUp') delta = -1;
        if (key === 'ArrowDown') delta = 1;
        currentState.selectedIndex = (currentState.selectedIndex + delta + max) % max;
        renderSelection();
        e.preventDefault();
      } else if (key.toLowerCase() === 'z') {
        const idx = currentState.selectedIndex;
        const id = currentState.options[idx].id;
        cleanup();
        resolve({ type: 'ok', selectedIndex: idx, selectedId: id });
        e.preventDefault();
      } else if (key.toLowerCase() === 'x') {
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
    // 通知: モーダルが開かれた
    try {
      window.dispatchEvent(new CustomEvent('ui-modal-opened'));
    } catch {}
  });

  return promise;
}
