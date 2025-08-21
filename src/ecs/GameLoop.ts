/**
 * ECS Game Loop - Main game loop using ECS architecture
 * Replaces traditional OOP-based game loop with pure ECS
 */

import { World } from './core/World.js';
import { System, SystemContext } from './core/System.js';
import { ComponentManager } from './core/ComponentManager.js';
import { EntityId } from './core/Entity.js';
import { ECSCombatSystem } from './systems/combat/CombatSystem.js';
import { ECSHungerSystem } from './systems/status/HungerSystem.js';
import { ECSItemSystem } from './systems/common/ItemSystem.js';
import { PlayerPrefab, PlayerUtils } from '../game/entities/prefabs/PlayerPrefab.js';
import { MonsterPrefab, MonsterUtils } from '../game/entities/prefabs/MonsterPrefab.js';

/**
 * Game loop configuration
 */
export interface GameLoopConfig {
  targetFPS: number;
  enableProfiling: boolean;
  enableDebugging: boolean;
  maxFrameTime: number;
}

/**
 * Game state
 */
export interface GameState {
  isRunning: boolean;
  isPaused: boolean;
  currentFloor: number;
  maxFloor: number;
  gameTime: number;
  frameCount: number;
}

/**
 * ECS Game Loop
 */
export class ECSGameLoop {
  private world: World;
  private config: GameLoopConfig;
  private state: GameState;
  private lastFrameTime: number = 0;
  private frameTimeHistory: number[] = [];
  private systems: Map<string, System> = new Map();
  
  // Game-specific systems
  private combatSystem!: ECSCombatSystem;
  private hungerSystem!: ECSHungerSystem;
  private itemSystem!: ECSItemSystem;

  constructor(config: GameLoopConfig) {
    this.config = config;
    this.state = {
      isRunning: false,
      isPaused: false,
      currentFloor: 1,
      maxFloor: 10,
      gameTime: 0,
      frameCount: 0
    };

    // Initialize ECS world
    this.world = new World({
      maxEntities: 1000,
      enableProfiling: config.enableProfiling,
      enableDebugging: config.enableDebugging
    });

    // Initialize game systems
    this.initializeSystems();
  }

  /**
   * Initialize all game systems
   */
  private initializeSystems(): void {
    // Combat system
    const combatConfig = {
      attackMultiplier: 1.3,
      defenseBase: 35/36,
      randomRangeMin: 7/8,
      randomRangeMax: 9/8,
      minimumDamage: 1,
      baseCriticalChance: 0.05,
      criticalMultiplier: 2.0,
      baseEvasionRate: 0.05,
      evasionEnabled: true
    };
    this.combatSystem = new ECSCombatSystem(this.world.getComponentManager(), combatConfig);
    this.world.addSystem(this.combatSystem);

    // Hunger system
    const hungerConfig = {
      maxValue: 100,
      decreaseRate: 1,
      minValue: 0,
      damageAmount: 5,
      recoveryAmount: 1,
      maxOverfeedTime: 10
    };
    this.hungerSystem = new ECSHungerSystem(this.world.getComponentManager(), hungerConfig);
    this.world.addSystem(this.hungerSystem);

    // Item system
    this.itemSystem = new ECSItemSystem(this.world.getComponentManager());
    this.world.addSystem(this.itemSystem);

    // Initialize all systems
    this.world.initialize();
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.state.isRunning) {
      return;
    }

    this.state.isRunning = true;
    this.state.isPaused = false;
    this.lastFrameTime = performance.now();
    
