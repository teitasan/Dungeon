/**
 * Trap system for handling various trap types and effects
 */

import { GameEntity } from '../types/entities';
import { Position } from '../types/core';
import { Trap, TrapType } from '../types/dungeon';
import { DungeonManager } from '../dungeon/DungeonManager';
import { StatusEffectSystem } from './StatusEffectSystem';
import { MovementSystem } from './MovementSystem';

// Trap activation result
export interface TrapActivationResult {
  success: boolean;
  trap: Trap;
  entity: GameEntity;
  effects: TrapEffect[];
  message: string;
  trapDestroyed: boolean;
}

export interface TrapEffect {
  type: TrapEffectType;
  value?: number;
  target: GameEntity;
  success: boolean;
  message: string;
}

export type TrapEffectType = 
  | 'damage' 
  | 'status-effect' 
  | 'teleport' 
  | 'summon-monster' 
  | 'hunger-drain' 
  | 'stat-drain' 
  | 'item-destruction' 
  | 'confusion';

// Trap configuration
export interface TrapConfig {
  id: string;
  name: string;
  type: TrapType;
  visible: boolean;
  reusable: boolean;
  activationChance: number;
  effects: TrapEffectConfig[];
  description: string;
}

export interface TrapEffectConfig {
  type: TrapEffectType;
  value?: number;
  chance?: number;
  duration?: number;
  description: string;
}

// Trap detection result
export interface TrapDetectionResult {
  detected: boolean;
  trap?: Trap;
  position: Position;
  detectionChance: number;
}

export class TrapSystem {
  private dungeonManager: DungeonManager;
  private statusEffectSystem: StatusEffectSystem;
  private movementSystem: MovementSystem;
  private trapConfigs: Map<TrapType, TrapConfig> = new Map();
  private rng: () => number;

  constructor(
    dungeonManager: DungeonManager,
    statusEffectSystem: StatusEffectSystem,
    movementSystem: MovementSystem
  ) {
    this.dungeonManager = dungeonManager;
    this.statusEffectSystem = statusEffectSystem;
    this.movementSystem = movementSystem;
    this.rng = Math.random;
    this.initializeDefaultTraps();
  }

  /**
   * Check for trap activation when entity moves to position
   */
  checkTrapActivation(entity: GameEntity, position: Position): TrapActivationResult | null {
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell || !cell.trap) {
      return null;
    }

    const trap = cell.trap;
    
    // Skip if trap already triggered and not reusable
    if (trap.triggered && !this.isTrapReusable(trap.type)) {
      return null;
    }

    // Check activation chance
    const config = this.trapConfigs.get(trap.type);
    if (!config) {
      return null;
    }

    if (this.rng() > config.activationChance) {
      return {
        success: false,
        trap,
        entity,
        effects: [],
        message: `${entity.id} narrowly avoids a ${config.name}`,
        trapDestroyed: false
      };
    }

