/**
 * Player Entity Prefab - ECS-based player creation
 * Creates player entities using pure ECS components
 */

import { World } from '../../../ecs/core/World.js';
import { Entity } from '../../../ecs/core/Entity.js';
import { PositionComponentFactory } from '../../../ecs/components/common/Position.js';
import { HealthComponentFactory } from '../../../ecs/components/common/Health.js';
import { AttackComponentFactory } from '../../../ecs/components/combat/Attack.js';
import { DefenseComponentFactory } from '../../../ecs/components/combat/Defense.js';
import { HungerComponentFactory } from '../../../ecs/components/status/Hunger.js';
import { InventoryComponentFactory } from '../../../ecs/components/common/Inventory.js';

/**
 * Player creation parameters
 */
export interface PlayerParams {
  name: string;
  position: { x: number; y: number };
  level?: number;
  maxHealth?: number;
  maxHunger?: number;
  inventoryCapacity?: number;
}

/**
 * Player prefab factory
 */
export class PlayerPrefab {
  /**
   * Create a player entity with all necessary components
   */
  static create(world: World, params: PlayerParams): Entity {
    const level = params.level || 1;
    const maxHealth = params.maxHealth || (20 + level * 5);
    const maxHunger = params.maxHunger || 100;
    const inventoryCapacity = params.inventoryCapacity || 20;

    // Create player entity with all components
    const player = world.createEntityWithComponents(
      // Position
      PositionComponentFactory.create(params.position.x, params.position.y),
      
      // Health (full health at creation)
      HealthComponentFactory.createFull(maxHealth),
      
      // Combat stats (scaled by level)
      AttackComponentFactory.createPlayer(level),
      DefenseComponentFactory.createPlayer(level),
      
      // Hunger (full hunger at creation)
      HungerComponentFactory.createPlayer(),
      
      // Inventory (empty at creation)
      InventoryComponentFactory.createPlayer()
    );

    // Add player-specific metadata component
    const playerMetadata = {
      id: `player_metadata_${Date.now()}_${Math.random()}`,
      type: 'player_metadata',
      name: params.name,
      level,
      experiencePoints: 0,
      experienceToNext: level * 100,
      turnCount: 0,
      floorCount: 1
    };

    world.addComponent(player.id, playerMetadata as any);

    return player;
  }

  /**
   * Create a player with starting equipment
   */
  static createWithStartingGear(world: World, params: PlayerParams): Entity {
    const player = this.create(world, params);

    // Add starting items to inventory
    // This would typically be done through the item system
    // For now, we'll add them directly to demonstrate the concept

    return player;
  }

  /**
   * Create a player at specific level
   */
  static createAtLevel(world: World, name: string, position: { x: number; y: number }, level: number): Entity {
    return this.create(world, {
      name,
      position,
      level,
      maxHealth: 20 + level * 5,
      maxHunger: 100,
      inventoryCapacity: 20
    });
  }

  /**
   * Create a beginner player
   */
  static createBeginner(world: World, name: string, position: { x: number; y: number }): Entity {
    return this.createAtLevel(world, name, position, 1);
  }

  /**
   * Create an experienced player
   */
  static createExperienced(world: World, name: string, position: { x: number; y: number }): Entity {
    return this.createAtLevel(world, name, position, 5);
  }

  /**
   * Create a veteran player
   */
  static createVeteran(world: World, name: string, position: { x: number; y: number }): Entity {
    return this.createAtLevel(world, name, position, 10);
  }
}

/**
 * Player utilities for working with player entities
 */
export class PlayerUtils {
  /**
   * Check if entity is a player
   */
  static isPlayer(world: World, entityId: string): boolean {
    return world.hasComponent(entityId, 'player_metadata');
  }

  /**
   * Get player name
   */
  static getName(world: World, entityId: string): string {
    const metadata = world.getComponent(entityId, 'player_metadata') as any;
    return metadata?.name || entityId;
  }

  /**
   * Get player level
   */
  static getLevel(world: World, entityId: string): number {
    const metadata = world.getComponent(entityId, 'player_metadata') as any;
    return metadata?.level || 1;
  }

  /**
   * Level up player
   */
  static levelUp(world: World, entityId: string): boolean {
    const metadata = world.getComponent(entityId, 'player_metadata') as any;
    if (!metadata) {
      return false;
    }

    const newLevel = metadata.level + 1;
    const newMetadata = {
      ...metadata,
      level: newLevel,
      experiencePoints: 0,
      experienceToNext: newLevel * 100
    };

    world.removeComponent(entityId, 'player_metadata');
    world.addComponent(entityId, newMetadata);

    // Update combat stats
    const attack = world.getComponent(entityId, 'attack') as any;
    const defense = world.getComponent(entityId, 'defense') as any;
    const health = world.getComponent(entityId, 'health') as any;

    if (attack) {
      const newAttack = AttackComponentFactory.createPlayer(newLevel);
      world.removeComponent(entityId, 'attack');
      world.addComponent(entityId, newAttack);
    }

    if (defense) {
      const newDefense = DefenseComponentFactory.createPlayer(newLevel);
      world.removeComponent(entityId, 'defense');
      world.addComponent(entityId, newDefense);
    }

    if (health) {
      const newMaxHealth = 20 + newLevel * 5;
      const newHealth = HealthComponentFactory.create(health.current, newMaxHealth);
      world.removeComponent(entityId, 'health');
      world.addComponent(entityId, newHealth);
    }

    return true;
  }

  /**
   * Add experience to player
   */
  static addExperience(world: World, entityId: string, experience: number): boolean {
    const metadata = world.getComponent(entityId, 'player_metadata') as any;
    if (!metadata) {
      return false;
    }

    const newExp = metadata.experiencePoints + experience;
    const expToNext = metadata.experienceToNext;

    if (newExp >= expToNext) {
      // Level up
      this.levelUp(world, entityId);
      return true;
    } else {
      // Just add experience
      const newMetadata = {
        ...metadata,
        experiencePoints: newExp
      };

      world.removeComponent(entityId, 'player_metadata');
      world.addComponent(entityId, newMetadata);
      return false; // No level up
    }
  }

  /**
   * Get player statistics
   */
  static getStats(world: World, entityId: string): {
    name: string;
    level: number;
    health: { current: number; maximum: number };
    hunger: { current: number; maximum: number };
    attack: number;
    defense: number;
    inventoryUsage: { current: number; max: number };
  } | null {
    if (!this.isPlayer(world, entityId)) {
      return null;
    }

    const metadata = world.getComponent(entityId, 'player_metadata') as any;
    const health = world.getComponent(entityId, 'health') as any;
    const hunger = world.getComponent(entityId, 'hunger') as any;
    const attack = world.getComponent(entityId, 'attack') as any;
    const defense = world.getComponent(entityId, 'defense') as any;
    const inventory = world.getComponent(entityId, 'inventory') as any;

    return {
      name: metadata?.name || entityId,
      level: metadata?.level || 1,
      health: {
        current: health?.current || 0,
        maximum: health?.maximum || 0
      },
      hunger: {
        current: hunger?.current || 0,
        maximum: hunger?.maximum || 0
      },
      attack: attack?.power || 0,
      defense: defense?.value || 0,
      inventoryUsage: {
        current: inventory?.currentCapacity || 0,
        max: inventory?.maxCapacity || 0
      }
    };
  }
}
