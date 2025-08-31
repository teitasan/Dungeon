import { DungeonManager } from '../dungeon/DungeonManager.js';
import { MultipleDungeonSystem } from '../systems/MultipleDungeonSystem.js';
import { PlayerEntity } from '../entities/Player.js';
import { ItemEntity } from '../entities/Item.js';
import { UISystem } from '../systems/UISystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { TurnSystem } from '../systems/TurnSystem.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { TilesetManager } from './TilesetManager.js';
import { ItemSpriteManager } from './ItemSpriteManager.js';
import { WebConfigLoader } from './WebConfigLoader.js';
import { UIManager } from './ui/UIManager.js';
import type { Position } from '../types/core.js';

// ECS統合のためのインポート - 削除済み

export interface GameSystems {
  dungeonManager: DungeonManager;
  multipleDungeonSystem: MultipleDungeonSystem;
  uiSystem: UISystem;
  combatSystem: CombatSystem;
  inputSystem: InputSystem;
  movementSystem: MovementSystem;
  turnSystem: TurnSystem;
  itemSystem: ItemSystem;
  renderer: CanvasRenderer;
  tilesetManager: TilesetManager | null;
}

export class GameInitializer {
  private configLoader: WebConfigLoader;

  constructor() {
    this.configLoader = new WebConfigLoader();
  }

  async initialize(): Promise<{
    systems: GameSystems;
    player: PlayerEntity;
    uiManager: UIManager;
    config: any;
  }> {
    // 設定の読み込み
    const config = await this.configLoader.loadGameConfig();
    
    // UIの作成
    const uiManager = await this.createUI(config);

    // システムの初期化
    const systems = await this.initializeSystems(config);

    // 非ECSプレイヤーの作成（段階的移行のため残存）
    const player = await this.createPlayer(config);

    // ダンジョンの初期化
    await this.initializeDungeon(systems, player, config);

    // テスト用モンスターの追加
    await this.addTestMonsters(systems, player, config);

    // テスト用アイテムの追加
    const spawn = player.position;
    await this.addTestItems(systems, player, spawn);

    // レンダラーの設定
    await this.setupRenderer(systems, uiManager, config);

    // ミニマップの設定
    this.setupMinimap(systems, uiManager);

    // ゲーム情報オーバーレイの作成
    uiManager.createGameInfoOverlay();

    return { systems, player, uiManager, config };
  }

  private async createUI(config: any): Promise<UIManager> {
    const app = document.querySelector('#app') as HTMLElement;
    if (!app) throw new Error('Element not found: #app');
    
    const uiManager = new UIManager(config, app);
    uiManager.createLayout();
    return uiManager;
  }

  private async initializeSystems(config: any): Promise<GameSystems> {
    const dungeonManager = new DungeonManager();
    const multipleDungeonSystem = new MultipleDungeonSystem(dungeonManager);
    const uiSystem = new UISystem(dungeonManager);
    const combatSystem = new CombatSystem();
    const inputSystem = new InputSystem(config);
    // Itemテンプレートをレジストリに読み込み（あれば）
    try {
      const { ItemRegistry } = await import('../core/ItemRegistry.js');
      const reg = ItemRegistry.getInstance();
      reg.loadFromConfig(config?.items?.templates || []);
    } catch (e) {
      console.warn('ItemRegistry load failed (continuing with defaults):', e);
    }
    // 先に ItemSystem を生成してから MovementSystem に渡す
    const itemSystem = new ItemSystem(dungeonManager);
    // レジストリ優先でテンプレートを反映（レジストリが空の場合はItemSystem内デフォルトのまま）
    try {
      itemSystem.reloadTemplatesFromRegistry?.();
    } catch {}
    const movementSystem = new MovementSystem(dungeonManager, itemSystem);
    const turnSystem = new TurnSystem(
      config.turnSystem,
      dungeonManager,
      combatSystem,
      undefined, // hungerSystem - 後で追加
      undefined  // statusSystem - 後で追加
    );

    // システム間の依存関係を設定
    uiSystem.setItemSystem(itemSystem);
    // アイテム取得時などのメッセージをUIログへ
    itemSystem.setMessageSink((msg: string) => uiSystem.pushMessage(msg));
    // 戦闘結果のメッセージや撃破時の取り除きに必要な参照を設定
    combatSystem.setDungeonManager(dungeonManager);
    combatSystem.setMessageSink((msg: string) => uiSystem.pushMessage(msg));

    // DropSystem を MultipleDungeonSystem に登録（フロア生成時の床アイテムスポーン用）
    const { DropSystem } = await import('../systems/DropSystem.js');
    const dropSystem = new DropSystem(dungeonManager, itemSystem);
    multipleDungeonSystem.setDropSystem(dropSystem);

    return {
      dungeonManager,
      multipleDungeonSystem,
      uiSystem,
      combatSystem,
      inputSystem,
      movementSystem,
      turnSystem,
      itemSystem,
      renderer: null as any, // 後で設定
      tilesetManager: null,
      // ECS統合

    };
  }

