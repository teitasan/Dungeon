import { DungeonManager } from '../dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from '../systems/MultipleDungeonSystem.js';
import { PlayerEntity } from '../entities/Player.js';
import { UISystem } from '../systems/UISystem.js';
import type { Position } from '../types/core.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { openChoiceModal, isModalOpen, cancelCurrentModal } from './ui/Modal.js';
import { TilesetManager } from './TilesetManager.js';
import { WebConfigLoader } from './WebConfigLoader.js';
import { InputSystem } from '../systems/InputSystem.js';
import { UIManager } from './ui/UIManager.js';

function $(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el as HTMLElement;
}

async function createUI(config: any): Promise<UIManager> {
  const app = $('#app');
  const uiManager = new UIManager(config, app);
  uiManager.createLayout();
  return uiManager;
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
  // 設定の読み込み
  const configLoader = new WebConfigLoader();
  const config = await configLoader.loadGameConfig();
  
  // UIの作成
  const uiManager = await createUI(config);

  const dungeonManager = new DungeonManager();
  const multi = new MultipleDungeonSystem(dungeonManager);
  const ui = new UISystem(dungeonManager);
  const combat = new CombatSystem();
  const inputSystem = new InputSystem(config);

  const player = new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });

  const select = multi.selectDungeon('beginner-cave', player);
  if (!select.success) {
    uiManager.displayMessage(`Failed to enter dungeon: ${select.message}`);
    return;
  }

  const dungeon = dungeonManager.getCurrentDungeon();
  if (!dungeon) {
    uiManager.displayMessage('No dungeon generated');
    return;
  }

  const spawn: Position = dungeon.playerSpawn;
  player.setPosition(spawn);
  dungeonManager.addEntity(player, spawn);

  const canvas = uiManager.getGameCanvas();
  if (!canvas) {
    console.error('Game canvas not found');
    return;
  }
  
  const renderer = new CanvasRenderer(canvas, config.ui.viewport.tileSize);
  
  // タイルセットマネージャーの初期化
  let tilesetManager: TilesetManager | null = null;
  try {
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
        renderer.setGameConfig(config);
      } catch (error) {
        console.warn('Failed to load tileset:', error);
        renderer.setTilesetManager(tilesetManager);
        renderer.setGameConfig(config);
      }
    }
  } catch (error) {
    console.warn('Failed to load tileset:', error);
  }
  
  // 設定からビューポートを設定
  renderer.setViewportTiles(config.ui.viewport.tilesX, config.ui.viewport.tilesY);
  renderer.setTileSize(config.ui.viewport.tileSize);
  
  // ミニマップ接続
  const minimap = uiManager.setupMinimap();
  if (minimap) {
    renderer.attachMinimap(minimap);
  }

  let inventoryOpen = false;

  const renderInventory = () => {
    uiManager.updateInventoryList(player.inventory);
  };

  const setInventoryOpen = (open: boolean) => {
    inventoryOpen = open;
    uiManager.setInventoryModalOpen(open);
    if (open) renderInventory();
  };

  // Confirm modal is handled by openChoiceModal()

  const render = () => {
    const current = dungeonManager.getCurrentDungeon();
    if (!current) return;
    renderer.render(current, dungeonManager, player);
    uiManager.displayMessages(ui.getMessages(config.ui.messages.maxLines));
  };

  const onAdvanceFloor = () => {
    const adv = multi.advanceFloor(player);
    if (!adv.success) return;
    
    const newDungeon = dungeonManager.getCurrentDungeon();
    if (newDungeon) {
      const newSpawn = newDungeon.playerSpawn;
      
      // プレイヤーの位置を更新
      player.setPosition(newSpawn);
      
      // 新しいダンジョンにプレイヤーを追加
      dungeonManager.addEntity(player, newSpawn);
    }
  };

  bindKeys((e) => {
    const current = player.position;
    let next: Position | null = null;

    const key = e.key;

    // Global cancel handling for future modal operations
    if (inputSystem.isActionKey(key) && key.toLowerCase() === 'x') {
      if (isModalOpen()) {
        cancelCurrentModal();
        ui.pushMessage(config.messages.ui.cancel);
        render();
        return;
      }
      if (inventoryOpen) {
        setInventoryOpen(false);
        ui.pushMessage(config.messages.ui.cancel);
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

    let inputAction: any = null;
    
    if (!inventoryOpen && !isModalOpen()) {
      inputAction = inputSystem.processKeyEvent(key);
      if (inputAction?.type === 'movement' && inputAction.direction) {
        next = inputSystem.calculateNextPosition(current, inputAction.direction);
      }
    }
    
    if (inputAction?.type === 'action') {
      switch (inputAction.action) {
        case 'inventory':
          // Inventory toggle
          setInventoryOpen(!inventoryOpen);
          ui.pushMessage(inventoryOpen ? config.messages.ui.inventoryClose : config.messages.ui.inventoryOpen);
          break;
        case 'confirm':
          if (inventoryOpen) {
            ui.pushMessage(config.messages.ui.itemUseUnimplemented);
            setInventoryOpen(false);
          } else {
            // If on stairs, open confirm modal; otherwise attack
            const cell = dungeonManager.getCellAt(player.position);
            if (cell && (cell.type === 'stairs-down' || cell.type === 'stairs-up')) {
              const dir = dungeonManager.getCurrentProgressionDirection();
              const title = dir === 'down' ? config.messages.ui.stairsConfirmDown : config.messages.ui.stairsConfirmUp;
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
                  ui.pushMessage(dir === 'down' ? config.messages.ui.stairsAdvanceDown : config.messages.ui.stairsAdvanceUp);
                  render();
                } else {
                  ui.pushMessage(config.messages.ui.stairsDecline);
                  render();
                }
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
                ui.pushMessage(config.messages.ui.attackMiss);
              }
            }
          }
          break;
      }
    }

    if (next && !inventoryOpen) {
      dungeonManager.moveEntity(player, next);
      
      // 階段タイルに移動した場合、自動的にモーダルを開く
      const newCell = dungeonManager.getCellAt(next);
      if (newCell && (newCell.type === 'stairs-down' || newCell.type === 'stairs-up')) {
        const dir = dungeonManager.getCurrentProgressionDirection();
        const title = dir === 'down' ? config.messages.ui.stairsConfirmDown : config.messages.ui.stairsConfirmUp;
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
            ui.pushMessage(dir === 'down' ? config.messages.ui.stairsAdvanceDown : config.messages.ui.stairsAdvanceUp);
            render();
          } else {
            ui.pushMessage(config.messages.ui.stairsDecline);
            render();
          }
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


