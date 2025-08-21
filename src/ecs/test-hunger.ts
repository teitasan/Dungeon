/**
 * ECS Hunger System Test
 */

import { World } from './core/World.js';
import { PositionComponentFactory } from './components/common/Position.js';
import { HealthComponentFactory } from './components/common/Health.js';
import { AttackComponentFactory } from './components/combat/Attack.js';
import { DefenseComponentFactory } from './components/combat/Defense.js';
import { HungerComponentFactory, HungerUtils } from './components/status/Hunger.js';
import { ECSHungerSystem } from './systems/status/HungerSystem.js';

/**
 * Test ECS hunger system
 */
export function testHungerSystem(): void {
  console.log('🍖 Testing ECS Hunger System...');

  // Create ECS world
  const world = new World();

  // Create hunger configuration
  const hungerConfig = {
    maxValue: 100,
    decreaseRate: 1,
    minValue: 0,
    damageAmount: 5,
    recoveryAmount: 1,
    maxOverfeedTime: 10
  };

  // Add hunger system
  const hungerSystem = new ECSHungerSystem(world.getComponentManager(), hungerConfig);
  world.addSystem(hungerSystem);

  // Initialize systems
  world.initialize();

  // Create test entities
  console.log('🍽️ Creating entities with hunger...');

  // Well-fed player
  const player = world.createEntityWithComponents(
    PositionComponentFactory.create(5, 5),
    HealthComponentFactory.createFull(30),
    AttackComponentFactory.createPlayer(1),
    DefenseComponentFactory.createPlayer(1),
    HungerComponentFactory.createFull(100)
  );

  // Hungry companion
  const companion = world.createEntityWithComponents(
    PositionComponentFactory.create(6, 5),
    HealthComponentFactory.createFull(20),
    AttackComponentFactory.createNormal(),
    DefenseComponentFactory.createNormal(),
    HungerComponentFactory.create(15, 100) // Hungry
  );

  // Starving creature
  const starvingCreature = world.createEntityWithComponents(
    PositionComponentFactory.create(7, 5),
    HealthComponentFactory.createFull(25),
    AttackComponentFactory.createWeak(),
    DefenseComponentFactory.createWeak(),
    HungerComponentFactory.createStarving(100)
  );

  console.log(`✅ Created ${world.getStats().entityCount} entities with hunger`);

  // Display initial hunger states
  console.log('\n🍽️ Initial Hunger States:');
  console.log(`Player: ${HungerUtils.getHungerPercentage(world.getComponent(player.id, 'hunger') as any)}% (${HungerUtils.getHungerState(world.getComponent(player.id, 'hunger') as any)})`);
  console.log(`Companion: ${HungerUtils.getHungerPercentage(world.getComponent(companion.id, 'hunger') as any)}% (${HungerUtils.getHungerState(world.getComponent(companion.id, 'hunger') as any)})`);
  console.log(`Starving: ${HungerUtils.getHungerPercentage(world.getComponent(starvingCreature.id, 'hunger') as any)}% (${HungerUtils.getHungerState(world.getComponent(starvingCreature.id, 'hunger') as any)})`);

  // Simulate hunger over time
  console.log('\n⏰ Simulating hunger over time...');
  
  for (let turn = 1; turn <= 10; turn++) {
    console.log(`\nTurn ${turn}:`);
    
    // Update world (this will process hunger)
    world.update(1.0); // 1 second per turn
    
    // Display hunger results
    const results = hungerSystem.getHungerResults();
    for (const result of results) {
      if (result.stateChanged || result.damageApplied > 0) {
        console.log(`   ${result.message}`);
        
        if (result.damageApplied > 0) {
          const health = world.getComponent(result.entityId, 'health') as any;
          console.log(`     HP: ${health?.current}/${health?.maximum}`);
        }
      }
    }
    
    // Check if any entity died from starvation
    const starvingHealth = world.getComponent(starvingCreature.id, 'health') as any;
    if (starvingHealth && starvingHealth.current <= 0) {
      console.log(`   💀 ${starvingCreature.id} died from starvation!`);
      break;
    }
  }

  // Test feeding
  console.log('\n🍞 Testing feeding...');
  
  // Feed the companion
  const breadFood = { hungerValue: 30 };
  const feedResult = hungerSystem.feedEntity(companion.id, breadFood);
  if (feedResult) {
    console.log(`   ${feedResult.message}`);
    console.log(`   Hunger: ${feedResult.previousHunger} → ${feedResult.currentHunger}`);
  }

  // Feed the starving creature (if still alive)
  const starvingHealth = world.getComponent(starvingCreature.id, 'health') as any;
  if (starvingHealth && starvingHealth.current > 0) {
    const bigMealFood = { hungerValue: 80 };
    const starvingFeedResult = hungerSystem.feedEntity(starvingCreature.id, bigMealFood);
    if (starvingFeedResult) {
      console.log(`   ${starvingFeedResult.message}`);
      console.log(`   Hunger: ${starvingFeedResult.previousHunger} → ${starvingFeedResult.currentHunger}`);
    }
  }

  // Display final hunger states
  console.log('\n🍽️ Final Hunger States:');
  console.log(`Player: ${HungerUtils.getHungerPercentage(world.getComponent(player.id, 'hunger') as any)}% (${HungerUtils.getHungerState(world.getComponent(player.id, 'hunger') as any)})`);
  console.log(`Companion: ${HungerUtils.getHungerPercentage(world.getComponent(companion.id, 'hunger') as any)}% (${HungerUtils.getHungerState(world.getComponent(companion.id, 'hunger') as any)})`);
  
  const finalStarvingHunger = world.getComponent(starvingCreature.id, 'hunger') as any;
  if (finalStarvingHunger) {
    console.log(`Starving: ${HungerUtils.getHungerPercentage(finalStarvingHunger)}% (${HungerUtils.getHungerState(finalStarvingHunger)})`);
  } else {
    console.log(`Starving: Entity no longer exists`);
  }

  console.log('\n✅ ECS Hunger System test completed!');
}