    console.log('🚀 ECS Game Loop started');
    this.gameLoop();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.state.isRunning = false;
    console.log('⏹️ ECS Game Loop stopped');
  }

  /**
   * Pause the game loop
   */
  pause(): void {
    this.state.isPaused = true;
    console.log('⏸️ ECS Game Loop paused');
  }

  /**
   * Resume the game loop
   */
  resume(): void {
    this.state.isPaused = false;
    console.log('▶️ ECS Game Loop resumed');
  }

  /**
   * Main game loop
   */
  private gameLoop(): void {
    if (!this.state.isRunning) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = Math.min(currentTime - this.lastFrameTime, this.config.maxFrameTime);
    this.lastFrameTime = currentTime;

    if (!this.state.isPaused) {
      // Update game time
      this.state.gameTime += deltaTime;
      this.state.frameCount++;

      // Update ECS world
      this.update(deltaTime);

      // Update frame time history for FPS calculation
      this.updateFrameTimeHistory(deltaTime);
    }

    // Schedule next frame
    const targetFrameTime = 1000 / this.config.targetFPS;
    const elapsed = performance.now() - currentTime;
    const delay = Math.max(0, targetFrameTime - elapsed);

    setTimeout(() => this.gameLoop(), delay);
  }

  /**
   * Update game state
   */
  private update(deltaTime: number): void {
    // Convert deltaTime to seconds for ECS systems
    const deltaSeconds = deltaTime / 1000;

    // Update ECS world
    this.world.update(deltaSeconds);

    // Process game-specific logic
    this.processGameLogic(deltaSeconds);
  }

  /**
   * Process game-specific logic
   */
  private processGameLogic(deltaTime: number): void {
    // Process hunger every few seconds (not every frame)
    if (this.state.frameCount % 60 === 0) { // Every 60 frames at 60 FPS = every second
      this.processHunger();
    }

    // Process AI every few frames
    if (this.state.frameCount % 10 === 0) { // Every 10 frames
      this.processAI();
    }

    // Process item effects
    this.processItemEffects();
  }

  /**
   * Process hunger for all entities
   */
  private processHunger(): void {
    // Hunger system automatically processes entities with hunger components
    // Results are available through hungerSystem.getHungerResults()
    const results = this.hungerSystem.getHungerResults();
    
    for (const result of results) {
      if (result.stateChanged || result.damageApplied > 0) {
        console.log(`🍖 ${result.message}`);
        
        // Check if entity died from starvation
        if (result.damageApplied > 0) {
          const health = this.world.getComponent(result.entityId, 'health') as any;
          if (health && health.current <= 0) {
            console.log(`💀 ${result.entityId} died from starvation!`);
            this.world.destroyEntity(result.entityId);
          }
        }
      }
    }
  }

  /**
   * Process AI for monsters
   */
  private processAI(): void {
    // Get all entities with monster metadata
    const entities = this.world.getEntityIds();
    
    for (const entityId of entities) {
      if (MonsterUtils.isMonster(this.world, entityId)) {
        this.processMonsterAI(entityId);
      }
    }
  }

  /**
   * Process AI for a single monster
   */
  private processMonsterAI(monsterId: EntityId): void {
    const aiType = MonsterUtils.getAIType(this.world, monsterId);
    if (!aiType) return;

    switch (aiType) {
      case 'passive':
        // Passive monsters don't move or attack
        break;
        
      case 'basic-hostile':
        this.processBasicHostileAI(monsterId);
        break;
        
      case 'aggressive':
        this.processAggressiveAI(monsterId);
        break;
        
      case 'boss':
        this.processBossAI(monsterId);
        break;
        
      default:
        break;
    }
  }

  /**
   * Process basic hostile AI
   */
  private processBasicHostileAI(monsterId: EntityId): void {
    // Simple AI: move towards player if in range, attack if adjacent
    const playerId = this.findNearestPlayer(monsterId);
    if (!playerId) return;

    const monsterPos = this.world.getComponent(monsterId, 'position') as any;
    const playerPos = this.world.getComponent(playerId, 'position') as any;
    
    if (!monsterPos || !playerPos) return;

    const distance = Math.sqrt(
      Math.pow(monsterPos.x - playerPos.x, 2) + 
      Math.pow(monsterPos.y - playerPos.y, 2)
    );

    if (distance <= 3) { // Detection range
      if (distance <= 1) { // Attack range
        // Attack player
        const result = this.combatSystem.executeAttack(monsterId, playerId);
        if (result) {
          console.log(`⚔️ ${result.message}`);
          
          // Check if player died
          const playerHealth = this.world.getComponent(playerId, 'health') as any;
          if (playerHealth && playerHealth.current <= 0) {
            console.log(`💀 Player defeated by ${MonsterUtils.getName(this.world, monsterId)}!`);
            this.gameOver();
          }
        }
      } else {
        // Move towards player
        this.moveTowardsTarget(monsterId, playerPos);
      }
    }
  }

  /**
   * Process aggressive AI
   */
  private processAggressiveAI(monsterId: EntityId): void {
    // Aggressive monsters have longer detection range and move faster
    const playerId = this.findNearestPlayer(monsterId);
    if (!playerId) return;

    const monsterPos = this.world.getComponent(monsterId, 'position') as any;
    const playerPos = this.world.getComponent(playerId, 'position') as any;
    
    if (!monsterPos || !playerPos) return;

    const distance = Math.sqrt(
      Math.pow(monsterPos.x - playerPos.x, 2) + 
      Math.pow(monsterPos.y - playerPos.y, 2)
    );

    if (distance <= 5) { // Longer detection range
      if (distance <= 1) { // Attack range
        // Attack player
        const result = this.combatSystem.executeAttack(monsterId, playerId);
        if (result) {
          console.log(`⚔️ ${result.message}`);
        }
      } else {
        // Move towards player (faster movement)
        this.moveTowardsTarget(monsterId, playerPos);
        this.moveTowardsTarget(monsterId, playerPos); // Move twice for aggressive monsters
      }
    }
  }

  /**
   * Process boss AI
   */
  private processBossAI(monsterId: EntityId): void {
    // Boss monsters have special abilities and longer range attacks
    const playerId = this.findNearestPlayer(monsterId);
    if (!playerId) return;

    const monsterPos = this.world.getComponent(monsterId, 'position') as any;
    const playerPos = this.world.getComponent(playerId, 'position') as any;
    
    if (!monsterPos || !playerPos) return;

    const distance = Math.sqrt(
      Math.pow(monsterPos.x - playerPos.x, 2) + 
      Math.pow(monsterPos.y - playerPos.y, 2)
    );

    if (distance <= 8) { // Very long detection range
      if (distance <= 2) { // Extended attack range
        // Attack player
        const result = this.combatSystem.executeAttack(monsterId, playerId);
        if (result) {
          console.log(`👹 ${result.message}`);
        }
      } else {
        // Move towards player
        this.moveTowardsTarget(monsterId, playerPos);
      }
    }
  }

  /**
   * Find nearest player entity
   */
  private findNearestPlayer(monsterId: EntityId): EntityId | null {
    const entities = this.world.getEntityIds();
    let nearestPlayer: EntityId | null = null;
    let nearestDistance = Infinity;

    for (const entityId of entities) {
      if (PlayerUtils.isPlayer(this.world, entityId)) {
        const monsterPos = this.world.getComponent(monsterId, 'position') as any;
        const playerPos = this.world.getComponent(entityId, 'position') as any;
        
        if (monsterPos && playerPos) {
          const distance = Math.sqrt(
            Math.pow(monsterPos.x - playerPos.x, 2) + 
            Math.pow(monsterPos.y - playerPos.y, 2)
          );
          
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestPlayer = entityId;
          }
        }
      }
    }

    return nearestPlayer;
  }

  /**
   * Move entity towards target position
   */
  private moveTowardsTarget(entityId: EntityId, targetPos: { x: number; y: number }): void {
    const entityPos = this.world.getComponent(entityId, 'position') as any;
    if (!entityPos) return;

    // Simple movement: move one step towards target
    const dx = targetPos.x - entityPos.x;
    const dy = targetPos.y - entityPos.y;
    
    let newX = entityPos.x;
    let newY = entityPos.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      // Move horizontally
      newX += dx > 0 ? 1 : -1;
    } else {
      // Move vertically
      newY += dy > 0 ? 1 : -1;
    }

    // Create new position component
    const newPos = {
      id: `position_${Date.now()}_${Math.random()}`,
      type: 'position',
      x: newX,
      y: newY
    };

    // Update position
    this.world.removeComponent(entityId, 'position');
    this.world.addComponent(entityId, newPos);
  }

  /**
   * Process item effects
   */
  private processItemEffects(): void {
    // Item effects are processed when items are used
    // This method can be used for passive item effects
  }

  /**
   * Game over handler
   */
  private gameOver(): void {
    console.log('💀 GAME OVER');
    this.pause();
    // Additional game over logic can be added here
  }

  /**
   * Update frame time history for FPS calculation
   */
  private updateFrameTimeHistory(deltaTime: number): void {
    this.frameTimeHistory.push(deltaTime);
    
    // Keep only last 60 frames for FPS calculation
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift();
    }
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const averageFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
    return Math.round(1000 / averageFrameTime);
  }

  /**
   * Get game statistics
   */
  getGameStats(): {
    fps: number;
    entityCount: number;
    systemCount: number;
    gameTime: number;
    frameCount: number;
    worldStats: any;
  } {
    return {
      fps: this.getFPS(),
      entityCount: this.world.getStats().entityCount,
      systemCount: this.world.getStats().systemCount,
      gameTime: this.state.gameTime,
      frameCount: this.state.frameCount,
      worldStats: this.world.getStats()
    };
  }

  /**
   * Get ECS world
   */
  getWorld(): World {
    return this.world;
  }

  /**
   * Get combat system
   */
  getCombatSystem(): ECSCombatSystem {
    return this.combatSystem;
  }

  /**
   * Get hunger system
   */
  getHungerSystem(): ECSHungerSystem {
    return this.hungerSystem;
  }

  /**
   * Get item system
   */
  getItemSystem(): ECSItemSystem {
    return this.itemSystem;
  }

  /**
   * Create player entity
   */
  createPlayer(name: string, position: { x: number; y: number }, level: number = 1): EntityId {
    const player = PlayerPrefab.createAtLevel(this.world, name, position, level);
    return player.id;
  }

  /**
   * Create monster entity
   */
  createMonster(monsterType: string, position: { x: number; y: number }, level: number = 1): EntityId | null {
    const monster = MonsterPrefab.create(this.world, monsterType as any, position, level);
    return monster ? monster.id : null;
  }

  /**
   * Get entity position
   */
  getEntityPosition(entityId: EntityId): { x: number; y: number } | null {
    const position = this.world.getComponent(entityId, 'position') as any;
    return position ? { x: position.x, y: position.y } : null;
  }

  /**
   * Move entity to position
   */
  moveEntity(entityId: EntityId, position: { x: number; y: number }): boolean {
    const currentPos = this.world.getComponent(entityId, 'position') as any;
    if (!currentPos) return false;

    const newPos = {
      id: `position_${Date.now()}_${Math.random()}`,
      type: 'position',
      x: position.x,
      y: position.y
    };

    this.world.removeComponent(entityId, 'position');
    this.world.addComponent(entityId, newPos);
    return true;
  }

  /**
   * Execute attack between entities
   */
  executeAttack(attackerId: EntityId, defenderId: EntityId): any {
    return this.combatSystem.executeAttack(attackerId, defenderId);
  }

  /**
   * Use item from entity's inventory
   */
  useItem(entityId: EntityId, itemId: string, targetId?: EntityId): any {
    return this.itemSystem.useItem(entityId, itemId, targetId);
  }

  /**
   * Process hunger for entity
   */
  processEntityHunger(entityId: EntityId): any {
    // This would typically be called by the hunger system automatically
    // But can be called manually for testing
    // Note: This method is not available in the current hunger system
    // It will be implemented when needed
    return null;
  }
}
