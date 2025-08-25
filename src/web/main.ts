import { DungeonManager } from '../dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from '../systems/MultipleDungeonSystem.js';
import { PlayerEntity } from '../entities/Player.js';
import { ItemEntity } from '../entities/Item.js';
import { UISystem } from '../systems/UISystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import type { Position } from '../types/core.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { openChoiceModal, isModalOpen, cancelCurrentModal } from './ui/Modal.js';
import { TilesetManager } from './TilesetManager.js';
import { WebConfigLoader } from './WebConfigLoader.js';
import { InputSystem } from '../systems/InputSystem.js';
import { UIManager } from './ui/UIManager.js';
import { TurnSystem } from '../systems/TurnSystem.js';

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
  const turnSystem = new TurnSystem();
  const itemSystem = new ItemSystem(dungeonManager);

  // システム間の依存関係を設定
  ui.setUIManager(uiManager);
  ui.setItemSystem(itemSystem);

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

  // テスト用アイテムを初期インベントリに追加（レミーラ5個）
  const testItems = [
    {
      id: 'scroll-remilla-1',
      name: 'レミーラの巻物',
      effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
    },
    {
      id: 'scroll-remilla-2',
      name: 'レミーラの巻物',
      effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
    },
    {
      id: 'scroll-remilla-3',
      name: 'レミーラの巻物',
      effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
    },
    {
      id: 'scroll-remilla-4',
      name: 'レミーラの巻物',
      effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
    },
    {
      id: 'scroll-remilla-5',
      name: 'レミーラの巻物',
      effect: { type: 'reveal-map', value: 1, description: 'フロア全体の地形と罠の位置を表示' }
    }
  ];

  for (const itemData of testItems) {
    const item = new ItemEntity(
      itemData.id,
      itemData.name,
      'consumable',
      { x: 0, y: 0 }
    );
    item.addEffect(itemData.effect);
    item.identify();
    player.addToInventory(item);
  }

  const canvas = uiManager.getGameCanvas();
  if (!canvas) {
    console.error('Game canvas not found');
    return;
  }
  
  const renderer = new CanvasRenderer(canvas, config.ui.viewport.tileSize);
  
  // DungeonManagerをCanvasRendererに設定（千里眼効果用）
  renderer.setDungeonManager(dungeonManager);
  
  // UISystemにレンダラーを設定
  ui.setRenderer(renderer);
  
  // MultipleDungeonSystemにレンダラーを設定（フロア変更時の効果管理用）
  multi.setRenderer(renderer);

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

  // ゲーム情報オーバーレイを作成
  uiManager.createGameInfoOverlay();

  let inventoryOpen = false;

  const renderInventory = () => {
    uiManager.updateInventoryList(player.inventory);
  };

  const setInventoryOpen = (open: boolean) => {
    inventoryOpen = open;
    uiManager.setInventoryModalOpen(open);
    if (open) renderInventory();
  };

  const render = () => {
    const current = dungeonManager.getCurrentDungeon();
    if (!current) return;
    
    // ターンシステムの初期化
    const entities = dungeonManager.getAllEntities();
    turnSystem.initializeTurnOrder(entities);
    
    // ゲーム情報オーバーレイを更新
    uiManager.updateGameInfoOverlay({
      floor: current.floor,
      level: player.stats.level,
      currentHp: player.stats.hp,
      maxHp: player.stats.maxHp,
      gold: 0 // プレイヤーの所持金（現在は0で固定）
    });
    
    renderer.render(current, dungeonManager, player, turnSystem);
  };

  bindKeys((e) => {
    const current = player.position;
    let next: Position | null = null;

    const key = e.key;

    // Global cancel handling for future modal operations
    if (inputSystem.isActionKey(key) && key.toLowerCase() === 'x') {
      if (isModalOpen()) {
        cancelCurrentModal();
        render();
        return;
      }
      if (inventoryOpen) {
        setInventoryOpen(false);
        render();
        return;
      }
      return;
    }

    // While a modal is open, delegate all keys to the modal only
    if (isModalOpen()) {
      return;
    }

    let inputAction: any = null;
    
    // インベントリが開いている場合でもキー入力を処理
    if (!isModalOpen()) {
      inputAction = inputSystem.processKeyEvent(key);
    }
    
    // インベントリ内でのキー操作を優先処理
    if (inventoryOpen) {
      if (inputAction?.type === 'movement' && inputAction.direction) {
        // インベントリ内でのアイテム選択移動
        if (inputAction.direction === 'up' || inputAction.direction === 'down') {
          const result = ui.handleInventoryAction('move-selection', inputAction.direction);
          if (result.success) {
            renderInventory();
          }
        }
      }
      
      if (inputAction?.type === 'action' && inputAction.action === 'confirm') {
        // アイテム使用処理
        const result = ui.handleInventoryAction('use-item');
        ui.pushMessage(result.message);
        
        // アイテム使用後に即座にレンダリングを更新（ミニマップ反映のため）
        render();
        
        if (result.shouldClose) {
          setInventoryOpen(false);
          renderInventory();
        }
        return;
      }
      
      if (inputAction?.type === 'action' && inputAction.action === 'cancel') {
        setInventoryOpen(false);
        render();
        return;
      }
      
      return;
    }
    
    // 通常のゲーム操作（インベントリが閉じている場合）
    if (inputAction?.type === 'movement' && inputAction.direction) {
      next = inputSystem.calculateNextPosition(current, inputAction.direction);
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
            break;
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
              }).then(async (res) => {
                if (res.type === 'ok' && res.selectedId === 'yes') {
                  try {
                    const result = await multi.advanceFloorWithPlayer(player);
                    if (result.success) {
                      if (result.isCompleted) {
                        ui.pushMessage(result.message);
                      } else {
                        ui.pushMessage(dir === 'down' ? config.messages.ui.stairsAdvanceDown : config.messages.ui.stairsAdvanceUp);
                        
                        // フロア変更時の効果チェックはMultipleDungeonSystem内で処理される
                      }
                    } else {
                      ui.pushMessage('フロア進行に失敗しました');
                    }
                    render();
                  } catch (error) {
                    console.error('[ERROR] 階段進行中にエラー:', error);
                    ui.pushMessage('フロア進行中にエラーが発生しました');
                    render();
                  }
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
      
      // 現在のタイル情報を出力
      const currentCell = dungeonManager.getCellAt(next);
      if (currentCell) {
        console.log(`[DEBUG] プレイヤー位置: (${next.x}, ${next.y}), タイルタイプ: ${currentCell.type}`);
        console.log(`[DEBUG] タイル詳細:`, {
          type: currentCell.type,
          walkable: currentCell.walkable,
          transparent: currentCell.transparent,
          entities: currentCell.entities.length
        });
      }
      
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
        }).then(async (res) => {
          if (res.type === 'ok' && res.selectedId === 'yes') {
            try {
              const result = await multi.advanceFloorWithPlayer(player);
              if (result.success) {
                if (result.isCompleted) {
                  ui.pushMessage(result.message);
                } else {
                  ui.pushMessage(dir === 'down' ? config.messages.ui.stairsAdvanceDown : config.messages.ui.stairsAdvanceUp);
                  
                  // フロア変更時の効果チェックはMultipleDungeonSystem内で処理される
                }
              } else {
                ui.pushMessage('フロア進行に失敗しました');
              }
              render();
            } catch (error) {
              console.error('[ERROR] 移動時の階段進行中にエラー:', error);
              ui.pushMessage('フロア進行中にエラーが発生しました');
              render();
            }
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
  
  // サンプル用：50文字程度の日本語メッセージ
  setTimeout(() => {
    ui.pushMessage('プレイヤーは強力な魔法の剣を手に入れて、敵に対して大きなダメージを与えることができるようになった。この武器は伝説の鍛冶師によって作られたものである。');
  }, 1000);
  
  // 初回レンダリング（メッセージは既にpushMessageで表示済み）
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => start());
} else {
  start();
}


