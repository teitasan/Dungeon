# Design Document

## Overview

不思議のダンジョン系ゲームは、完全にコンポーネント化されたアーキテクチャを採用し、全ての動作、数値、ルールを設定ファイルで管理する拡張性の高いローグライクゲームです。ブラウザ上でHTML5 Canvasを使用して2Dドット絵で描画され、TypeScriptで実装されます。

## Architecture

### Core Architecture Pattern

システムは以下の3層アーキテクチャで構成されます：

1. **Configuration Layer（設定層）**
   - 全ての数値、ルール、動作パラメータを管理
   - JSON形式の設定ファイル群
   - 実行時の設定変更をサポート

2. **Component Layer（コンポーネント層）**
   - 再利用可能な機能単位
   - 設定に基づいて動作を決定
   - プラグイン的な追加・削除が可能

3. **System Layer（システム層）**
   - コンポーネントを組み合わせてゲームロジックを実行
   - ターン管理、状態管理、イベント処理

### Component System Design

全ての機能をコンポーネントとして実装し、設定ファイルで組み合わせを定義：

```typescript
interface Component {
  id: string;                       // コンポーネントの一意識別子
  type: ComponentType;              // コンポーネントの種類
  config: ComponentConfig;          // コンポーネントの設定値
  execute(context: GameContext): ComponentResult; // コンポーネントの実行メソッド
}

interface ComponentConfig {
  [key: string]: any;               // 設定値は全て外部から注入
}
```

## Components and Interfaces

### Movement Component
```typescript
interface MovementComponent extends Component {
  type: 'movement';
  config: {
    distance: number;        // 移動距離
    directions: Direction[]; // 移動可能方向
    restrictions: string[];  // 移動制限ルール
  };
}
```

### Attack Component System
攻撃システムは3つの独立したコンポーネントの組み合わせ：

```typescript
interface AttackRangeComponent extends Component {
  type: 'attack-range';
  config: {
    pattern: 'adjacent' | 'line' | 'area' | 'custom'; // 攻撃パターンの種類
    range: number;                  // 攻撃可能距離
    shape?: number[][];             // カスタムパターン用の形状定義
    unavoidable?: boolean;          // 回避不能攻撃フラグ（デフォルト: false）
  };
}

interface AttackCountComponent extends Component {
  type: 'attack-count';
  config: {
    count: number;                  // 1ターンあたりの攻撃回数
    interval?: number;              // 連続攻撃の間隔（ミリ秒）
  };
}

interface AttackTargetComponent extends Component {
  type: 'attack-target';
  config: {
    maxTargets: number;             // 同時攻撃可能な最大対象数
    targetType: 'single' | 'multiple' | 'all-in-range'; // 対象選択方式
    priority: 'nearest' | 'weakest' | 'strongest'; // 対象優先順位
  };
}
```

### Hunger System Component
```typescript
interface HungerComponent extends Component {
  type: 'hunger';
  config: {
    decreaseRate: number;      // 満腹度減少率
    minValue: number;          // 最小値
    damageAmount: number;      // 空腹時ダメージ
    recoveryAmount: number;    // 食料回復量
    maxOverfeedTime: number;   // 満腹時間
  };
}
```

### Dungeon Generation Component
```typescript
interface DungeonGeneratorComponent extends Component {
  type: 'dungeon-generator';
  config: {
    size: { width: number; height: number }; // ダンジョンのサイズ（幅x高さ）
    roomCount: { min: number; max: number }; // 部屋数の範囲
    roomSize: { min: number; max: number };  // 部屋サイズの範囲
    corridorWidth: number;          // 通路の幅
    specialRoomChance: number;      // 特殊部屋の出現確率（0-1）
    specialRoomTypes: SpecialRoomType[]; // 特殊部屋の種類
  };
}

interface SpecialRoomType {
  type: 'monster-house' | 'shop' | 'treasure-room' | 'custom';
  chance: number;                  // 出現確率
  config: SpecialRoomConfig;       // 特殊部屋固有の設定
}

interface SpecialRoomConfig {
  monsterDensity?: number;         // モンスター密度（モンスターハウス用）
  itemCount?: { min: number; max: number }; // アイテム数（宝物庫用）
  shopItems?: ShopItemConfig[];    // 店の商品（店用）
  [key: string]: any;              // その他の設定
}
```

