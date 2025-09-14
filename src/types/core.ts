/**
 * Core types for the mystery dungeon game
 */

import type { DungeonTemplate } from './dungeon.js';

export interface Position {
  x: number;
  y: number;
}

export interface GameContext {
  currentTurn: number;
  gameState: GameState;
  config: GameConfig;
}

export interface GameState {
  player?: any; // Will be defined in later tasks
  dungeon?: any; // Will be defined in later tasks
  entities: GameEntity[];
}

export interface GameEntity {
  id: string;
  position: Position;
  direction?: 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest'; // 8方向（オプショナル）
  components: Component[];
  flags: EntityFlags;
  speedState?: 'normal' | 'fast' | 'slow';
  customRules?: {
    action1?: Partial<import('./movement.js').ActionConfig>;
    action2?: Partial<import('./movement.js').ActionConfig>;
  };
}

export interface EntityFlags {
  [key: string]: any;
}

export interface ComponentResult {
  success: boolean;
  message?: string;
  data?: any;
}

export interface Component {
  id: string;
  type: ComponentType;
  config: ComponentConfig;
  execute(context: GameContext): ComponentResult;
}

export interface ComponentConfig {
  [key: string]: any;
}

export type ComponentType = 
  | 'movement'
  | 'attack-range'
  | 'attack-count'
  | 'attack-target'
  | 'hunger'
  | 'dungeon-generator'
  | 'dungeon-system'
  | 'death-system'
  | 'item-identification'
  | 'item-system'
  | 'ui-system'
  | 'level-up'
  | 'turn-system'
  | 'attribute';

export interface GameConfig {
  player: PlayerConfig;
  combat: CombatConfig;
  dungeon: DungeonConfig;
  items: ItemConfig;
  monsters: MonsterConfig;
  attributes: AttributeConfig;
  turnSystem: any; // Will be properly typed when TurnSystemConfig is imported
  ui: UIConfig;
  input: InputConfig;
  messages: MessageConfig;
}

export interface InputConfig {
  keys: {
    movement: {
      up: string[];
      down: string[];
      left: string[];
      right: string[];
    };
    actions: {
      confirm: string[];
      cancel: string[];
      inventory: string[];
    };
  };
}

export interface MessageConfig {
  ui: {
    inventoryOpen: string;
    inventoryClose: string;
    cancel: string;
    attackMiss: string;
    stairsConfirmDown: string;
    stairsConfirmUp: string;
    stairsAdvanceDown: string;
    stairsAdvanceUp: string;
    stairsDecline: string;
    itemUseUnimplemented: string;
  };
}

export interface PlayerConfig {
  levelUpConfig: LevelUpConfig;
  hungerConfig: HungerConfig;
  movementConfig: MovementConfig;
}

export interface LevelUpConfig {
  experienceTable: number[];
  statGrowthRates: StatGrowthConfig;
  maxLevel: number;
}

export interface StatGrowthConfig {
  hp: number;
  attack: number;
  defense: number;
  [key: string]: number;
}

export interface HungerConfig {
  maxValue: number;
  decreaseRate: number;
  minValue: number;
  damageAmount: number;
  recoveryAmount: number;
  maxOverfeedTime: number;
}

export interface MovementConfig {
  distance: number;
  directions: Direction[];
  restrictions: string[];
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CombatConfig {
  baseDamageFormula: string;
  minDamage: number;
  randomRange: {
    min: number;
    max: number;
  };
  defenseReductionBase: number;
  attackMultiplier: number;
  criticalChance: number;
  criticalEffect: string;
  criticalFormula: string;
  evasionEnabled: boolean;
  baseEvasionRate: number;
  evasionEffect: string;
  evasionTiming: string;
  unavoidableAttackFlag: boolean;
  statusEffects: {
    [key: string]: StatusEffectConfig;
  };
  attributeDamageEnabled: boolean;
}

export interface StatusEffectConfig {
  id: string;
  name: string;
  description: string;
  effect: StatusEffectType;
  recoverySystem: RecoverySystemConfig;
}

export interface RecoverySystemConfig {
  type: string;
  baseChance: number;
  chanceIncrease: number;
  maxChance: number;
  formula: string;
}

export type StatusEffectType = 'poison' | 'confusion' | 'paralysis' | 'bind';

export interface DungeonConfig {
  coordinateConstraints?: {
    roomCenterEven?: boolean;
    corridorOddOnly?: boolean;
  };
  defaultTileset: DungeonTilesetConfig;
  dungeonSpecificTilesets: {
    [dungeonId: string]: DungeonTilesetConfig;
  };
  templates?: {
    [templateId: string]: DungeonTemplate;
  };
}

export interface DungeonTilesetConfig {
  imagePath: string;
  tileSize: number;
  tiles: {
    floor: TileConfig;
    wall: TileConfig;
    'stairs-down': TileConfig;
    'stairs-up': TileConfig;
  };
  overlay: {
    wall: TileConfig;
  };
}

export interface TileConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ItemConfig {
  [key: string]: any; // Will be expanded in later tasks
}

export interface MonsterConfig {
  [key: string]: any; // Will be expanded in later tasks
}

export interface UIConfig {
  fonts: FontConfig;
  viewport: ViewportConfig;
  minimap: MinimapConfig;
  layout: LayoutConfig;
  messages: {
    maxLines: number;
  };
}

export interface ViewportConfig {
  tilesX: number;
  tilesY: number;
  tileSize: number;
}

export interface MinimapConfig {
  width: number;
  height: number;
  playerSize?: number; // プレイヤーの表示サイズ（mmTileに対する比率）
  playerColor?: string; // プレイヤーの色
  colors?: {
    'stairs-down'?: string;
    'stairs-up'?: string;
  };
}

export interface LayoutConfig {
  maxWidth: number;
  gridTemplateColumns: string;
  gridTemplateRows: string;
}



export interface FontConfig {
  primary: string;
  secondary: string;
  fallback: string;
}

export interface AttributeConfig {
  availableAttributes: AttributeType[];
  compatibilityMatrix: AttributeCompatibility;
  damageMultipliers: {
    disadvantage: number;
    neutral: number;
    advantage: number;
  };
  applicationTiming: string;
}

export interface AttributeType {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface AttributeCompatibility {
  [attackerAttribute: string]: {
    [defenderAttribute: string]: number;
  };
}