    // Activate trap
    return this.activateTrap(trap, entity, position);
  }

  /**
   * Activate a trap
   */
  private activateTrap(trap: Trap, entity: GameEntity, position: Position): TrapActivationResult {
    const config = this.trapConfigs.get(trap.type);
    if (!config) {
      return {
        success: false,
        trap,
        entity,
        effects: [],
        message: 'Unknown trap type',
        trapDestroyed: false
      };
    }

    const effects: TrapEffect[] = [];
    let trapDestroyed = false;

    // Process each trap effect
    for (const effectConfig of config.effects) {
      const effect = this.processTrapEffect(effectConfig, entity, position);
      effects.push(effect);
    }

    // Mark trap as triggered
    trap.triggered = true;
    
    // Destroy trap if not reusable
    if (!config.reusable) {
      const cell = this.dungeonManager.getCellAt(position);
      if (cell) {
        cell.trap = undefined;
        trapDestroyed = true;
      }
    }

    const message = this.generateTrapMessage(config, entity, effects);

    return {
      success: true,
      trap,
      entity,
      effects,
      message,
      trapDestroyed
    };
  }

  /**
   * Process individual trap effect
   */
  private processTrapEffect(
    effectConfig: TrapEffectConfig,
    entity: GameEntity,
    position: Position
  ): TrapEffect {
    let success = false;
    let message = '';
    const value = effectConfig.value || 0;

    // Check effect chance
    if (effectConfig.chance && this.rng() > effectConfig.chance) {
      return {
        type: effectConfig.type,
        value,
        target: entity,
        success: false,
        message: `${effectConfig.description} failed to trigger`
      };
    }

    switch (effectConfig.type) {
      case 'damage':
        success = this.applyTrapDamage(entity, value);
        message = success ? 
          `${entity.id} takes ${value} damage from trap` : 
          `${entity.id} resists trap damage`;
        break;

      case 'status-effect':
        success = this.applyTrapStatusEffect(entity, effectConfig);
        message = success ? 
          `${entity.id} is affected by ${effectConfig.description}` : 
          `${entity.id} resists status effect`;
        break;

      case 'teleport':
        success = this.applyTrapTeleport(entity);
        message = success ? 
          `${entity.id} is teleported` : 
          `Teleportation failed`;
        break;

      case 'summon-monster':
        success = this.applyTrapSummon(position, value);
        message = success ? 
          `A monster appears from the trap` : 
          `Monster summoning failed`;
        break;

      case 'hunger-drain':
        success = this.applyTrapHungerDrain(entity, value);
        message = success ? 
          `${entity.id} feels hungry` : 
          `${entity.id} is not affected by hunger drain`;
        break;

      case 'stat-drain':
        success = this.applyTrapStatDrain(entity, value);
        message = success ? 
          `${entity.id} feels weaker` : 
          `${entity.id} resists stat drain`;
        break;

      case 'item-destruction':
        success = this.applyTrapItemDestruction(entity, value);
        message = success ? 
          `Some of ${entity.id}'s items are destroyed` : 
          `${entity.id}'s items are safe`;
        break;

      case 'confusion':
        success = this.applyTrapConfusion(entity, effectConfig.duration || 5);
        message = success ? 
          `${entity.id} becomes confused` : 
          `${entity.id} resists confusion`;
        break;

      default:
        message = `Unknown trap effect: ${effectConfig.type}`;
    }

    return {
      type: effectConfig.type,
      value,
      target: entity,
      success,
      message
    };
  }

  /**
   * Apply trap damage
   */
  private applyTrapDamage(entity: GameEntity, damage: number): boolean {
    const stats = (entity as any).stats;
    if (!stats) return false;

    const actualDamage = Math.min(damage, stats.hp);
    stats.hp = Math.max(0, stats.hp - damage);
    
    return actualDamage > 0;
  }

  /**
   * Apply trap status effect
   */
  private applyTrapStatusEffect(entity: GameEntity, effectConfig: TrapEffectConfig): boolean {
    // Map trap effects to status effects
    const statusEffectMap: Record<string, string> = {
      'poison-trap': 'poison',
      'paralysis-trap': 'paralysis',
      'confusion-trap': 'confusion',
      'bind-trap': 'bind'
    };

    const statusType = statusEffectMap[effectConfig.description] || 'poison';
    return this.statusEffectSystem.applyStatusEffect(entity, statusType, effectConfig.value || 1);
  }

  /**
   * Apply trap teleportation
   */
  private applyTrapTeleport(entity: GameEntity): boolean {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) return false;

    // Find random walkable position
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(this.rng() * dungeon.width);
      const y = Math.floor(this.rng() * dungeon.height);
      const newPos = { x, y };

      if (this.dungeonManager.isWalkable(newPos)) {
        return this.dungeonManager.moveEntity(entity, newPos);
      }
      attempts++;
    }

    return false;
  }

  /**
   * Apply trap monster summoning
   */
  private applyTrapSummon(position: Position, monsterLevel: number): boolean {
    // This would integrate with a monster spawning system
    // For now, just return success if position is valid
    const adjacentPositions = this.dungeonManager.getAdjacentPositions(position);
    const validPositions = adjacentPositions.filter(pos => 
      this.dungeonManager.isWalkable(pos) && 
      this.dungeonManager.getEntitiesAt(pos).length === 0
    );

    return validPositions.length > 0;
  }

  /**
   * Apply trap hunger drain
   */
  private applyTrapHungerDrain(entity: GameEntity, amount: number): boolean {
    if ('hunger' in entity) {
      const player = entity as any;
      const oldHunger = player.hunger;
      player.hunger = Math.max(0, player.hunger - amount);
      return player.hunger < oldHunger;
    }
    return false;
  }

  /**
   * Apply trap stat drain
   */
  private applyTrapStatDrain(entity: GameEntity, amount: number): boolean {
    const stats = (entity as any).stats;
    if (!stats) return false;

    // Temporarily reduce stats (would need integration with status effect system for permanent effects)
    const originalAttack = stats.attack;
    stats.attack = Math.max(1, stats.attack - amount);
    
    return stats.attack < originalAttack;
  }

  /**
   * Apply trap item destruction
   */
  private applyTrapItemDestruction(entity: GameEntity, count: number): boolean {
    if ('inventory' in entity) {
      const inventory = (entity as any).inventory;
      if (inventory.length === 0) return false;

      const itemsToDestroy = Math.min(count, inventory.length);
      for (let i = 0; i < itemsToDestroy; i++) {
        const randomIndex = Math.floor(this.rng() * inventory.length);
        inventory.splice(randomIndex, 1);
      }
      
      return itemsToDestroy > 0;
    }
    return false;
  }

  /**
   * Apply trap confusion
   */
  private applyTrapConfusion(entity: GameEntity, duration: number): boolean {
    return this.statusEffectSystem.applyStatusEffect(entity, 'confusion', 1);
  }

  /**
   * Detect traps at position
   */
  detectTraps(entity: GameEntity, position: Position, detectionBonus: number = 0): TrapDetectionResult {
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell || !cell.trap) {
      return {
        detected: false,
        position,
        detectionChance: 0
      };
    }

    const trap = cell.trap;
    
    // Already visible traps are automatically detected
    if (trap.visible) {
      return {
        detected: true,
        trap,
        position,
        detectionChance: 1.0
      };
    }

    // Calculate detection chance
    const baseDetectionChance = 0.1; // 10% base chance
    const levelBonus = ((entity as any).stats?.level || 1) * 0.02; // 2% per level
    const totalChance = Math.min(0.9, baseDetectionChance + levelBonus + detectionBonus);

    const detected = this.rng() < totalChance;
    
    if (detected) {
      trap.visible = true; // Make trap visible once detected
    }

    return {
      detected,
      trap: detected ? trap : undefined,
      position,
      detectionChance: totalChance
    };
  }

  /**
   * Disarm trap at position
   */
  disarmTrap(entity: GameEntity, position: Position, disarmBonus: number = 0): {
    success: boolean;
    trap?: Trap;
    message: string;
  } {
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell || !cell.trap) {
      return {
        success: false,
        message: 'No trap found at this position'
      };
    }

    const trap = cell.trap;
    
    if (!trap.visible) {
      return {
        success: false,
        trap,
        message: 'Cannot disarm an undetected trap'
      };
    }

    // Calculate disarm chance
    const baseDisarmChance = 0.3; // 30% base chance
    const levelBonus = ((entity as any).stats?.level || 1) * 0.05; // 5% per level
    const totalChance = Math.min(0.95, baseDisarmChance + levelBonus + disarmBonus);

    const success = this.rng() < totalChance;
    
    if (success) {
      cell.trap = undefined; // Remove trap
      return {
        success: true,
        trap,
        message: `${entity.id} successfully disarms the ${this.getTrapName(trap.type)}`
      };
    } else {
      // Failed disarm might trigger the trap
      const triggerChance = 0.3;
      if (this.rng() < triggerChance) {
        const activation = this.activateTrap(trap, entity, position);
        return {
          success: false,
          trap,
          message: `${entity.id} fails to disarm the trap and triggers it! ${activation.message}`
        };
      } else {
        return {
          success: false,
          trap,
          message: `${entity.id} fails to disarm the ${this.getTrapName(trap.type)}`
        };
      }
    }
  }

  /**
   * Place trap at position
   */
  placeTrap(position: Position, trapType: TrapType, visible: boolean = false): boolean {
    const cell = this.dungeonManager.getCellAt(position);
    if (!cell || cell.trap) {
      return false; // Position invalid or already has trap
    }

    const config = this.trapConfigs.get(trapType);
    if (!config) {
      return false; // Unknown trap type
    }

    const trap: Trap = {
      id: `trap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: trapType,
      visible,
      triggered: false
    };

    cell.trap = trap;
    return true;
  }

  /**
   * Get trap name
   */
  private getTrapName(trapType: TrapType): string {
    const config = this.trapConfigs.get(trapType);
    return config ? config.name : 'Unknown Trap';
  }

  /**
   * Check if trap type is reusable
   */
  private isTrapReusable(trapType: TrapType): boolean {
    const config = this.trapConfigs.get(trapType);
    return config ? config.reusable : false;
  }

  /**
   * Generate trap activation message
   */
  private generateTrapMessage(
    config: TrapConfig,
    entity: GameEntity,
    effects: TrapEffect[]
  ): string {
    const entityName = (entity as any).name || entity.id;
    const successfulEffects = effects.filter(e => e.success);
    
    if (successfulEffects.length === 0) {
      return `${entityName} triggers a ${config.name} but nothing happens`;
    }
    
    let message = `${entityName} triggers a ${config.name}! `;
    message += successfulEffects.map(e => e.message).join(' ');
    
    return message;
  }

  /**
   * Initialize default trap configurations
   */
  private initializeDefaultTraps(): void {
    // Spike trap
    this.trapConfigs.set('spike', {
      id: 'spike-trap',
      name: 'Spike Trap',
      type: 'spike',
      visible: false,
      reusable: true,
      activationChance: 0.8,
      effects: [
        {
          type: 'damage',
          value: 5,
          chance: 1.0,
          description: 'Sharp spikes pierce the target'
        }
      ],
      description: 'Sharp spikes emerge from the ground'
    });

    // Poison trap
    this.trapConfigs.set('poison', {
      id: 'poison-trap',
      name: 'Poison Trap',
      type: 'poison',
      visible: false,
      reusable: false,
      activationChance: 0.9,
      effects: [
        {
          type: 'status-effect',
          value: 3,
          chance: 0.8,
          duration: 5,
          description: 'poison-trap'
        }
      ],
      description: 'A cloud of toxic gas is released'
    });

    // Teleport trap
    this.trapConfigs.set('teleport', {
      id: 'teleport-trap',
      name: 'Teleport Trap',
      type: 'teleport',
      visible: false,
      reusable: false,
      activationChance: 1.0,
      effects: [
        {
          type: 'teleport',
          chance: 0.9,
          description: 'Magical teleportation'
        }
      ],
      description: 'A magical circle teleports the target'
    });

    // Monster trap
    this.trapConfigs.set('monster', {
      id: 'monster-trap',
      name: 'Monster Trap',
      type: 'monster',
      visible: false,
      reusable: false,
      activationChance: 1.0,
      effects: [
        {
          type: 'summon-monster',
          value: 1,
          chance: 0.8,
          description: 'Summons a monster'
        }
      ],
      description: 'A monster emerges from hiding'
    });

    // Hunger trap
    this.trapConfigs.set('hunger', {
      id: 'hunger-trap',
      name: 'Hunger Trap',
      type: 'hunger',
      visible: false,
      reusable: false,
      activationChance: 0.7,
      effects: [
        {
          type: 'hunger-drain',
          value: 20,
          chance: 1.0,
          description: 'Drains hunger'
        }
      ],
      description: 'A curse that increases hunger'
    });

    // Stat drain trap
    this.trapConfigs.set('stat-drain', {
      id: 'stat-drain-trap',
      name: 'Weakness Trap',
      type: 'stat-drain',
      visible: false,
      reusable: false,
      activationChance: 0.6,
      effects: [
        {
          type: 'stat-drain',
          value: 2,
          chance: 0.8,
          description: 'Drains physical strength'
        }
      ],
      description: 'A curse that weakens the target'
    });

    // Confusion trap
    this.trapConfigs.set('confusion', {
      id: 'confusion-trap',
      name: 'Confusion Trap',
      type: 'confusion',
      visible: false,
      reusable: false,
      activationChance: 0.8,
      effects: [
        {
          type: 'confusion',
          chance: 0.9,
          duration: 3,
          description: 'Causes confusion'
        }
      ],
      description: 'Disorienting magic affects the mind'
    });

    // Item destruction trap
    this.trapConfigs.set('rust', {
      id: 'rust-trap',
      name: 'Rust Trap',
      type: 'rust',
      visible: false,
      reusable: false,
      activationChance: 0.5,
      effects: [
        {
          type: 'item-destruction',
          value: 1,
          chance: 0.7,
          description: 'Destroys items'
        }
      ],
      description: 'Corrosive gas damages equipment'
    });
  }

  /**
   * Get all trap configurations
   */
  getTrapConfigs(): Map<TrapType, TrapConfig> {
    return new Map(this.trapConfigs);
  }

  /**
   * Get trap configuration by type
   */
  getTrapConfig(trapType: TrapType): TrapConfig | undefined {
    return this.trapConfigs.get(trapType);
  }

  /**
   * Set custom RNG function for testing
   */
  setRNG(rng: () => number): void {
    this.rng = rng;
  }

  /**
   * Get all traps in current dungeon
   */
  getAllTraps(): { position: Position; trap: Trap }[] {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) return [];

    const traps: { position: Position; trap: Trap }[] = [];
    
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = this.dungeonManager.getCellAt({ x, y });
        if (cell && cell.trap) {
          traps.push({
            position: { x, y },
            trap: cell.trap
          });
        }
      }
    }

    return traps;
  }

  /**
   * Get visible traps in current dungeon
   */
  getVisibleTraps(): { position: Position; trap: Trap }[] {
    return this.getAllTraps().filter(({ trap }) => trap.visible);
  }

  /**
   * Clear all traps from current dungeon
   */
  clearAllTraps(): void {
    const dungeon = this.dungeonManager.getCurrentDungeon();
    if (!dungeon) return;

    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = this.dungeonManager.getCellAt({ x, y });
        if (cell && cell.trap) {
          cell.trap = undefined;
        }
      }
    }
  }
}