### Multi-Dungeon System Component
```typescript
interface DungeonSystemComponent extends Component {
  type: 'dungeon-system';
  config: {
    dungeons: DungeonDefinition[];  // 攻略可能なダンジョン一覧
    progressionSystem: ProgressionConfig; // ダンジョン解放システム
  };
}

interface DungeonDefinition {
  id: string;                      // ダンジョンID
  name: string;                    // ダンジョン名
  description: string;             // ダンジョンの説明
  floors: number;                  // 階層数
  bossFloors: number[];            // ボス階層（例：[10, 20, 30]）
  clearCondition: ClearCondition;  // クリア条件
  difficulty: DifficultyConfig;    // 難易度設定
  unlockConditions?: UnlockCondition[]; // 解放条件
}

interface ClearCondition {
  type: 'reach-floor' | 'defeat-boss' | 'collect-item' | 'custom';
  targetFloor?: number;            // 到達目標階層
  targetBoss?: string;             // 撃破対象ボス
  targetItem?: string;             // 収集対象アイテム
  customCondition?: string;        // カスタム条件
}
```

### Death System Component
```typescript
interface DeathSystemComponent extends Component {
  type: 'death-system';
  config: {
    deathPenalties: DeathPenalty[];  // 死亡時のペナルティ
    gameOverBehavior: GameOverConfig; // ゲームオーバー時の動作
    saveSystem: SaveSystemConfig;    // セーブシステム設定
  };
}

interface DeathPenalty {
  type: 'item-loss' | 'level-reset' | 'stat-reset' | 'custom';
  severity: 'all' | 'partial' | 'none'; // ペナルティの程度
  description: string;             // ペナルティの説明
}

interface GameOverConfig {
  allowRevive: boolean;            // 復活可能（false）
  allowContinue: boolean;          // コンティニュー可能（false）
  resetToTown: boolean;            // 街に戻る（true）
  showDeathMessage: boolean;       // 死亡メッセージ表示（true）
}

interface SaveSystemConfig {
  allowSave: boolean;              // セーブ機能（false）
  allowLoad: boolean;              // ロード機能（false）
  suspendOnly: boolean;            // 中断のみ（false）
  permadeath: boolean;             // 永続的な死（true）
}
```

### Item Identification System Component
```typescript
interface ItemIdentificationComponent extends Component {
  type: 'item-identification';
  config: {
    unidentifiedItemTypes: string[]; // 未鑑定対象アイテム種類
    identificationMethods: IdentificationMethod[]; // 鑑定方法
    dungeonSpecificRules: DungeonIdentificationRule[]; // ダンジョン別ルール
  };
}

interface IdentificationMethod {
  method: 'use-item' | 'identification-scroll' | 'shop-appraisal' | 'level-up';
  cost?: number;                   // 鑑定コスト（店での鑑定など）
  successRate?: number;            // 成功率（100%でない場合）
  description: string;             // 鑑定方法の説明
}

interface DungeonIdentificationRule {
  dungeonId: string;               // ダンジョンID
  unidentifiedTypes: string[];     // このダンジョンで未鑑定になるアイテム種類
  identificationDifficulty: number; // 鑑定難易度
}
```

