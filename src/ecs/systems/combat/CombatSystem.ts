/**
 * ECS Combat System - handles combat between entities
 * Pure ECS implementation: processes entities with combat components
 * Extended to replace non-ECS combat system
 */

import { System, SystemContext } from '../../core/System.js';
import { ComponentManager } from '../../core/ComponentManager.js';
import { EntityId } from '../../core/Entity.js';
import { HealthComponent, HealthComponentFactory, HealthUtils } from '../../components/common/Health.js';
import { AttackComponent, AttackUtils } from '../../../ecs/components/combat/Attack.js';
import { DefenseComponent, DefenseUtils } from '../../../ecs/components/combat/Defense.js';
import { PositionComponent } from '../../components/common/Position.js';

/**
 * Combat configuration from game config
 */
export interface CombatConfig {
  attackMultiplier: number;
  defenseBase: number;
  randomRangeMin: number;
  randomRangeMax: number;
  minimumDamage: number;
  baseCriticalChance: number;
  criticalMultiplier: number;
  baseEvasionRate: number;
  evasionEnabled: boolean;
}

/**
 * Combat result data
 */
export interface CombatResult {
  attacker: EntityId;
  defender: EntityId;
  damage: number;
  actualDamage: number;
  critical: boolean;
  evaded: boolean;
  success: boolean;
  message: string;
}

/**
 * Combat action data for events
 */
export interface CombatAction {
  type: 'attack' | 'defend' | 'flee';
  attacker: EntityId;
  target?: EntityId;
  timestamp: number;
}

/**
 * Player attack result for non-ECS compatibility
 */
export interface PlayerAttackResult {
  success: boolean;
  message: string;
  damage?: number;
  targetDestroyed?: boolean;
  targetPosition?: { x: number; y: number };
}

/**
 * ECS Combat System
 */
export class ECSCombatSystem extends System {
  private config: CombatConfig;
  private rng: () => number;
  private combatLog: Array<{ action: CombatAction; result: CombatResult }> = [];
  private dungeonManager: any = null;
  private messageSink: ((msg: string) => void) | null = null;

  constructor(componentManager: ComponentManager, config: CombatConfig) {
    // This system processes entities that can attack (have attack + position components)
    super(componentManager, ['attack', 'position']);
    
    this.config = config;
    this.rng = Math.random; // Can be overridden for testing
  }

  /**
   * Set dungeon manager for entity management
   */
  setDungeonManager(dungeonManager: any): void {
    this.dungeonManager = dungeonManager;
  }

  /**
   * Set message sink for combat messages
   */
  setMessageSink(sink: (msg: string) => void): void {
    this.messageSink = sink;
  }

  /**
   * Execute player attack at position (non-ECS compatibility)
   */
  executePlayerAttack(playerId: string, targetPosition: { x: number; y: number }): PlayerAttackResult {
    if (!this.dungeonManager) {
      return {
        success: false,
        message: 'Dungeon manager not available'
      };
    }

    // Get player components
    const playerAttack = this.getComponent<AttackComponent>(playerId, 'attack');
    const playerHealth = this.getComponent<HealthComponent>(playerId, 'health');
    
    if (!playerAttack || !playerHealth) {
      return {
        success: false,
        message: 'Player missing required components'
      };
    }

    // Check if target position has an entity
    const targetEntity = this.dungeonManager.getEntityAt(targetPosition);
    if (!targetEntity) {
      return {
        success: false,
        message: 'Nothing to attack'
      };
    }

    // Check if target is attackable (monster, etc.)
    if (!this.isAttackable(targetEntity)) {
      return {
        success: false,
        message: 'Cannot attack that'
      };
    }

    // Execute attack
    const combatResult = this.executeAttack(playerId, targetEntity.id);
    if (!combatResult) {
      return {
        success: false,
        message: 'Attack failed'
      };
    }

    // Process combat result
    if (combatResult.success) {
      // Apply damage to target
      this.applyDamageToEntity(targetEntity.id, combatResult.actualDamage);
      
      // Check if target was destroyed
      const targetDestroyed = this.isEntityDestroyed(targetEntity.id);
      
      // Send message
      if (this.messageSink) {
        this.messageSink(combatResult.message);
      }

      return {
        success: true,
        message: combatResult.message,
        damage: combatResult.actualDamage,
        targetDestroyed,
        targetPosition
      };
    } else {
      return {
        success: false,
        message: combatResult.message
      };
    }
  }

  /**
   * Check if entity is attackable
   */
  private isAttackable(entity: any): boolean {
    // Check if entity has monster-like properties
    return entity && (
      entity.stats?.hp !== undefined ||
      entity.components?.some((c: any) => c.type === 'monster') ||
      entity.flags?.isMonster === true
    );
  }