  private async createPlayer(config: any): Promise<PlayerEntity> {
    return new PlayerEntity('player-1', 'Hero', { x: 0, y: 0 });
  }

  private async initializeDungeon(
    systems: GameSystems,
    player: PlayerEntity,
    config: any
  ): Promise<void> {
    const { dungeonManager, multipleDungeonSystem, uiSystem } = systems;

    const select = multipleDungeonSystem.selectDungeon('beginner-cave', player);
    if (!select.success) {
      throw new Error(`Failed to enter dungeon: ${select.message}`);
    }

    const dungeon = dungeonManager.getCurrentDungeon();
    if (!dungeon) {
      throw new Error('No dungeon generated');
    }

    const spawn: Position = dungeon.playerSpawn;
    player.setPosition(spawn);
    dungeonManager.addEntity(player, spawn);

    // UISystemにUIManagerを設定（後で行う）
  }

  private async addTestMonsters(
    systems: GameSystems,
    player: PlayerEntity,
    config: any
  ): Promise<void> {
    const { dungeonManager } = systems;
    const spawn = player.position;

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
  }

  private async addTestItems(systems: GameSystems, player: PlayerEntity, spawn: Position): Promise<void> {
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
      // テンプレートからアイテムを作成
      const item = ItemEntity.createFromTemplateObject({
        id: itemData.id,
        name: itemData.name,
        itemType: 'consumable',
        identified: true,
        cursed: false,
        effects: [itemData.effect]
      }, { x: 0, y: 0 });
      
      if (item) {
        player.addToInventory(item);
      }
    }

    // テスト用アイテムは削除済み（既存のデフォルトアイテムでスプライト表示をテスト）
  }

  private async setupRenderer(
    systems: GameSystems,
    uiManager: UIManager,
    config: any
  ): Promise<void> {
    const { dungeonManager, multipleDungeonSystem, uiSystem } = systems;
    
    const canvas = uiManager.getGameCanvas();
    if (!canvas) {
      throw new Error('Game canvas not found');
    }
    
    const renderer = new CanvasRenderer(canvas, config.ui.viewport.tileSize);
    
    // DungeonManagerをCanvasRendererに設定（千里眼効果用）
    renderer.setDungeonManager(dungeonManager);
    
    // UISystemにレンダラーを設定
    uiSystem.setRenderer(renderer);
    
    // MultipleDungeonSystemにレンダラーを設定（フロア変更時の効果管理用）
    multipleDungeonSystem.setRenderer(renderer);

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

    // アイテムスプライトマネージャーの初期化
    let itemSpriteManager: ItemSpriteManager | null = null;
    try {
      if (config.items?.spritesheet) {
        console.log('Item spritesheet config found');
        
        itemSpriteManager = new ItemSpriteManager(config.items.spritesheet);
        
        // 画像の読み込み完了を待ってからレンダラーに設定
        try {
          await itemSpriteManager.load();
          console.log('Item spritesheet loaded successfully');
          renderer.setItemSpriteManager(itemSpriteManager);
        } catch (error) {
          console.warn('Failed to load item spritesheet:', error);
          renderer.setItemSpriteManager(itemSpriteManager);
        }
      }
    } catch (error) {
      console.warn('Failed to load item spritesheet:', error);
    }
    
    // 設定からビューポートを設定
    renderer.setViewportTiles(config.ui.viewport.tilesX, config.ui.viewport.tilesY);
    renderer.setTileSize(config.ui.viewport.tileSize);

    // システムにレンダラーを設定
    systems.renderer = renderer;
    systems.tilesetManager = tilesetManager;

    // 初回入場時のアイキャッチ演出
    try {
      const currentDungeon = dungeonManager.getCurrentDungeon();
      if (currentDungeon) {
        await renderer.playFloorTransition(currentDungeon.name, currentDungeon.floor);
      }
    } catch (e) {
      console.warn('Initial floor transition effect failed:', e);
    }
  }

  private setupMinimap(systems: GameSystems, uiManager: UIManager): void {
    const { renderer } = systems;
    
    // ミニマップ接続
    const minimap = uiManager.setupMinimap();
    if (minimap) {
      renderer.attachMinimap(minimap);
    }
  }

}