### Item System Component
```typescript
interface ItemSystemComponent extends Component {
  type: 'item-system';
  config: {
    itemCategories: ItemCategory[];  // アイテムカテゴリ
    dropSystem: DropSystemConfig;    // ドロップシステム
    floorItemSystem: FloorItemConfig; // フロアアイテムシステム
  };
}

interface ItemCategory {
  category: 'weapon' | 'armor' | 'accessory' | 'hp-recovery' | 'hunger-recovery' | 'misc';
  subcategories: ItemSubcategory[]; // サブカテゴリ
  identificationRequired: boolean;  // 鑑定が必要かどうか
}

interface ItemSubcategory {
  id: string;                      // サブカテゴリID
  name: string;                    // サブカテゴリ名
  items: ItemDefinition[];         // このカテゴリのアイテム一覧
}

interface ItemDefinition {
  id: string;                      // アイテムID
  name: string;                    // アイテム名
  description: string;             // アイテム説明
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  baseStats?: EquipmentStats;      // 基本能力値
  effects?: ItemEffect[];          // アイテム効果
  durability?: number;             // 耐久度
  stackable: boolean;              // スタック可能かどうか
}

interface DropSystemConfig {
  enemyDropRates: EnemyDropConfig[]; // 敵ドロップ設定
  floorItemSpawnRates: FloorItemSpawnConfig[]; // フロアアイテム出現設定
  dropCalculation: DropCalculationConfig; // ドロップ計算設定
}

interface EnemyDropConfig {
  enemyId: string;                 // 敵ID
  dropChance: number;              // ドロップ確率（0-1）
  dropTable: DropTableEntry[];     // ドロップテーブル
  maxDrops: number;                // 最大ドロップ数
}

interface DropTableEntry {
  itemId: string;                  // アイテムID
  weight: number;                  // 重み（確率計算用）
  quantity: { min: number; max: number }; // ドロップ数量
  conditions?: DropCondition[];    // ドロップ条件
}

interface FloorItemSpawnConfig {
  dungeonId?: string;              // 特定ダンジョン（未指定なら全ダンジョン）
  floorRange?: { min: number; max: number }; // 階層範囲
  itemsPerFloor: { min: number; max: number }; // フロアあたりのアイテム数
  spawnTable: DropTableEntry[];    // 出現アイテムテーブル
}
```

### UI and Input System Component
```typescript
interface UISystemComponent extends Component {
  type: 'ui-system';
  config: {
    inputMethod: InputMethodConfig;  // 入力方法設定
    displayLayout: DisplayLayoutConfig; // 画面レイアウト設定
    keyBindings: KeyBindingConfig;   // キーバインド設定
  };
}

interface InputMethodConfig {
  supportedInputs: 'keyboard-only'; // キーボードのみ
  primaryNavigation: 'arrow-keys';  // 矢印キーで移動
  confirmKey: 'z';                 // Z：攻撃・決定
  cancelKey: 'x';                  // X：キャンセル
  inventoryKey: 'a';               // A：インベントリ
}

interface KeyBindingConfig {
  movement: {
    up: 'ArrowUp';                 // 上移動
    down: 'ArrowDown';             // 下移動
    left: 'ArrowLeft';             // 左移動
    right: 'ArrowRight';           // 右移動
  };
  actions: {
    confirm: 'KeyZ';               // Z：攻撃・決定
    cancel: 'KeyX';                // X：キャンセル
    inventory: 'KeyA';             // A：インベントリ
  };
  customizable: boolean;           // キーカスタマイズ可能かどうか
}

interface DisplayLayoutConfig {
  gameArea: DisplayArea;           // ゲーム画面エリア
  statusArea: DisplayArea;         // ステータス表示エリア
  messageArea: DisplayArea;        // メッセージ表示エリア
  inventoryArea?: DisplayArea;     // インベントリ表示エリア
}

interface DisplayArea {
  position: { x: number; y: number }; // 表示位置
  size: { width: number; height: number }; // 表示サイズ
  visible: boolean;                // 表示/非表示
  resizable: boolean;              // リサイズ可能かどうか
}
```

### Level Up System Component
```typescript
interface LevelUpComponent extends Component {
  type: 'level-up';
  config: {
    experienceTable: number[];     // レベル1-100の必要経験値テーブル
    maxLevel: number;              // 最大レベル（100）
    statGrowthRates: StatGrowthConfig;
    additionalStats?: string[];    // 将来追加される可能性のあるステータス
  };
}
```

### Turn System Component
```typescript
interface TurnSystemComponent extends Component {
  type: 'turn-system';
  config: {
    turnOrder: TurnPhase[];        // ターンフェーズの順序
    speedSystem: SpeedSystemConfig; // 速度システム設定
    endTurnProcessing: EndTurnProcess[]; // ターン終了処理順序
  };
}

interface TurnPhase {
  phase: 'player-action' | 'player-recovery' | 'ally-move' | 'enemy-move' | 
         'player-trap' | 'enemy-trap' | 'ally-attack' | 'enemy-attack';
  description: string;             // フェーズの説明
  conditions?: string[];           // 実行条件
}

interface SpeedSystemConfig {
  normal: { actionsPerTurn: number }; // 通常速度（1回行動）
  fast: { 
    actionsPerTurn: number;        // 倍速（2回行動）
    adjacentRule: boolean;         // 隣接時の制限（true）
  };
  slow: { 
    turnsPerAction: number;        // 鈍足（2ターンに1回）
  };
}

interface EndTurnProcess {
  process: 'status-recovery' | 'slip-damage' | 'hunger-decrease';
  order: number;                   // 処理順序
  description: string;             // 処理の説明
}
```

