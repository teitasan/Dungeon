import { DungeonManager } from '../dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from '../systems/MultipleDungeonSystem.js';
import { PlayerEntity } from '../entities/Player.js';
import { UISystem } from '../systems/UISystem.js';
import type { Position } from '../types/core.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { openChoiceModal, isModalOpen, cancelCurrentModal } from './ui/Modal.js';
import { TilesetManager } from './TilesetManager.js';

function $(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el as HTMLElement;
}

function createUI(): void {
  const app = $('#app');
  app.innerHTML = `
    <div id="layout" style="grid-template-columns: 1fr; grid-template-rows: auto auto; max-width: 1180px; width: 100%; margin: 0 auto;">
      <canvas id="game" class="map" style="width:100%; image-rendering: pixelated;"></canvas>
      <div id="bottom" style="display:grid; grid-template-columns: auto 1fr; gap:8px; align-items:start;">
        <canvas id="minimap" style="background:#000; border-radius:6px; box-shadow:0 0 0 1px #333 inset; width: 240px; height: 160px;"></canvas>
        <div id="messages" class="messages" style="height:160px; overflow:auto;"></div>
      </div>
    </div>
    <div id="inventoryModal" style="display:none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); place-items: center;">
      <div style="background:#1a1a1a; color:#eee; padding:16px; border-radius:10px; min-width:280px; box-shadow: 0 0 0 1px #333 inset;">
        <div style="font-weight:600; margin-bottom:8px;">Inventory</div>
        <ul id="inventoryList" style="list-style:none; padding-left:0; margin:0 0 8px 0; max-height:40vh; overflow:auto;"></ul>
        <div style="opacity:0.8; font-size:12px;">Z:決定 / X:閉じる</div>
      </div>
    </div>
    <!-- confirm modal is created dynamically via Modal.ts -->
  `;
}

function bindKeys(handler: (e: KeyboardEvent) => void): void {
  window.addEventListener('keydown', (e) => {
    // prevent page scroll on arrow keys/space
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (navKeys.includes(e.key) || e.key === ' ' || e.key === '.') {
      e.preventDefault();
    }
    handler(e);
  });
}