  /**
   * Apply damage to entity
   */
  private applyDamageToEntity(entityId: string, damage: number): void {
    const health = this.getComponent<HealthComponent>(entityId, 'health');
    if (health) {
      const newHealth = HealthUtils.applyDamage(health, damage);
      this.componentManager.removeComponent(entityId, 'health');
      this.componentManager.addComponent(entityId, newHealth);
    }
  }

  /**
   * Check if entity is destroyed
   */
  private isEntityDestroyed(entityId: string): boolean {
    const health = this.getComponent<HealthComponent>(entityId, 'health');
    return health ? health.currentHp <= 0 : false;
  }

  /**
   * Process combat for entities that can attack
   */
  protected process(context: SystemContext, entities: EntityId[]): void {
    // Combat is event-driven, not frame-driven
    // This method is called when combat events occur
    // The actual combat logic is in executeAttack method
  }

  /**
   * Execute an attack between two entities
   */
  executeAttack(attackerId: EntityId, defenderId: EntityId): CombatResult | null {
    // Validate entities exist and have required components
    const attackerAttack = this.getComponent<AttackComponent>(attackerId, 'attack');
    const attackerPos = this.getComponent<PositionComponent>(attackerId, 'position');
    const defenderDefense = this.getComponent<DefenseComponent>(defenderId, 'defense');
    const defenderHealth = this.getComponent<HealthComponent>(defenderId, 'health');
    const defenderPos = this.getComponent<PositionComponent>(defenderId, 'position');

    if (!attackerAttack || !attackerPos || !defenderDefense || !defenderHealth || !defenderPos) {
      return null; // Missing required components
    }

    // Check if entities are in range (adjacent for now)
    if (!this.isInAttackRange(attackerPos, defenderPos)) {
      return {
        attacker: attackerId,
        defender: defenderId,
        damage: 0,
        actualDamage: 0,
        critical: false,
        evaded: false,
        success: false,
        message: 'Target out of range'
      };
    }

    // Calculate base damage
    const baseDamage = AttackUtils.calculateBaseDamage(attackerAttack);
    
    // Apply random variation
    const randomFactor = this.rng() * (this.config.randomRangeMax - this.config.randomRangeMin) + this.config.randomRangeMin;
    let damage = baseDamage * randomFactor * this.config.attackMultiplier;
    
    // Check for critical hit
    const criticalRoll = this.rng();
    const critical = criticalRoll < this.config.baseCriticalChance;
    if (critical) {
      damage *= this.config.criticalMultiplier;
    }
    
    // Check for evasion
    const evasionRoll = this.rng();
    const evaded = evasionRoll < this.config.baseEvasionRate;
    if (evaded) {
      return {
        attacker: attackerId,
        defender: defenderId,
        damage: baseDamage,
        actualDamage: 0,
        critical: false,
        evaded: true,
        success: false,
        message: `${defenderId} evaded the attack!`
      };
    }
    
    // Apply defense
    const defenseValue = DefenseUtils.calculateDefense(defenderDefense);
    const actualDamage = Math.max(this.config.minimumDamage, damage - defenseValue);
    
    // Log combat action
    const action: CombatAction = {
      type: 'attack',
      attacker: attackerId,
      target: defenderId,
      timestamp: Date.now()
    };
    
    const result: CombatResult = {
      attacker: attackerId,
      defender: defenderId,
      damage: baseDamage,
      actualDamage,
      critical,
      evaded: false,
      success: true,
      message: this.generateCombatMessage(attackerId, defenderId, actualDamage, critical)
    };
    
    this.combatLog.push({ action, result });
    
    return result;
  }

  /**
   * Check if two positions are in attack range
   */
  private isInAttackRange(pos1: PositionComponent, pos2: PositionComponent): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return dx <= 1 && dy <= 1; // Adjacent positions
  }

  /**
   * Generate combat message
   */
  private generateCombatMessage(attacker: EntityId, defender: EntityId, damage: number, critical: boolean): string {
    let message = `${attacker} attacks ${defender}`;
    if (critical) {
      message += ' with a critical hit';
    }
    message += ` for ${Math.round(damage)} damage!`;
    return message;
  }

  /**
   * Get combat log
   */
  getCombatLog(): Array<{ action: CombatAction; result: CombatResult }> {
    return [...this.combatLog];
  }

  /**
   * Clear combat log
   */
  clearCombatLog(): void {
    this.combatLog = [];
  }

  protected onInitialize(): void {
    console.log('ECS Combat System initialized');
  }
}