### Attribute System Component
```typescript
interface AttributeComponent extends Component {
  type: 'attribute';
  config: {
    attributeTypes: AttributeType[]; // 利用可能な属性タイプ
    compatibilityMatrix: AttributeCompatibility; // 属性相性テーブル
    damageModifiers: AttributeDamageModifier[]; // ダメージ修正値
  };
}

interface AttributeType {
  id: string;                      // 属性ID（fire, water, earth, air など）
  name: string;                    // 属性名
  description: string;             // 属性の説明
  color: string;                   // 表示色
}

interface AttributeCompatibility {
  [attackerAttribute: string]: {   // 攻撃側属性
    [defenderAttribute: string]: number; // 防御側属性 -> ダメージ倍率
  };
}

interface AttributeDamageModifier {
  attackerAttribute: string;       // 攻撃側属性
  defenderAttribute: string;       // 防御側属性
  multiplier: number;              // ダメージ倍率（1.0=等倍、1.5=1.5倍、0.5=半減）
  description: string;             // 相性の説明
}

interface StatGrowthConfig {
  hp: {
    multiplier: number;            // HP成長倍率（1.1）
    baseValue: number;             // レベル1時の初期値
  };
  attack: {
    multiplier: number;            // 攻撃力成長倍率（1.2）
    baseValue: number;             // レベル1時の初期値
  };
  defense: {
    multiplier: number;            // 防御力成長倍率（1.2）
    baseValue: number;             // レベル1時の初期値
  };
  [key: string]: {                 // 将来追加されるステータス用
    multiplier: number;            // 成長倍率
    baseValue: number;             // 初期値
  };
}

// 経験値システム：
// 全キャラクター（プレイヤー、仲間、敵）が経験値とレベルを持つ
// キャラクター撃破時：撃破者が被撃破者のexperienceValueを獲得
// レベルアップアイテム使用時：使用者がitem.experienceValueを獲得
// 敵同士の戦闘でも経験値獲得が発生する
```

## Data Models

### Core Game Entities

```typescript
interface GameEntity {
  id: string;                      // エンティティの一意識別子
  position: Position;              // ダンジョン内の位置座標
  components: Component[];         // 動作を決定するコンポーネント群
  stats: EntityStats;              // 基本ステータス
  flags: EntityFlags;              // 状態フラグ
}

### Player Model Design

```typescript
interface Player {
  // 基本識別情報
  id: string;                      // プレイヤーの一意識別子
  name: string;                    // プレイヤー名
  
  // 位置情報
  position: Position;              // ダンジョン内の現在位置
  
  // レベル・経験値システム
  level: number;                    // 1-100の整数
  experience: number;               // 現在の経験値
  experienceValue: number;          // 撃破時に与える経験値（プレイヤーも撃破される可能性）
  
  // 基本ステータス（全て設定ファイルから計算）
  stats: {
    hp: number;                     // 現在HP
    maxHp: number;                  // 最大HP（レベルアップ時に1.1倍）
    attack: number;                 // 攻撃力（レベルアップ時に1.2倍）
    defense: number;                // 防御力（レベルアップ時に1.2倍）
    evasionRate: number;            // 回避率（基本5%、アイテム・装備で変動）
    [key: string]: number;          // 将来追加されるステータス用
  };
  
  // 属性システム
  attributes: {
    primary: string;                // 主属性（fire, water, earth, air など）
    secondary?: string;             // 副属性（オプション）
    resistances: AttributeResistance[]; // 属性耐性
    weaknesses: AttributeWeakness[]; // 属性弱点
  };
  
  // 満腹度システム
  hunger: number;                   // 現在の満腹度
  maxHunger: number;                // 最大満腹度
  
  // インベントリ・装備システム
  inventory: Item[];                // 所持アイテム
  equipment: {
    weapon?: Item;                  // 装備武器（近接または遠隔）
    armor?: Item;                   // 装備防具
    accessory?: Item;               // 装備アクセサリー（1つのみ）
  };
  
  // 状態管理
  statusEffects: StatusEffect[];    // 毒、麻痺などの状態異常
  flags: {
    [key: string]: any;             // ゲーム状態フラグ（将来の拡張用）
  };
  