async function start(): Promise<void> {
  createUI();

  const dungeonManager = new DungeonManager();
  const multi = new MultipleDungeonSystem(dungeonManager);
  const ui = new UISystem(dungeonManager);
  const combat = new CombatSystem();

  const player = new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });

  const select = multi.selectDungeon('beginner-cave', player);
  if (!select.success) {
    $('#messages').textContent = `Failed to enter dungeon: ${select.message}`;
    return;
  }

  const dungeon = dungeonManager.getCurrentDungeon();
  if (!dungeon) {
    $('#messages').textContent = 'No dungeon generated';
    return;
  }

  const spawn: Position = dungeon.playerSpawn;
  player.setPosition(spawn);
  dungeonManager.addEntity(player, spawn);

  const canvas = $('#game') as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas, 32);
  
  // タイルセットマネージャーの初期化
  let tilesetManager: TilesetManager | null = null;
  try {
    // Web環境用の設定読み込み
    console.log('Loading tileset configuration...');
    const response = await fetch('/config/game.json');
    console.log('Config response status:', response.status);
    if (response.ok) {
      const config = await response.json();
      console.log('Config loaded:', config);
      if (config.dungeon?.defaultTileset) {
        console.log('Dungeon tileset config found');
        
        // 現在のダンジョンIDを取得
        const currentDungeon = dungeonManager.getCurrentDungeon();
        const dungeonId = currentDungeon?.id || 'beginner-cave';
        
        // ダンジョン別の設定を取得
        const tilesetConfig = TilesetManager.getDungeonTilesetConfig(
          config.dungeon,
          dungeonId
        );
        
        console.log(`Using tileset for dungeon: ${dungeonId}`);
        tilesetManager = new TilesetManager(tilesetConfig, dungeonId);
        
        // 画像の読み込み完了を待ってからレンダラーに設定
        try {
          await tilesetManager.load();
          console.log('Tileset loaded successfully');
          renderer.setTilesetManager(tilesetManager);
        } catch (error) {
          console.warn('Failed to load tileset:', error);
          // エラーが発生してもレンダラーに設定（フォールバック表示）
          renderer.setTilesetManager(tilesetManager);
        }
      } else {
        console.log('No dungeon tileset config found');
      }
    } else {
      console.warn('Failed to load config file:', response.status, response.statusText);
    }
  } catch (error) {
    console.warn('Failed to load config for tileset:', error);
  }
  
  // プレイヤー中心のビューポート（固定タイル数）
  const VIEW_TILES_X = 20;
  const VIEW_TILES_Y = 10;
  renderer.setViewportTiles(VIEW_TILES_X, VIEW_TILES_Y);
  // タイルサイズを32に固定
  renderer.setTileSize(32);
  // ミニマップ接続
  const minimap = document.getElementById('minimap') as HTMLCanvasElement;
  if (minimap) {
    // 固定サイズ（CSSのwidth/heightとは別に、実ピクセルも設定）
    minimap.width = 240;
    minimap.height = 160;
    renderer.attachMinimap(minimap);
  }

  let inventoryOpen = false;

  const renderInventory = () => {
    const list = document.getElementById('inventoryList') as HTMLUListElement;
    if (!list) return;
    list.innerHTML = '';
    if (player.inventory.length === 0) {
      const li = document.createElement('li');
      li.textContent = '（空）';
      li.style.opacity = '0.7';
      list.appendChild(li);
    } else {
      player.inventory.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item.name || item.id;
        li.style.padding = '4px 0';
        list.appendChild(li);
      });
    }
  };

  const setInventoryOpen = (open: boolean) => {
    inventoryOpen = open;
    const modal = document.getElementById('inventoryModal') as HTMLElement;
    if (modal) modal.style.display = open ? 'grid' : 'none';
    if (open) renderInventory();
  };

  // Confirm modal is handled by openChoiceModal()

  const render = () => {
    const current = dungeonManager.getCurrentDungeon();
    if (!current) return;
    renderer.render(current, dungeonManager, player);
    $('#messages').textContent = ui.getMessages(8).join('\n');
  };

  const onAdvanceFloor = () => {
    const adv = multi.advanceFloor(player);
    if (!adv.success) return;
    const newDungeon = dungeonManager.getCurrentDungeon();
    if (newDungeon) {
      const newSpawn = newDungeon.playerSpawn;
      player.setPosition(newSpawn);
      dungeonManager.addEntity(player, newSpawn);
    }
  };

  bindKeys((e) => {
    const current = player.position;
    let next: Position | null = null;

    const key = e.key;

    // Global cancel handling for future modal operations
    if (key.toLowerCase() === 'x') {
      if (isModalOpen()) {
        cancelCurrentModal();
        ui.pushMessage('キャンセル');
        render();
        return;
      }
      if (inventoryOpen) {
        setInventoryOpen(false);
        ui.pushMessage('キャンセル');
        render();
        return;
      }
      // No modal open: treat as noop cancel
      return;
    }

    // While a modal is open, delegate all keys to the modal only
    if (isModalOpen()) {
      return;
    }

    if (!inventoryOpen && !isModalOpen()) {
      if (key === 'ArrowUp') next = { x: current.x, y: current.y - 1 };
      else if (key === 'ArrowDown') next = { x: current.x, y: current.y + 1 };
      else if (key === 'ArrowRight') next = { x: current.x + 1, y: current.y };
      else if (key === 'ArrowLeft') next = { x: current.x - 1, y: current.y };
    }

    if (key.toLowerCase() === 'a') {
      // Inventory toggle
      setInventoryOpen(!inventoryOpen);
      ui.pushMessage(inventoryOpen ? 'インベントリを開いた' : 'インベントリを閉じた');
    } else if (key.toLowerCase() === 'x') {
      if (inventoryOpen) {
        setInventoryOpen(false);
        ui.pushMessage('キャンセル');
      }
    } else if (key.toLowerCase() === 'z') {
      if (inventoryOpen) {
        ui.pushMessage('決定: アイテム使用は未実装');
        setInventoryOpen(false);
      } else {
        // If on stairs, open confirm modal; otherwise attack
        const cell = dungeonManager.getCellAt(player.position);
        if (cell && (cell.type === 'stairs-down' || cell.type === 'stairs-up')) {
          const dir = dungeonManager.getCurrentProgressionDirection();
          const title = dir === 'down' ? '次の階へ進みますか？' : '前の階へ戻りますか？';
          openChoiceModal({
            title,
            options: [
              { id: 'yes', label: 'はい' },
              { id: 'no', label: 'いいえ' },
            ],
            defaultIndex: 0,
          }).then((res) => {
            if (res.type === 'ok' && res.selectedId === 'yes') {
              onAdvanceFloor();
              ui.pushMessage(dir === 'down' ? '次の階へ進んだ' : '前の階へ戻った');
            } else {
              ui.pushMessage('いいえを選んだ');
            }
            render();
          });
        } else {
          // Attack: try adjacent target
          const adj = dungeonManager.getAdjacentPositions(player.position, false);
          let attacked = false;
          for (const pos of adj) {
            const targets = dungeonManager.getEntitiesAt(pos).filter(e => e.id !== player.id);
            if (targets.length > 0) {
              const target = targets[0];
              const result = combat.executeAttack({
                attacker: player as any,
                defender: target as any,
                attackType: 'melee'
              } as any);
              ui.pushMessage(result.message);
              // Remove dead target from map
              if ((target.stats as any).hp <= 0) {
                dungeonManager.removeEntity(target);
              }
              attacked = true;
              break;
            }
          }
          if (!attacked) {
            ui.pushMessage('空振りした');
          }
        }
      }
    }

    if (next && !inventoryOpen) {
      dungeonManager.moveEntity(player, next);
      
      // 階段タイルに移動した場合、自動的にモーダルを開く
      const newCell = dungeonManager.getCellAt(next);
      if (newCell && (newCell.type === 'stairs-down' || newCell.type === 'stairs-up')) {
        const dir = dungeonManager.getCurrentProgressionDirection();
        const title = dir === 'down' ? '次の階へ進みますか？' : '前の階へ戻りますか？';
        openChoiceModal({
          title,
          options: [
            { id: 'yes', label: 'はい' },
            { id: 'no', label: 'いいえ' },
          ],
          defaultIndex: 0,
        }).then((res) => {
          if (res.type === 'ok' && res.selectedId === 'yes') {
            onAdvanceFloor();
            ui.pushMessage(dir === 'down' ? '次の階へ進んだ' : '前の階へ戻った');
          } else {
            ui.pushMessage('いいえを選んだ');
          }
          render();
        });
      }
    }

    render();
  });

  ui.pushMessage(`Entered ${select.dungeon!.name}`);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => start());
} else {
  start();
}