/**
 * Test hunger state effects
 */
export function testHungerStates(): void {
  console.log('\n🎭 Testing Hunger State Effects...');

  const world = new World();
  const hungerConfig = {
    maxValue: 100,
    decreaseRate: 1,
    minValue: 0,
    damageAmount: 5,
    recoveryAmount: 1,
    maxOverfeedTime: 10
  };

  const hungerSystem = new ECSHungerSystem(world.getComponentManager(), hungerConfig);
  world.addSystem(hungerSystem);
  world.initialize();

  // Create entity with full stats
  const entity = world.createEntityWithComponents(
    PositionComponentFactory.create(0, 0),
    HealthComponentFactory.createFull(30),
    AttackComponentFactory.create(10, 0.05, 1.0, 0),
    DefenseComponentFactory.create(5, 0.05, 0.0, 0),
    HungerComponentFactory.createFull(100)
  );

  console.log('\n📊 Testing stat modifiers by hunger state:');

  // Test each hunger state
  const testStates = [100, 75, 35, 15, 3, 0]; // full, satisfied, hungry, very-hungry, starving
  
  for (const hungerValue of testStates) {
    hungerSystem.setHunger(entity.id, hungerValue);
    
    const hunger = world.getComponent(entity.id, 'hunger') as any;
    const attack = world.getComponent(entity.id, 'attack') as any;
    const defense = world.getComponent(entity.id, 'defense') as any;
    const health = world.getComponent(entity.id, 'health') as any;
    
    const state = HungerUtils.getHungerState(hunger);
    
    console.log(`   ${state.toUpperCase()}: Attack=${attack?.power}, Defense=${defense?.value}, HP=${health?.current}/${health?.maximum}`);
  }

  console.log('\n✅ Hunger state effects test completed!');
}
