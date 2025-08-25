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
import { MovementSystem } from '../systems/MovementSystem.js';
import { ActionResult } from '../types/movement.js';

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
  const movementSystem = new MovementSystem(dungeonManager);
  const turnSystem = new TurnSystem(
    config.turnSystem,
    dungeonManager,
    combat,
    undefined, // hungerSystem - 後で追加
    undefined  // statusSystem - 後で追加
  );
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

  // テスト用：通常速度モンスター
  const testMonster = {
    id: 'enemy-test-1',
    position: { x: spawn.x + 3, y: spawn.y + 1 },
    components: [],
    stats: { hp: 20, maxHp: 20, attack: 5, defense: 2, evasionRate: 0.1 },
    flags: {},
    speedState: 'normal' as const
  };
  
  // テスト用：倍速モンスター
  const fastMonster = {
    id: 'fast-enemy-1',
    position: { x: spawn.x + 5, y: spawn.y + 2 },
    components: [],
    stats: { hp: 15, maxHp: 15, attack: 3, defense: 1, evasionRate: 0.05 },
    flags: {},
    speedState: 'fast' as const
  };
  
  // テスト用：鈍足モンスター
  const slowMonster = {
    id: 'slow-enemy-1',
    position: { x: spawn.x + 1, y: spawn.y + 3 },
    components: [],
    stats: { hp: 30, maxHp: 30, attack: 8, defense: 3, evasionRate: 0.2 },
    flags: {},
    speedState: 'slow' as const
  };
  
  // テスト用：カスタムルール倍速モンスター（攻撃は1回のみ）
  const customFastMonster = {
    id: 'custom-fast-enemy-1',
    position: { x: spawn.x + 2, y: spawn.y + 5 },
    components: [],
    stats: { hp: 12, maxHp: 12, attack: 6, defense: 2, evasionRate: 0.1 },
    flags: {},
    speedState: 'fast' as const,
    customRules: {
      action1: { canMove: true, canAttack: true },
      action2: { canMove: true, canAttack: false }  // 2回目は移動のみ
    }
  };
  
  // モンスターをダンジョンに追加
  const monsters = [testMonster, fastMonster, slowMonster, customFastMonster];
  monsters.forEach(monster => {
    if (dungeonManager.isWalkable(monster.position)) {
      dungeonManager.addEntity(monster as any, monster.position);
    }
  });

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
      gold: 0, // プレイヤーの所持金（現在は0で固定）
      turn: turnSystem.getCurrentTurn()
    });
    
    renderer.render(current, dungeonManager, player, turnSystem);
  };

  bindKeys((e) => {
    const current = player.position;
    let next: Position | null = null;
    let moveResult: ActionResult | null = null;
    
    // プレイヤー行動ハンドラー（完全同期処理を保証）
    function handlePlayerAction(action: 'move' | 'attack' | 'item', success: boolean, data?: any) {
      if (success || action === 'attack') { // 攻撃は常にターン消費
        turnSystem.recordPlayerAction(player, action, false);
        console.log(`[DEBUG] プレイヤー行動完了: ${action}, ターン実行開始`);
        
        // 完全同期処理：即座にターンシステムを実行
        turnSystem.executeTurn();
        console.log(`[DEBUG] ターンシステム実行完了: 次のターン ${turnSystem.getCurrentTurn()}`);
        
        // ターンシステム実行後にUIを更新（ターン数表示を更新）
        const current = dungeonManager.getCurrentDungeon();
        if (current) {
          uiManager.updateGameInfoOverlay({
            floor: current.floor,
            level: player.stats.level,
            currentHp: player.stats.hp,
            maxHp: player.stats.maxHp,
            gold: 0,
            turn: turnSystem.getCurrentTurn()
          });
        }
        
        console.log(`[DEBUG] プレイヤー行動完了: ${action}, ターン実行完了`);
      }
    }

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
      console.log(`[DEBUG] キー入力: ${key} -> アクション:`, inputAction);
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
        
        // アイテム使用成功時はプレイヤー行動ハンドラーでターン処理
        if (result.success) {
          handlePlayerAction('item', true);
        }
        
        // アイテム使用後は攻撃処理をスキップ
        return;
      }
      
      if (inputAction?.type === 'action' && inputAction.action === 'cancel') {
        setInventoryOpen(false);
        render();
        return;
      }
      
      // アイテム使用処理は既にhandlePlayerActionでターン処理されるため、
      // ここでは何もしない（攻撃処理はスキップ済み）
    }
    
    // 通常のゲーム操作（インベントリが閉じている場合）
    if (inputAction?.type === 'movement' && inputAction.direction) {
      console.log(`[DEBUG] 移動入力検出: ${inputAction.direction}`);
      next = inputSystem.calculateNextPosition(current, inputAction.direction);
      console.log(`[DEBUG] 現在位置: (${current.x}, ${current.y}) -> 次位置: (${next.x}, ${next.y})`);
    }
    
    if (inputAction?.type === 'action') {
      switch (inputAction.action) {
        case 'inventory':
          // Inventory toggle
          setInventoryOpen(!inventoryOpen);
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
              let attackResult: ActionResult | null = null;
              
              for (const pos of adj) {
                const targets = dungeonManager.getEntitiesAt(pos).filter(e => e.id !== player.id);
                if (targets.length > 0) {
                  const target = targets[0];
                  attackResult = combat.attemptAttackWithActionResult({
                    attacker: player as any,
                    defender: target as any,
                    attackType: 'melee'
                  } as any);
                  
                  if (attackResult.success) {
                    // Remove dead target from map
                    if ((target.stats as any).hp <= 0) {
                      dungeonManager.removeEntity(target);
                    }
                  }
                  break;
                }
              }
              
              if (!attackResult) {
                // 攻撃対象がいない場合（空振り）
                const airSwingResult: ActionResult = {
                  success: true,
                  actionType: 'attack',
                  consumedTurn: true,  // 空振りはターン消費
                  message: config.messages.ui.attackMiss
                };
                attackResult = airSwingResult;
                console.log(`[DEBUG] 空振り実行: ターン消費あり`);
                console.log(`[DEBUG] 空振り結果:`, airSwingResult);
                
                // 空振りメッセージを表示
                ui.pushMessage(airSwingResult.message || '空振りした');
              }
              
              // 攻撃は常にターン消費するため、プレイヤー行動ハンドラーで処理
              handlePlayerAction('attack', true);
            }
          }
          break;
      }
    }

    if (next && !inventoryOpen) {
      console.log(`[DEBUG] 移動処理開始: プレイヤー位置(${player.position.x}, ${player.position.y}) -> 目標位置(${next.x}, ${next.y})`);
      
      // 目標位置の詳細情報を確認
      const targetCell = dungeonManager.getCellAt(next);
      if (targetCell) {
        console.log(`[DEBUG] 目標位置の詳細:`, {
          position: next,
          type: targetCell.type,
          walkable: targetCell.walkable,
          transparent: targetCell.transparent,
          entities: targetCell.entities.length
        });
      }
      
      // 方向名を変換（InputSystem → MovementSystem）
      const directionMap: Record<string, string> = {
        'up': 'north',
        'down': 'south',
        'left': 'west',
        'right': 'east'
      };
      const movementDirection = directionMap[inputAction.direction] || inputAction.direction;
      console.log(`[DEBUG] 方向変換: ${inputAction.direction} → ${movementDirection}`);
      
      // 移動を試行し、ActionResultを取得
      const moveResult = movementSystem.attemptMoveWithActionResult(player, movementDirection as any);
      
      // 移動成功時のみターン処理を実行
      if (moveResult.success) {
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
        if (currentCell && (currentCell.type === 'stairs-down' || currentCell.type === 'stairs-up')) {
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
        
        // 移動成功時はプレイヤー行動ハンドラーでターン処理
        handlePlayerAction('move', true);
      }
    }

    // プレイヤー行動は各処理内でhandlePlayerActionにより即座にターン処理される
    // 複雑な条件分岐は不要になったため削除

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


