/**
 * Entity models for the mystery dungeon game
 * Implements basic game entities with stats, level, and experience systems
 */
import { GameEntity, EntityStats } from './core';
export { GameEntity } from './core';
export interface CharacterStats extends EntityStats {
    level: number;
    experience: number;
    experienceValue: number;
}
export interface StatusEffect {
    type: 'poison' | 'confusion' | 'paralysis' | 'bind';
    turnsElapsed: number;
    intensity?: number;
    source?: string;
}
export interface CharacterAttributes {
    primary: string;
    secondary?: string;
    resistances: AttributeResistance[];
    weaknesses: AttributeWeakness[];
}
export interface AttributeResistance {
    attribute: string;
    resistance: number;
    description: string;
}
export interface AttributeWeakness {
    attribute: string;
    weakness: number;
    description: string;
}
export interface EquipmentStats {
    attackBonus?: number;
    defenseBonus?: number;
    [key: string]: number | undefined;
}
export interface ItemEffect {
    type: string;
    value: number;
    description: string;
}
export interface Player extends GameEntity {
    name: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    hunger: number;
    maxHunger: number;
    inventory: Item[];
    equipment: {
        weapon?: Item;
        armor?: Item;
        accessory?: Item;
    };
    statusEffects: StatusEffect[];
}
export interface Monster extends GameEntity {
    name: string;
    monsterType: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    aiType: string;
    dropTable: DropTableEntry[];
    spawnWeight: number;
    spawnConditions: SpawnCondition[];
    statusEffects: StatusEffect[];
}
export interface Companion extends GameEntity {
    name: string;
    companionType: string;
    stats: CharacterStats;
    attributes: CharacterAttributes;
    aiType: string;
    behaviorMode: 'follow' | 'attack' | 'defend' | 'explore' | 'wait';
    equipment: {
        weapon?: Item;
        armor?: Item;
        accessory?: Item;
    };
    statusEffects: StatusEffect[];
}
export interface Item extends GameEntity {
    name: string;
    itemType: ItemType;
    identified: boolean;
    cursed: boolean;
    durability?: number;
    effects: ItemEffect[];
    attributes?: {
        attackAttribute?: string;
        defenseAttributes?: string[];
    };
    equipmentStats?: EquipmentStats;
}
export type ItemType = 'weapon-melee' | 'weapon-ranged' | 'armor' | 'accessory' | 'consumable' | 'misc';
export interface DropTableEntry {
    itemId: string;
    weight: number;
    quantity: {
        min: number;
        max: number;
    };
    conditions?: DropCondition[];
}
export interface DropCondition {
    type: string;
    value: any;
}
export interface SpawnCondition {
    type: string;
    value: any;
}
//# sourceMappingURL=entities.d.ts.map