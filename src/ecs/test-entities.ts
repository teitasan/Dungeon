/**
 * ECS Entity Prefabs Test
 */

import { World } from './core/World.js';
import { PlayerPrefab, PlayerUtils } from '../game/entities/prefabs/PlayerPrefab.js';
import { MonsterPrefab, MonsterUtils } from '../game/entities/prefabs/MonsterPrefab.js';
import { ECSCombatSystem } from './systems/combat/CombatSystem.js';
import { ECSHungerSystem } from './systems/status/HungerSystem.js';
import { ECSItemSystem } from './systems/common/ItemSystem.js';

/**
 * Test entity prefabs
 */
export function testEntityPrefabs(): void {
  console.log('👥 Testing ECS Entity Prefabs...');

  // Initialize monster templates
  MonsterPrefab.initialize();

  // Create ECS world
  const world = new World();

  // Add systems
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

  const hungerConfig = {
    maxValue: 100,
    decreaseRate: 1,
    minValue: 0,
    damageAmount: 5,
    recoveryAmount: 1,
    maxOverfeedTime: 10
  };

  world.addSystem(new ECSCombatSystem(world.getComponentManager(), combatConfig));
  world.addSystem(new ECSHungerSystem(world.getComponentManager(), hungerConfig));
  world.addSystem(new ECSItemSystem(world.getComponentManager()));

  // Initialize systems
  world.initialize();

  // Create test entities
  console.log('🧙 Creating player...');
  const player = PlayerPrefab.createBeginner(world, 'Hero', { x: 10, y: 10 });
  
  console.log('👹 Creating monsters...');
  const goblin = MonsterPrefab.create(world, 'goblin', { x: 10, y: 11 }, 1);
  const orc = MonsterPrefab.create(world, 'orc', { x: 11, y: 10 }, 2);
  const slime = MonsterPrefab.create(world, 'slime', { x: 9, y: 10 }, 1);

  if (!goblin || !orc || !slime) {
    console.log('❌ Failed to create monsters');
    return;
  }

  console.log(`✅ Created ${world.getStats().entityCount} entities`);

  // Display entity information
  console.log('\n📊 Entity Information:');
  
  // Player stats
  const playerStats = PlayerUtils.getStats(world, player.id);
  if (playerStats) {
    console.log(`Player "${playerStats.name}" (Level ${playerStats.level}):`);
    console.log(`   HP: ${playerStats.health.current}/${playerStats.health.maximum}`);
    console.log(`   Hunger: ${playerStats.hunger.current}/${playerStats.hunger.maximum}`);
    console.log(`   Attack: ${playerStats.attack}, Defense: ${playerStats.defense}`);
    console.log(`   Inventory: ${playerStats.inventoryUsage.current}/${playerStats.inventoryUsage.max}`);
  }

  // Monster stats
  console.log('\nMonsters:');
  for (const monster of [goblin, orc, slime]) {
    const name = MonsterUtils.getName(world, monster.id);
    const type = MonsterUtils.getMonsterType(world, monster.id);
    const level = MonsterUtils.getLevel(world, monster.id);
    const aiType = MonsterUtils.getAIType(world, monster.id);
    const expValue = MonsterUtils.getExperienceValue(world, monster.id);
    const health = world.getComponent(monster.id, 'health') as any;
    const attack = world.getComponent(monster.id, 'attack') as any;
    const defense = world.getComponent(monster.id, 'defense') as any;
    
    console.log(`   ${name} (${type}, Level ${level}, AI: ${aiType}):`);
    console.log(`     HP: ${health?.current}/${health?.maximum}`);
    console.log(`     Attack: ${attack?.power}, Defense: ${defense?.value}`);
    console.log(`     Experience Value: ${expValue}`);
    console.log(`     Hostile: ${MonsterUtils.isHostile(world, monster.id)}`);
  }

  console.log('\n✅ ECS Entity Prefabs test completed!');
}

/**
 * Test player progression
 */
export function testPlayerProgression(): void {
  console.log('\n📈 Testing Player Progression...');

  MonsterPrefab.initialize();
  const world = new World();
  world.initialize();

  // Create level 1 player
  const player = PlayerPrefab.createBeginner(world, 'Adventurer', { x: 0, y: 0 });

  console.log('\n🎯 Level progression test:');
  
  for (let targetLevel = 1; targetLevel <= 5; targetLevel++) {
    const stats = PlayerUtils.getStats(world, player.id);
    if (stats) {
      console.log(`Level ${stats.level}: HP=${stats.health.maximum}, ATK=${stats.attack}, DEF=${stats.defense}`);
    }

    // Level up if not at target level
    if (targetLevel < 5) {
      PlayerUtils.levelUp(world, player.id);
    }
  }

  console.log('\n💎 Experience system test:');
  
  // Reset to level 1
  const newPlayer = PlayerPrefab.createBeginner(world, 'Tester', { x: 0, y: 0 });
  
  // Add experience gradually
  const experienceAmounts = [20, 30, 25, 35]; // Should level up after 100 total
  let totalExp = 0;
  
  for (const exp of experienceAmounts) {
    totalExp += exp;
    const leveledUp = PlayerUtils.addExperience(world, newPlayer.id, exp);
    const stats = PlayerUtils.getStats(world, newPlayer.id);
    
    console.log(`   Added ${exp} exp (total: ${totalExp}): Level ${stats?.level}, ${leveledUp ? 'LEVEL UP!' : 'no level up'}`);
  }

  console.log('\n✅ Player progression test completed!');
}

/**
 * Test monster variety
 */
export function testMonsterVariety(): void {
  console.log('\n🎭 Testing Monster Variety...');

  MonsterPrefab.initialize();
  const world = new World();
  world.initialize();

  console.log('\n🏭 Creating monsters of each type:');
  
  const monsterTypes = MonsterPrefab.getAllMonsterTypes();
  const monsters: any[] = [];
  
  for (const type of monsterTypes) {
    const monster = MonsterPrefab.create(world, type, { x: 0, y: 0 }, 3); // Level 3
    if (monster) {
      monsters.push(monster);
      
      const name = MonsterUtils.getName(world, monster.id);
      const aiType = MonsterUtils.getAIType(world, monster.id);
      const health = world.getComponent(monster.id, 'health') as any;
      const attack = world.getComponent(monster.id, 'attack') as any;
      const defense = world.getComponent(monster.id, 'defense') as any;
      
      console.log(`   ${name} (${type}): HP=${health?.maximum}, ATK=${attack?.power}, DEF=${defense?.value}, AI=${aiType}`);
    }
  }

  console.log('\n🎲 Testing random monster generation:');
  
  for (let level = 1; level <= 5; level++) {
    const randomMonster = MonsterPrefab.createRandom(world, { x: level, y: 0 }, level);
    if (randomMonster) {
      const name = MonsterUtils.getName(world, randomMonster.id);
      const type = MonsterUtils.getMonsterType(world, randomMonster.id);
      console.log(`   Level ${level}: ${name} (${type})`);
    }
  }

  console.log('\n✅ Monster variety test completed!');
}
