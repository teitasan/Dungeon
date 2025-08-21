/**
 * ECS Combat System Test
 */

import { World } from './core/World.js';
import { PositionComponentFactory } from './components/common/Position.js';
import { HealthComponentFactory } from './components/common/Health.js';
import { AttackComponentFactory } from './components/combat/Attack.js';
import { DefenseComponentFactory } from './components/combat/Defense.js';
import { ECSCombatSystem } from './systems/combat/CombatSystem.js';

/**
 * Test ECS combat system
 */
export function testCombatSystem(): void {
  console.log('⚔️ Testing ECS Combat System...');

  // Create ECS world
  const world = new World();

  // Create combat configuration
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

  // Add combat system
  const combatSystem = new ECSCombatSystem(world.getComponentManager(), combatConfig);
  world.addSystem(combatSystem);

  // Initialize systems
  world.initialize();

  // Create test entities
  console.log('🛡️ Creating combat entities...');

  // Player entity (strong)
  const player = world.createEntityWithComponents(
    PositionComponentFactory.create(5, 5),
    HealthComponentFactory.createFull(30),
    AttackComponentFactory.createPlayer(3), // Level 3 player
    DefenseComponentFactory.createPlayer(3)
  );

  // Weak monster
  const weakMonster = world.createEntityWithComponents(
    PositionComponentFactory.create(5, 6), // Adjacent to player
    HealthComponentFactory.createFull(15),
    AttackComponentFactory.createWeak(),
    DefenseComponentFactory.createWeak()
  );

  // Strong monster
  const strongMonster = world.createEntityWithComponents(
    PositionComponentFactory.create(6, 5), // Adjacent to player
    HealthComponentFactory.createFull(25),
    AttackComponentFactory.createStrong(),
    DefenseComponentFactory.createStrong()
  );

  console.log(`✅ Created ${world.getStats().entityCount} combat entities`);

  // Display initial stats
  console.log('\n📊 Initial Stats:');
  const playerHealth = world.getComponent(player.id, 'health') as any;
  const weakHealth = world.getComponent(weakMonster.id, 'health') as any;
  const strongHealth = world.getComponent(strongMonster.id, 'health') as any;
  
  console.log(`Player: HP=${playerHealth?.current}/${playerHealth?.maximum}`);
  console.log(`Weak Monster: HP=${weakHealth?.current}/${weakHealth?.maximum}`);
  console.log(`Strong Monster: HP=${strongHealth?.current}/${strongHealth?.maximum}`);

  // Test combat scenarios
  console.log('\n⚔️ Combat Scenarios:');

  // Scenario 1: Player attacks weak monster
  console.log('\n1. Player vs Weak Monster:');
  let result = combatSystem.executeAttack(player.id, weakMonster.id);
  if (result) {
    console.log(`   ${result.message}`);
    console.log(`   Damage: ${result.actualDamage} (Critical: ${result.critical})`);
  }

  // Scenario 2: Weak monster attacks player
  console.log('\n2. Weak Monster vs Player:');
  result = combatSystem.executeAttack(weakMonster.id, player.id);
  if (result) {
    console.log(`   ${result.message}`);
    console.log(`   Damage: ${result.actualDamage} (Critical: ${result.critical})`);
  }

  // Scenario 3: Player attacks strong monster
  console.log('\n3. Player vs Strong Monster:');
  result = combatSystem.executeAttack(player.id, strongMonster.id);
  if (result) {
    console.log(`   ${result.message}`);
    console.log(`   Damage: ${result.actualDamage} (Critical: ${result.critical})`);
  }

  // Scenario 4: Strong monster attacks player
  console.log('\n4. Strong Monster vs Player:');
  result = combatSystem.executeAttack(strongMonster.id, player.id);
  if (result) {
    console.log(`   ${result.message}`);
    console.log(`   Damage: ${result.actualDamage} (Critical: ${result.critical})`);
  }

  // Display final stats
  console.log('\n📊 Final Stats:');
  const finalPlayerHealth = world.getComponent(player.id, 'health') as any;
  const finalWeakHealth = world.getComponent(weakMonster.id, 'health') as any;
  const finalStrongHealth = world.getComponent(strongMonster.id, 'health') as any;
  
  console.log(`Player: HP=${finalPlayerHealth?.current}/${finalPlayerHealth?.maximum}`);
  console.log(`Weak Monster: HP=${finalWeakHealth?.current}/${finalWeakHealth?.maximum}`);
  console.log(`Strong Monster: HP=${finalStrongHealth?.current}/${finalStrongHealth?.maximum}`);

  // Test combat preview
  console.log('\n🔮 Combat Preview Test:');
  const preview = combatSystem.getCombatPreview(player.id, strongMonster.id);
  if (preview) {
    console.log(`   Damage Range: ${preview.minDamage}-${preview.maxDamage} (avg: ${preview.averageDamage})`);
    console.log(`   Critical Damage: ${preview.criticalDamage}`);
    console.log(`   Hit Chance: ${Math.round(preview.hitChance * 100)}%`);
    console.log(`   Critical Chance: ${Math.round(preview.criticalChance * 100)}%`);
  }

  // Display combat log
  console.log('\n📜 Combat Log:');
  const log = combatSystem.getCombatLog();
  log.forEach((entry, index) => {
    console.log(`   ${index + 1}. ${entry.result.message}`);
  });

  console.log('\n✅ ECS Combat System test completed!');
}

/**
 * Test deterministic combat (for testing)
 */
export function testDeterministicCombat(): void {
  console.log('\n🎯 Testing Deterministic Combat...');

  const world = new World();
  const combatConfig = {
    attackMultiplier: 1.3,
    defenseBase: 35/36,
    randomRangeMin: 1.0, // No randomness for testing
    randomRangeMax: 1.0,
    minimumDamage: 1,
    baseCriticalChance: 0.0, // No criticals for testing
    criticalMultiplier: 2.0,
    baseEvasionRate: 0.0, // No evasion for testing
    evasionEnabled: false
  };

  const combatSystem = new ECSCombatSystem(world.getComponentManager(), combatConfig);
  combatSystem.setRNG(() => 0.5); // Deterministic RNG
  world.addSystem(combatSystem);
  world.initialize();

  // Create predictable entities
  const attacker = world.createEntityWithComponents(
    PositionComponentFactory.create(0, 0),
    HealthComponentFactory.createFull(20),
    AttackComponentFactory.create(10, 0, 1.0, 0), // 10 attack, no crit, perfect accuracy
    DefenseComponentFactory.create(0, 0, 0, 0) // No defense
  );

  const defender = world.createEntityWithComponents(
    PositionComponentFactory.create(0, 1), // Adjacent
    HealthComponentFactory.createFull(20),
    AttackComponentFactory.create(5, 0, 1.0, 0), // 5 attack
    DefenseComponentFactory.create(3, 0, 0, 0) // 3 defense
  );

  console.log('\n🧮 Predictable Combat Test:');
  
  // Expected damage: 10 * 1.3 * (35/36)^3 * 1.0 = 13 * 0.9188 ≈ 11.94 → 11
  const result = combatSystem.executeAttack(attacker.id, defender.id);
  if (result) {
    console.log(`   Expected damage: ~11-12`);
    console.log(`   Actual damage: ${result.actualDamage}`);
    console.log(`   Formula result matches: ${result.actualDamage >= 11 && result.actualDamage <= 12}`);
  }

  console.log('\n✅ Deterministic combat test completed!');
}