  // コンポーネントシステム
  components: Component[];          // 動作を決定するコンポーネント群
  
  // 設定参照
  config: PlayerConfig;             // 設定ファイルからの設定値
}

interface PlayerConfig {
  // 初期ステータス
  initialStats: {
    hp: number;                    // 初期HP値
    attack: number;                // 初期攻撃力
    defense: number;               // 初期防御力
    [key: string]: number;         // 将来追加されるステータス用
  };
  
  // レベルアップ設定
  levelUp: {
    experienceTable: number[];      // レベル1-100の必要経験値テーブル
    statGrowthRates: {
      hp: number;                   // 1.1
      attack: number;               // 1.2
      defense: number;              // 1.2
      [key: string]: number;        // 将来追加ステータス用
    };
    maxLevel: number;               // 100
  };
  
  // 満腹度設定
  hunger: {
    maxValue: number;               // 最大満腹度
    decreaseRate: number;           // ターンごとの減少率
    minValue: number;               // 最小値（通常0）
    damageAmount: number;           // 空腹時のダメージ量
    recoveryAmount: number;         // 食料での回復量
    maxOverfeedTime: number;        // 満腹時の持続時間
  };
  
  // 移動設定
  movement: {
    distance: number;               // 1ターンの移動距離
    directions: Direction[];        // 移動可能方向
    restrictions: string[];         // 移動制限ルール
  };
  
  // 攻撃設定（コンポーネントで差し替え可能）
  attack: {
    range: AttackRangeConfig;       // 攻撃範囲
    count: AttackCountConfig;       // 攻撃回数
    target: AttackTargetConfig;     // 攻撃対象
  };
  
  // インベントリ設定
  inventory: {
    maxSize: number;                // 最大所持数
    autoPickup: boolean;            // 自動拾得
    sortRules: string[];            // ソートルール
  };
}
```

### Companion Model Design

```typescript
interface Companion {
  // 基本識別情報
  id: string;
  name: string;
  companionType: string;            // 仲間の種類（戦士、魔法使いなど）
  
  // 位置情報
  position: Position;
  
  // レベル・経験値システム（プレイヤーと同じ）
  level: number;                    // 1-100の整数
  experience: number;               // 現在の経験値
  experienceValue: number;          // 撃破時に与える経験値
  
  // 基本ステータス（設定ファイルから計算）
  stats: {
    hp: number;                     // 現在HP
    maxHp: number;                  // 最大HP（レベルアップ時に1.1倍）
    attack: number;                 // 攻撃力（レベルアップ時に1.2倍）
    defense: number;                // 防御力（レベルアップ時に1.2倍）
    evasionRate: number;            // 回避率（基本5%、特殊キャラで変動）
    [key: string]: number;          // 将来追加されるステータス用
  };
  
  // 属性システム
  attributes: {
    primary: string;                // 主属性（fire, water, earth, air など）
    secondary?: string;             // 副属性（オプション）
    resistances: AttributeResistance[]; // 属性耐性
    weaknesses: AttributeWeakness[]; // 属性弱点
  };
  
  // AI・行動システム
  aiType: string;                   // AI行動パターン
  behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
  
  // 装備システム
  equipment: {
    weapon?: Item;                  // 装備武器（近接または遠隔）
    armor?: Item;                   // 装備防具
    accessory?: Item;               // 装備アクセサリー（1つのみ）
  };
  
  // 状態管理
  statusEffects: StatusEffect[];    // 毒、麻痺などの状態異常
  flags: {
    [key: string]: any;             // ゲーム状態フラグ
  };
  
  // コンポーネントシステム
  components: Component[];          // 動作を決定するコンポーネント群
  
  // 設定参照
  config: CompanionConfig;          // 設定ファイルからの設定値
}

interface CompanionConfig {
  // 初期ステータス
  initialStats: {
    hp: number;
    attack: number;
    defense: number;
    [key: string]: number;
  };
  
  // レベルアップ設定（プレイヤーと同じ）
  levelUp: {
    experienceTable: number[];      // レベル1-100の必要経験値テーブル
    statGrowthRates: {
      hp: number;                   // 1.1
      attack: number;               // 1.2
      defense: number;              // 1.2
      [key: string]: number;
    };
    maxLevel: number;               // 100
  };
  
