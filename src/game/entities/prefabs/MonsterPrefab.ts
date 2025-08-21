/**
 * Monster Entity Prefab - ECS-based monster creation
 * Creates monster entities using pure ECS components
 */

import { World } from '../../../ecs/core/World.js';
import { Entity } from '../../../ecs/core/Entity.js';
import { PositionComponentFactory } from '../../../ecs/components/common/Position.js';
import { HealthComponentFactory } from '../../../ecs/components/common/Health.js';
import { AttackComponentFactory } from '../../../ecs/components/combat/Attack.js';
import { DefenseComponentFactory } from '../../../ecs/components/combat/Defense.js';
import { InventoryComponentFactory } from '../../../ecs/components/common/Inventory.js';

/**
 * Monster type definitions
 */
export type MonsterType = 'goblin' | 'orc' | 'skeleton' | 'dragon' | 'slime';
export type AIType = 'passive' | 'basic-hostile' | 'aggressive' | 'territorial' | 'boss';

/**
 * Monster creation parameters
 */
export interface MonsterParams {
  name: string;
  monsterType: MonsterType;
  position: { x: number; y: number };
  level?: number;
  aiType?: AIType;
  health?: number;
  attack?: number;
  defense?: number;
  experienceValue?: number;
}

/**
 * Monster template for consistent creation
 */
export interface MonsterTemplate {
  name: string;
  monsterType: MonsterType;
  baseHealth: number;
  baseAttack: number;
  baseDefense: number;
  aiType: AIType;
  experienceValue: number;
  spawnWeight: number;
  criticalChance: number;
  evasionRate: number;
}

/**
 * Monster prefab factory
 */
export class MonsterPrefab {
  private static templates: Map<MonsterType, MonsterTemplate> = new Map();

  /**
   * Initialize monster templates
   */
  static initialize(): void {
    // Goblin
    this.templates.set('goblin', {
      name: 'Goblin',
      monsterType: 'goblin',
      baseHealth: 12,
      baseAttack: 6,
      baseDefense: 3,
      aiType: 'basic-hostile',
      experienceValue: 10,
      spawnWeight: 1.0,
      criticalChance: 0.03,
      evasionRate: 0.08
    });

    // Orc
    this.templates.set('orc', {
      name: 'Orc',
      monsterType: 'orc',
      baseHealth: 20,
      baseAttack: 10,
      baseDefense: 6,
      aiType: 'aggressive',
      experienceValue: 25,
      spawnWeight: 0.7,
      criticalChance: 0.05,
      evasionRate: 0.04
    });

    // Skeleton
    this.templates.set('skeleton', {
      name: 'Skeleton',
      monsterType: 'skeleton',
      baseHealth: 15,
      baseAttack: 8,
      baseDefense: 4,
      aiType: 'basic-hostile',
      experienceValue: 15,
      spawnWeight: 0.8,
      criticalChance: 0.02,
      evasionRate: 0.06
    });

    // Slime
    this.templates.set('slime', {
      name: 'Slime',
      monsterType: 'slime',
      baseHealth: 8,
      baseAttack: 4,
      baseDefense: 1,
      aiType: 'passive',
      experienceValue: 5,
      spawnWeight: 1.2,
      criticalChance: 0.01,
      evasionRate: 0.12
    });

    // Dragon (boss)
    this.templates.set('dragon', {
      name: 'Dragon',
      monsterType: 'dragon',
      baseHealth: 100,
      baseAttack: 25,
      baseDefense: 15,
      aiType: 'boss',
      experienceValue: 500,
      spawnWeight: 0.01,
      criticalChance: 0.15,
      evasionRate: 0.02
    });
  }

  /**
   * Create a monster entity from template
   */
  static create(world: World, monsterType: MonsterType, position: { x: number; y: number }, level: number = 1): Entity | null {
    const template = this.templates.get(monsterType);
    if (!template) {
      return null;
    }

    // Scale stats by level
    const scaledHealth = template.baseHealth + (level - 1) * 3;
    const scaledAttack = template.baseAttack + (level - 1) * 2;
    const scaledDefense = template.baseDefense + (level - 1) * 1;
    const scaledExperience = template.experienceValue + (level - 1) * 5;

    // Create monster entity with all components
    const monster = world.createEntityWithComponents(
      // Position
      PositionComponentFactory.create(position.x, position.y),
      
      // Health
      HealthComponentFactory.createFull(scaledHealth),
      
      // Combat stats
      AttackComponentFactory.create(
        scaledAttack,
        template.criticalChance,
        1.0, // Full accuracy
        0 // No weapon bonus initially
      ),
      DefenseComponentFactory.create(
        scaledDefense,
        template.evasionRate,
        0.0, // No critical resistance initially
        0 // No armor bonus initially
      ),
      
      // Small inventory for drops
      InventoryComponentFactory.createMonster()
    );

    // Add monster-specific metadata component
    const monsterMetadata = {
      id: `monster_metadata_${Date.now()}_${Math.random()}`,
      type: 'monster_metadata',
      name: template.name,
      monsterType: template.monsterType,
      level,
      aiType: template.aiType,
      experienceValue: scaledExperience,
      spawnWeight: template.spawnWeight,
      turnsSinceLastAction: 0,
      lastPlayerPosition: null
    };

    world.addComponent(monster.id, monsterMetadata as any);

    return monster;
  }

