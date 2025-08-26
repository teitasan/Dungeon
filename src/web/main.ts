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

function bindKeys(handler: (e: KeyboardEvent & { type: string }) => void): void {
  window.addEventListener('keydown', (e) => {
    // prevent page scroll on arrow keys/space
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (navKeys.includes(e.key) || e.key === ' ' || e.key === '.') {
      e.preventDefault();
    }
    
    // イベントオブジェクトを正しく作成
    const eventData = {
      key: e.key,
      code: e.code,
      type: 'keydown',
      preventDefault: e.preventDefault.bind(e),
      stopPropagation: e.stopPropagation.bind(e)
    };
    handler(eventData as any);
  });
  
  window.addEventListener('keyup', (e) => {
    // イベントオブジェクトを正しく作成
    const eventData = {
      key: e.key,
      code: e.code,
      type: 'keyup',
      preventDefault: e.preventDefault.bind(e),
      stopPropagation: e.stopPropagation.bind(e)
    };
    handler(eventData as any);
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

  // ビット演算によるキー状態管理（Qiita記事を参考）
  const KEY_UP = 1;      // 0001
  const KEY_DOWN = 2;    // 0010
  const KEY_LEFT = 4;    // 0100
  const KEY_RIGHT = 8;   // 1000
  
  let keyPress = 0;      // 現在押されているキー
  let keyTrg = 0;        // トリガー変数（押された瞬間のみ）
  
  // 行動制限フラグ（ターン制ゲーム用）
  let canMove = true;      // 移動可能フラグ
  let canAttack = true;    // 攻撃可能フラグ
  
  // ターン制御フラグ
  let turnInProgress = false;  // ターン進行中フラグ
  let turnStartTime = 0;       // ターン開始時刻
  const TURN_DURATION = 100;  // ターン持続時間
  
  // 移動処理の重複実行を防ぐフラグ
  let movementInProgress = false;
  let lastMovementTime = 0;  // 最後の移動処理時刻
  const MOVEMENT_COOLDOWN = 50;  // 移動処理のクールダウン時間（ミリ秒）

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
    if (!current) {
      return;
    }
    
    // ターン制御チェック
    if (turnInProgress) {
      const elapsed = Date.now() - turnStartTime;
      if (elapsed < TURN_DURATION) {
        // まだ1秒経過していない → 移動処理をスキップ
        return;
      }
      // 1秒経過 → 行動フラグをリセット
      turnInProgress = false;
      canMove = true;
      canAttack = true;
      console.log(`[DEBUG] ターン制御完了: 行動フラグリセット (経過時間: ${elapsed}ms)`);
    }
    
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
    
    // 移動処理を実行（ゲームループ内）
    // ターン制御中は移動処理をスキップ
    if (!turnInProgress) {
      processMovement();
    }
    
    renderer.render(current, dungeonManager, player, turnSystem);
  };

  // キー状態管理のみ（移動処理はゲームループ内で実行）
  bindKeys((e) => {
    const key = e.key;
    const type = e.type; // 'keydown' または 'keyup'

    console.log(`[DEBUG] キーイベント受信: key=${key}, type=${type}, code=${e.code}`);
    
    // ビット演算によるキー状態管理（Qiita記事を参考）
      if (type === 'keydown') {
      switch (key) {
        case 'ArrowUp':
          if ((keyPress & KEY_UP) === 0) {
            keyPress |= KEY_UP;
            keyTrg |= KEY_UP;
          }
          break;
        case 'ArrowDown':
          if ((keyPress & KEY_DOWN) === 0) {
            keyPress |= KEY_DOWN;
            keyTrg |= KEY_DOWN;
          }
          break;
        case 'ArrowLeft':
          if ((keyPress & KEY_LEFT) === 0) {
            keyPress |= KEY_LEFT;
            keyTrg |= KEY_LEFT;
          }
          break;
        case 'ArrowRight':
          if ((keyPress & KEY_RIGHT) === 0) {
            keyPress |= KEY_RIGHT;
            keyTrg |= KEY_RIGHT;
          }
          break;
      }
    } else if (type === 'keyup') {
      switch (key) {
        case 'ArrowUp':
          keyPress &= ~KEY_UP;
          break;
        case 'ArrowDown':
          keyPress &= ~KEY_DOWN;
          break;
        case 'ArrowLeft':
          keyPress &= ~KEY_LEFT;
          break;
        case 'ArrowRight':
          keyPress &= ~KEY_RIGHT;
          break;
      }
    }
    
    console.log(`[DEBUG] 現在のキー状態: keyPress=${keyPress.toString(2).padStart(4, '0')}, keyTrg=${keyTrg.toString(2).padStart(4, '0')}`);
    
    // デバッグ: 個別キーの状態確認
    console.log(`[DEBUG] 個別キー状態: UP=${(keyPress & KEY_UP) !== 0}, DOWN=${(keyPress & KEY_DOWN) !== 0}, LEFT=${(keyPress & KEY_LEFT) !== 0}, RIGHT=${(keyPress & KEY_RIGHT) !== 0}`);
    
    // インベントリ内でのキー操作を優先処理
    if (inventoryOpen) {
      // インベントリ内での移動処理（簡易版）
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const direction = key === 'ArrowUp' ? 'up' : 'down';
        const result = ui.handleInventoryAction('move-selection', direction);
          if (result.success) {
            renderInventory();
        }
        return;
      }
      
      if (key === 'Enter' || key === 'z' || key === 'Z') {
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
      
      if (key === 'x' || key === 'X') {
        setInventoryOpen(false);
        render();
        return;
      }
      
      return; // インベントリ中は他の処理をスキップ
    }
    
    // アクションキーの処理
    if (key === 'i' || key === 'I') {
      // Inventory toggle
      setInventoryOpen(!inventoryOpen);
      return;
    }
    
    if (key === 'Enter' || key === 'z' || key === 'Z') {
      // 攻撃処理はkeydownのみで実行
      if (type !== 'keydown') {
        return;
      }
      
      // 攻撃可能フラグチェック
      if (!canAttack) {
        console.log(`[DEBUG] 攻撃不可: フラグがfalse`);
        return;
      }
      
      console.log(`[DEBUG] 攻撃キー検出: ${key} (${type})`);
      
      // プレイヤーの正面の位置を計算
      const frontPosition = getFrontPosition(player.position, player.direction);
      console.log(`[DEBUG] プレイヤー位置: (${player.position.x}, ${player.position.y}), 向き: ${player.direction}`);
      console.log(`[DEBUG] 正面位置: (${frontPosition.x}, ${frontPosition.y})`);
      
      // 正面のセルを取得
      const frontCell = dungeonManager.getCellAt(frontPosition);
      console.log(`[DEBUG] 正面セル情報:`, frontCell);
      
      if (frontCell && frontCell.entities.length > 0) {
        // 正面に敵がいる場合：通常の攻撃
        console.log(`[DEBUG] 正面エンティティ数: ${frontCell.entities.length}`);
        const target = frontCell.entities[0];
        console.log(`[DEBUG] ターゲット:`, target);
        
        if (target.id !== player.id) {
          console.log(`[DEBUG] 攻撃試行: プレイヤー(${player.id}) -> ターゲット(${target.id})`);
          const attackResult = combat.executeAttack({
            attacker: player,
            defender: target,
            attackType: 'melee'
          });
          console.log(`[DEBUG] 攻撃結果:`, attackResult);
          
          if (attackResult.success) {
            ui.pushMessage(`攻撃成功！${target.id}に${attackResult.damage}ダメージ`);
            canAttack = false; // 攻撃フラグをリセット
            handlePlayerAction('attack', true);
          } else {
            ui.pushMessage(`攻撃失敗: ${attackResult.message}`);
          }
          

        } else {
          console.log(`[DEBUG] ターゲットがプレイヤー自身のため攻撃スキップ`);
        }
      } else {
        // 正面に敵がいない場合：空振り
        console.log(`[DEBUG] 空振り実行: プレイヤー(${player.id})`);
        ui.pushMessage('空振り！');
        canAttack = false; // 攻撃フラグをリセット
        handlePlayerAction('attack', true); // 空振りでもターン消費
        

      }
      
      console.log(`[DEBUG] 攻撃処理完了`);
      return;
    }
  });

  // キー状態をリセットする関数
  function resetKeyState(): void {
    keyPress = 0;
    keyTrg = 0;
  }

  // 8方向移動処理（ゲームループ内で実行）
  function processMovement() {
    // 移動可能フラグチェック
    if (!canMove) {
      return;
    }

    // ターン制御中は移動処理をスキップ
    if (turnInProgress) {
      return;
    }

    // 移動処理中は重複実行を防ぐ
    if (movementInProgress) {
      return;
    }
    
    // クールダウン時間内は移動処理をスキップ
    const currentTime = Date.now();
    if (currentTime - lastMovementTime < MOVEMENT_COOLDOWN) {
      return;
    }

    // モーダルが開いている場合は移動を無効化（インベントリと同様）
    if (isModalOpen()) {
      return;
    }
    
    // ビット演算によるキー状態から移動方向を決定
    const up = (keyPress & KEY_UP) !== 0;
    const down = (keyPress & KEY_DOWN) !== 0;
    const left = (keyPress & KEY_LEFT) !== 0;
    const right = (keyPress & KEY_RIGHT) !== 0;
    
    // キーが押されていない場合は処理をスキップ
    if (!up && !down && !left && !right) {
      return;
    }
    
    // 移動方向を決定（同時押しを優先）
    let direction: string | null = null;
    
    // 同時押しによる斜め移動を最優先
    if (up && right) {
      direction = 'northeast';
      console.log(`[DEBUG] 北東移動検出（同時押し）`);
    } else if (up && left) {
      direction = 'northwest';
      console.log(`[DEBUG] 北西移動検出（同時押し）`);
    } else if (down && right) {
      direction = 'southeast';
      console.log(`[DEBUG] 南東移動検出（同時押し）`);
    } else if (down && left) {
      direction = 'southwest';
      console.log(`[DEBUG] 南西移動検出（同時押し）`);
    }
    // 単体キーによる直線移動
    else if (up) {
      direction = 'up';
      console.log(`[DEBUG] 上移動検出（単体キー）`);
    } else if (down) {
      direction = 'down';
      console.log(`[DEBUG] 下移動検出（単体キー）`);
    } else if (left) {
      direction = 'left';
      console.log(`[DEBUG] 左移動検出（単体キー）`);
    } else if (right) {
      direction = 'right';
      console.log(`[DEBUG] 右移動検出（単体キー）`);
    }
    
    if (!direction) {
      console.log(`[DEBUG] 移動方向なし - 移動処理をスキップ`);
      return; // 移動なし
    }
    
    console.log(`[DEBUG] 最終移動方向決定: ${direction}`);
    
    // 移動実行
    const current = player.position;
    const next = get8DirectionPosition(current, direction);
    
    console.log(`[DEBUG] 移動実行: 現在(${current.x}, ${current.y}) -> 目標(${next.x}, ${next.y})`);
    
    // プレイヤーの向きを更新
    const directionMap: Record<string, 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest'> = {
      'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east',
      'northeast': 'northeast', 'southeast': 'southeast', 'southwest': 'southwest', 'northwest': 'northwest'
    };
    player.direction = directionMap[direction] || 'south';
    
    // MovementSystem用の方向変換
    const movementDirectionMap: Record<string, string> = {
      'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east',
      'northeast': 'northeast', 'southeast': 'southeast', 'southwest': 'southwest', 'northwest': 'northwest'
    };
    const movementDirection = movementDirectionMap[direction] || direction;
    
            // 移動処理を実行
      if (next && !inventoryOpen && !isModalOpen() && next.x !== undefined && next.y !== undefined) {
        // 移動処理開始フラグを設定
        movementInProgress = true;
        lastMovementTime = Date.now();
        
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
        
              // 移動を試行
        console.log(`[DEBUG] 移動試行: プレイヤー(${player.id}) -> 方向(${movementDirection})`);
        const moveResult = movementSystem.attemptMoveWithActionResult(player, movementDirection as any);
        console.log(`[DEBUG] 移動結果:`, moveResult);
        
        // 移動成功時の処理
        if (moveResult.success) {
          console.log(`[DEBUG] 移動成功: プレイヤー位置更新`);
          
          // 移動フラグをリセット
          canMove = false;
          
          // 階段タイルの処理
          const currentCell = dungeonManager.getCellAt(next);
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
                      ui.pushMessage(dir === 'down' ? config.messages.ui.stairsConfirmDown : config.messages.ui.stairsAdvanceUp);
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
          
          // プレイヤー行動ハンドラーでターン処理
          handlePlayerAction('move', true);
        } else {
          console.log(`[DEBUG] 移動失敗: ${moveResult.message}`);
          // 移動失敗時のメッセージは表示しない
        }
        
        // 移動処理完了後にフラグをリセット
        movementInProgress = false;
      }
    }
    
  // プレイヤー行動ハンドラー（完全同期処理を保証）
  function handlePlayerAction(action: 'move' | 'attack' | 'item', success: boolean, data?: any) {
    console.log(`[DEBUG] handlePlayerAction呼び出し: action=${action}, success=${success}`);
    
    if (success || action === 'attack') { // 攻撃は常にターン消費
      console.log(`[DEBUG] ターン処理開始: ${action}`);
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
      
      // ターン制御フラグを設定（1秒間待機開始）
      turnInProgress = true;
      turnStartTime = Date.now();
      console.log(`[DEBUG] ターン制御開始: 行動フラグはfalseのまま (経過時間: 0ms)`);
      
      console.log(`[DEBUG] プレイヤー行動完了: ${action}, ターン実行完了`);
    } else {
      console.log(`[DEBUG] ターン処理スキップ: action=${action}, success=${success}`);
    }
  }
  
  // 8方向の移動方向をPositionに変換する関数
  function get8DirectionPosition(current: Position, direction: string): Position {
    switch (direction) {
      case 'up': return { x: current.x, y: current.y - 1 };
      case 'down': return { x: current.x, y: current.y + 1 };
      case 'left': return { x: current.x - 1, y: current.y };
      case 'right': return { x: current.x + 1, y: current.y };
      case 'northeast': return { x: current.x + 1, y: current.y - 1 };
      case 'southeast': return { x: current.x + 1, y: current.y + 1 };
      case 'southwest': return { x: current.x - 1, y: current.y + 1 };
      case 'northwest': return { x: current.x - 1, y: current.y - 1 };
      default: return current;
    }
  }
  
  // プレイヤーの正面位置を計算する関数
  function getFrontPosition(current: Position, direction: string): Position {
    switch (direction) {
      case 'north': return { x: current.x, y: current.y - 1 };
      case 'south': return { x: current.x, y: current.y + 1 };
      case 'west': return { x: current.x - 1, y: current.y };
      case 'east': return { x: current.x + 1, y: current.y };
      case 'northeast': return { x: current.x + 1, y: current.y - 1 };
      case 'southeast': return { x: current.x + 1, y: current.y + 1 };
      case 'southwest': return { x: current.x - 1, y: current.y + 1 };
      case 'northwest': return { x: current.x - 1, y: current.y - 1 };
      default: return { x: current.x, y: current.y + 1 }; // デフォルトは南向き
    }
  }

  ui.pushMessage(`Entered ${select.dungeon!.name}`);
  
  // サンプル用：50文字程度の日本語メッセージ
  setTimeout(() => {
    ui.pushMessage('プレイヤーは強力な魔法の剣を手に入れて、敵に対して大きなダメージを与えることができるようになった。この武器は伝説の鍛冶師によって作られたものである。');
  }, 1000);
  
  // 初回レンダリング（メッセージは既にpushMessageで表示済み）
  render();
  
  // ゲームループ開始（30FPS固定 + requestAnimationFrame使用）
  const FPS = 30;
  const FRAME_INTERVAL = 1000 / FPS; // 約33.33ms
  
  let lastFrameTime = 0;
  
  const gameLoop = (currentTime: number) => {
    const deltaTime = currentTime - lastFrameTime;
    
    if (deltaTime >= FRAME_INTERVAL) {
      lastFrameTime = currentTime - (deltaTime % FRAME_INTERVAL);
      
      // ゲームの更新処理
  render();
    }
    
    requestAnimationFrame(gameLoop);
  };
  
  console.log(`[DEBUG] ゲームループ開始: ${FPS}FPS (${FRAME_INTERVAL.toFixed(1)}ms間隔)`);
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => start());
} else {
  start();
}