  // AI設定
  ai: {
    behaviorPatterns: AIBehaviorPattern[];
    reactionRules: AIReactionRule[];
    commandResponses: AICommandResponse[];
  };
  
  // 攻撃設定（コンポーネントで差し替え可能）
  attack: {
    range: AttackRangeConfig;
    count: AttackCountConfig;
    target: AttackTargetConfig;
  };
  
  // 移動設定
  movement: {
    distance: number;
    directions: Direction[];
    restrictions: string[];
  };
}
```

### Monster Model Design

```typescript
interface Monster {
  // 基本識別情報
  id: string;
  name: string;
  monsterType: string;              // モンスターの種類
  
  // 位置情報
  position: Position;
  
  // レベル・経験値システム（全キャラクター共通）
  level: number;                    // 1-100の整数
  experience: number;               // 現在の経験値
  experienceValue: number;          // 撃破時に与える経験値
  
  // 基本ステータス（設定ファイルから計算）
  stats: {
    hp: number;                     // 現在HP
    maxHp: number;                  // 最大HP（レベルアップ時に1.1倍）
    attack: number;                 // 攻撃力（レベルアップ時に1.2倍）
    defense: number;                // 防御力（レベルアップ時に1.2倍）
    evasionRate: number;            // 回避率（基本5%、特殊モンスターで変動）
    [key: string]: number;          // 将来追加されるステータス用
  };
  
  // 属性システム
  attributes: {
    primary: string;                // 主属性（fire, water, earth, air など）
    secondary?: string;             // 副属性（オプション）
    resistances: AttributeResistance[]; // 属性耐性
    weaknesses: AttributeWeakness[]; // 属性弱点
  };
  
  // AI・行動システム
  aiType: string;                   // AI行動パターン（敵対範囲も含む）
  
  // ドロップシステム
  dropTable: DropTableEntry[];      // ドロップアイテムテーブル
  
  // スポーンシステム
  spawnWeight: number;              // 出現確率の重み
  spawnConditions: SpawnCondition[]; // 出現条件
  
  // 状態管理
  statusEffects: StatusEffect[];    // 毒、麻痺などの状態異常
  flags: {
    [key: string]: any;             // ゲーム状態フラグ
  };
  
  // コンポーネントシステム
  components: Component[];          // 動作を決定するコンポーネント群
  
  // 設定参照
  config: MonsterConfig;            // 設定ファイルからの設定値
}

interface MonsterConfig {
  // 初期ステータス
  initialStats: {
    hp: number;
    attack: number;
    defense: number;
    [key: string]: number;
  };
  
  // レベルアップ設定（全キャラクター共通）
  levelUp: {
    experienceTable: number[];      // レベル1-100の必要経験値テーブル
    statGrowthRates: {
      hp: number;                   // 1.1
      attack: number;               // 1.2
      defense: number;              // 1.2
      [key: string]: number;
    };
    maxLevel: number;               // 100
  };
  
  // AI設定
  ai: {
    behaviorType: string;           // 基本行動パターン（敵対範囲、追跡距離なども含む）
    specialAbilities: SpecialAbility[];
    parameters: {                   // AI行動パラメータ
      aggroRange?: number;          // 敵対範囲
      chaseDistance?: number;       // 追跡距離
      patrolRadius?: number;        // 巡回範囲
      [key: string]: any;           // その他のAI設定値
    };
  };
  
  // 攻撃設定（コンポーネントで差し替え可能）
  attack: {
    range: AttackRangeConfig;
    count: AttackCountConfig;
    target: AttackTargetConfig;
  };
  
  // 移動設定
  movement: {
    distance: number;
    directions: Direction[];
    restrictions: string[];
  };
  
  // ドロップ設定
  drops: {
    dropTable: DropTableEntry[];
    dropChance: number;
    maxDrops: number;
  };
  