  /**
   * Create monster with custom parameters
   */
  static createCustom(world: World, params: MonsterParams): Entity {
    const level = params.level || 1;
    const health = params.health || 15;
    const attack = params.attack || 8;
    const defense = params.defense || 4;
    const experienceValue = params.experienceValue || (level * 10);

    // Create monster entity
    const monster = world.createEntityWithComponents(
      PositionComponentFactory.create(params.position.x, params.position.y),
      HealthComponentFactory.createFull(health),
      AttackComponentFactory.create(attack, 0.05, 1.0, 0),
      DefenseComponentFactory.create(defense, 0.05, 0.0, 0),
      InventoryComponentFactory.createMonster()
    );

    // Add custom metadata
    const monsterMetadata = {
      id: `monster_metadata_${Date.now()}_${Math.random()}`,
      type: 'monster_metadata',
      name: params.name,
      monsterType: params.monsterType,
      level,
      aiType: params.aiType || 'basic-hostile',
      experienceValue,
      spawnWeight: 1.0,
      turnsSinceLastAction: 0,
      lastPlayerPosition: null
    };

    world.addComponent(monster.id, monsterMetadata as any);

    return monster;
  }

  /**
   * Get monster template
   */
  static getTemplate(monsterType: MonsterType): MonsterTemplate | undefined {
    return this.templates.get(monsterType);
  }

  /**
   * Get all monster types
   */
  static getAllMonsterTypes(): MonsterType[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Create random monster of appropriate level
   */
  static createRandom(world: World, position: { x: number; y: number }, level: number = 1): Entity | null {
    const types = this.getAllMonsterTypes();
    if (types.length === 0) {
      return null;
    }

    // Weight-based selection
    const weightedTypes: Array<{ type: MonsterType; weight: number }> = [];
    
    for (const type of types) {
      const template = this.templates.get(type);
      if (template) {
        // Adjust spawn weight based on level difference
        let adjustedWeight = template.spawnWeight;
        
        // Dragons only spawn at higher levels
        if (type === 'dragon' && level < 8) {
          adjustedWeight = 0;
        }
        
        // Slimes are more common at lower levels
        if (type === 'slime' && level > 3) {
          adjustedWeight *= 0.5;
        }
        
        weightedTypes.push({ type, weight: adjustedWeight });
      }
    }

    // Select random type based on weights
    const totalWeight = weightedTypes.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight === 0) {
      return null;
    }

    let random = Math.random() * totalWeight;
    for (const item of weightedTypes) {
      random -= item.weight;
      if (random <= 0) {
        return this.create(world, item.type, position, level);
      }
    }

    // Fallback to first type
    return this.create(world, weightedTypes[0].type, position, level);
  }
}

/**
 * Monster utilities for working with monster entities
 */
export class MonsterUtils {
  /**
   * Check if entity is a monster
   */
  static isMonster(world: World, entityId: string): boolean {
    return world.hasComponent(entityId, 'monster_metadata');
  }

  /**
   * Get monster name
   */
  static getName(world: World, entityId: string): string {
    const metadata = world.getComponent(entityId, 'monster_metadata') as any;
    return metadata?.name || entityId;
  }

  /**
   * Get monster type
   */
  static getMonsterType(world: World, entityId: string): MonsterType | null {
    const metadata = world.getComponent(entityId, 'monster_metadata') as any;
    return metadata?.monsterType || null;
  }

  /**
   * Get monster AI type
   */
  static getAIType(world: World, entityId: string): AIType | null {
    const metadata = world.getComponent(entityId, 'monster_metadata') as any;
    return metadata?.aiType || null;
  }

  /**
   * Get monster level
   */
  static getLevel(world: World, entityId: string): number {
    const metadata = world.getComponent(entityId, 'monster_metadata') as any;
    return metadata?.level || 1;
  }

  /**
   * Get experience value
   */
  static getExperienceValue(world: World, entityId: string): number {
    const metadata = world.getComponent(entityId, 'monster_metadata') as any;
    return metadata?.experienceValue || 0;
  }

  /**
   * Check if monster is hostile
   */
  static isHostile(world: World, entityId: string): boolean {
    const aiType = this.getAIType(world, entityId);
    return aiType ? ['basic-hostile', 'aggressive', 'boss'].includes(aiType) : false;
  }

  /**
   * Check if monster is passive
   */
  static isPassive(world: World, entityId: string): boolean {
    const aiType = this.getAIType(world, entityId);
    return aiType === 'passive';
  }

  /**
   * Check if monster is boss
   */
  static isBoss(world: World, entityId: string): boolean {
    const aiType = this.getAIType(world, entityId);
    return aiType === 'boss';
  }
}
