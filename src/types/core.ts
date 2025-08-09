/**
 * Core types for the mystery dungeon game
 */

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
  components: Component[];
  stats: EntityStats;
  flags: EntityFlags;
}

export interface EntityStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  evasionRate: number;
  [key: string]: number | undefined;
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
}

export interface PlayerConfig {
  initialStats: EntityStats;
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
  [key: string]: any; // Will be expanded in later tasks
}

export interface ItemConfig {
  [key: string]: any; // Will be expanded in later tasks
}

export interface MonsterConfig {
  [key: string]: any; // Will be expanded in later tasks
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