  // スポーン設定
  spawn: {
    weight: number;
    conditions: SpawnCondition[];
    floorRange: { min: number; max: number };
  };
}
```

interface Item extends GameEntity {
  itemType: ItemType;              // アイテムの種類
  identified: boolean;             // 鑑定済みフラグ
  cursed: boolean;                 // 呪い状態フラグ
  durability?: number;             // 耐久度（武器・防具用）
  effects: ItemEffect[];           // アイテム効果
  attributes?: {                   // 武器・防具の属性（オプション）
    attackAttribute?: string;      // 攻撃属性（武器用）
    defenseAttributes?: string[];  // 防御属性（防具用）
  };
  equipmentStats?: EquipmentStats; // 装備時の能力値補正（武器・防具・アクセサリー）
}

interface EquipmentStats {
  attackBonus?: number;            // 攻撃力ボーナス
  defenseBonus?: number;           // 防御力ボーナス
  [key: string]: number | undefined; // 将来の拡張用
}

// アクセサリー効果（詳細は後で設計）
// - 攻撃・防御の増減
// - 属性の変更
// - 攻撃に特定属性を付与
// - 防御時に特定属性に耐性
// - 状態異常を無効化

type ItemType = 'weapon-melee' | 'weapon-ranged' | 'armor' | 'accessory' | 'consumable' | 'misc';

// 属性システム関連の型定義
interface AttributeResistance {
  attribute: string;               // 耐性を持つ属性
  resistance: number;              // 耐性値（0.0-1.0、0.5=半減、0.0=無効）
  description: string;             // 耐性の説明
}

interface AttributeWeakness {
  attribute: string;               // 弱点属性
  weakness: number;                // 弱点倍率（1.5=1.5倍ダメージ、2.0=2倍ダメージ）
  description: string;             // 弱点の説明
}

// 状態異常システム関連の型定義
interface StatusEffectConfig {
  id: string;                      // 状態異常ID
  name: string;                    // 状態異常名
  description: string;             // 効果説明
  effect: StatusEffectType;        // 効果タイプ
  recoverySystem: RecoverySystemConfig; // 回復システム設定
}

interface RecoverySystemConfig {
  type: 'turn-based-probability';  // 回復タイプ（ターン経過確率型）
  baseChance: number;              // 基本回復確率（例：0.1 = 10%）
  chanceIncrease: number;          // ターンごとの確率上昇（例：0.05 = 5%）
  maxChance: number;               // 最大回復確率（例：0.8 = 80%）
  formula: string;                 // 回復確率計算式: "min(baseChance + (turnsElapsed * chanceIncrease), maxChance)"
}

type StatusEffectType = 'poison' | 'confusion' | 'paralysis' | 'bind';

interface StatusEffect {
  type: StatusEffectType;          // 状態異常の種類
  turnsElapsed: number;            // 経過ターン数（回復確率計算に使用）
  intensity?: number;              // 効果の強度（毒のダメージ量など）
  source?: string;                 // 付与元（アイテム、スキルなど）
}

// 状態異常の効果詳細：
// - poison: スリップダメージ（ターン終了処理で発生）
// - confusion: 移動・攻撃がランダム方向（味方同士・敵同士にも命中）
// - paralysis: 行動不能（移動・攻撃・アイテム使用すべて不可）
// - bind: 移動のみ不能（攻撃・アイテム使用は可能）

// 状態異常回復システム：
// 1. 各ターン終了時に回復判定を実行
// 2. 回復確率 = min(baseChance + (turnsElapsed * chanceIncrease), maxChance)
// 3. 例：基本10%、ターンごと+5%、最大80%の場合
//    - 1ターン目：10%、2ターン目：15%、3ターン目：20%...14ターン目以降：80%
// 4. 状態異常は重複可能（同じ種類でも複数付与される）
// 5. 各状態異常は個別に回復判定される
```

### Configuration Data Models

