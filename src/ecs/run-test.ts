/**
 * Run ECS Tests
 */

import { testECSSystem, testComponents } from './test-ecs.js';
import { testCombatSystem, testDeterministicCombat } from './test-combat.js';
import { testHungerSystem, testHungerStates } from './test-hunger.js';
import { testItemSystem, testItemTemplates } from './test-items.js';
import { testEntityPrefabs, testPlayerProgression, testMonsterVariety } from './test-entities.js';
import { testGameLoop, testGameLoopAI } from './test-game-loop.js';

console.log('🚀 Starting ECS Tests...\n');

// Test components first
testComponents();

// Test basic ECS system
testECSSystem();

// Test combat system
testCombatSystem();

// Test deterministic combat
testDeterministicCombat();

// Test hunger system
testHungerSystem();

// Test hunger state effects
testHungerStates();

// Test item system
testItemSystem();

// Test item templates
testItemTemplates();

// Test entity prefabs
testEntityPrefabs();

// Test player progression
testPlayerProgression();

// Test monster variety
testMonsterVariety();

// Test game loop
testGameLoop();

// Test game loop AI
testGameLoopAI();

console.log('\n🎉 All tests completed!');