```typescript
interface GameConfig {
  player: PlayerConfig;            // プレイヤー設定
  combat: CombatConfig;            // 戦闘設定
  dungeon: DungeonConfig;          // ダンジョン設定
  items: ItemConfig;               // アイテム設定
  monsters: MonsterConfig;         // モンスター設定
  attributes: AttributeConfig;     // 属性システム設定
}

interface PlayerConfig {
  initialStats: Stats;
  levelUpConfig: LevelUpConfig;
  hungerConfig: HungerConfig;
  movementConfig: MovementConfig;
}

interface LevelUpConfig {
  experienceTable: number[];       // レベル1-100の必要経験値テーブル
  statGrowthRates: StatGrowthConfig;
  maxLevel: 100;
}

interface CombatConfig {
  // 基本ダメージ計算
  baseDamageFormula: string;       // 基本ダメージ計算式: "{attack * 1.3 * (35/36)^defense} * random(7/8, 9/8)"
  minDamage: number;               // 最小保証ダメージ（1）
  randomRange: {                   // ダメージ乱数範囲
    min: number;                   // 最小倍率（7/8 = 0.875）
    max: number;                   // 最大倍率（9/8 = 1.125）
  };
  defenseReductionBase: number;    // 防御力減衰ベース（35/36 ≈ 0.9722）
  attackMultiplier: number;        // 攻撃力倍率（1.3）
  
  // クリティカルヒット
  criticalChance: number;          // クリティカル発生確率（0.05 = 5%）
  criticalEffect: 'defense-ignore'; // クリティカル効果（防御力無視）
  criticalFormula: string;         // クリティカル時の計算式: "{attack * 1.3} * random(7/8, 9/8)" (防御力無視)
  
  // 回避システム
  evasionEnabled: boolean;         // 回避システム有効/無効
  baseEvasionRate: number;         // 基本回避率（0.05 = 5%）
  evasionEffect: 'damage-zero';    // 回避成功時の効果（被ダメージ0）
  evasionTiming: 'pre-damage';     // 回避判定タイミング（ダメージ計算前）
  unavoidableAttackFlag: boolean;  // 回避不能攻撃フラグ対応
  
  // 状態異常システム
  statusEffects: {
    poison: StatusEffectConfig;    // 毒（スリップダメージ）
    confusion: StatusEffectConfig; // 混乱（ランダム行動）
    paralysis: StatusEffectConfig; // 麻痺（移動・攻撃不能）
    bind: StatusEffectConfig;      // 拘束（移動のみ不能）
  };

  
  // 属性システム
  attributeDamageEnabled: boolean; // 属性ダメージ有効/無効
}

interface AttributeConfig {
  availableAttributes: AttributeType[]; // 利用可能な属性一覧
  compatibilityMatrix: AttributeCompatibility; // 属性相性テーブル
  damageMultipliers: {             // ダメージ倍率設定
    disadvantage: number;          // 不利属性倍率（0.8）
    neutral: number;               // 等倍（1.0）
    advantage: number;             // 有利属性倍率（1.2）
  };
  applicationTiming: 'final';      // 適用タイミング（最終ダメージに掛け算）
}
```

### Spawn Tables and Probability Systems

```typescript
interface SpawnTable {
  floorRange: { min: number; max: number };
  entries: SpawnEntry[];
  specialRules?: SpecialSpawnRule[];
}

interface SpawnEntry {
  entityId: string;
  weight: number;
  conditions?: SpawnCondition[];
}

interface TrapConfig {
  trapTypes: TrapType[];
  spawnRate: number;
  visibilityChance: number;
  effects: TrapEffect[];
}
```

## Error Handling

### Configuration Validation
- 起動時に全設定ファイルの整合性チェック
- 不正な設定値の検出と警告
- デフォルト値へのフォールバック機能

### Runtime Error Recovery
- コンポーネント実行エラーの捕捉
- ゲーム状態の整合性保持
- エラーログの詳細記録

### Save Data Integrity
- セーブデータの破損検出
- バックアップからの復旧機能
- バージョン間の互換性管理


## Turn System Design

### Basic Turn Order
1. **Player Action**: Choose ONE of {Move, Attack, Item Use}
2. **Player Auto Recovery**
3. **Ally Movement** (Skip if adjacent to enemy, spawn order)
4. **Enemy Movement** (Skip if adjacent to player/ally, spawn order)
5. **Player Trap** (If moved onto trap)
6. **Enemy Trap**
7. **Ally Attack** (Skip if moved, spawn order)
8. **Enemy Attack** (Skip if moved, spawn order)
9. **End Turn Processing**:
   - Status Recovery Check → Slip Damage → Hunger Decrease

### Speed System
- **Fast**: 2 actions per turn, but skip 2nd move/attack if adjacent after 1st move
- **Normal**: 1 action per turn
- **Slow**: 1 action per 2 turns

### Action System
- **Action Definition**: {Move, Attack, Item Use} - ONE per turn only
- **Skip Turn**: Attack empty space to skip
- **Confusion Effect**: Random direction for move/attack (friendly fire possible)
- **Paralysis Effect**: Cannot perform any actions
- **Bind Effect**: Cannot move (attack/item use still possible)