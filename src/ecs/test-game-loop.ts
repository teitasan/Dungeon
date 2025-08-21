/**
 * ECS Game Loop Test
 */

import { ECSGameLoop } from './GameLoop.js';

/**
 * Test ECS game loop functionality
 */
export function testGameLoop(): void {
  console.log('🎮 Testing ECS Game Loop...');

  // Create game loop with configuration
  const gameLoop = new ECSGameLoop({
    targetFPS: 60,
    enableProfiling: true,
    enableDebugging: true,
    maxFrameTime: 100 // 100ms max frame time
  });

  // Create test entities
  console.log('👥 Creating test entities...');
  
  const playerId = gameLoop.createPlayer('Hero', { x: 10, y: 10 }, 3);
  const goblinId = gameLoop.createMonster('goblin', { x: 12, y: 10 }, 2);
  const orcId = gameLoop.createMonster('orc', { x: 15, y: 10 }, 3);
  const slimeId = gameLoop.createMonster('slime', { x: 8, y: 10 }, 1);

  if (!goblinId || !orcId || !slimeId) {
    console.log('❌ Failed to create some monsters');
    return;
  }

  console.log(`✅ Created entities: Player=${playerId}, Goblin=${goblinId}, Orc=${orcId}, Slime=${slimeId}`);

  // Display initial positions
  console.log('\n📍 Initial positions:');
  console.log(`Player: ${JSON.stringify(gameLoop.getEntityPosition(playerId))}`);
  console.log(`Goblin: ${JSON.stringify(gameLoop.getEntityPosition(goblinId))}`);
  console.log(`Orc: ${JSON.stringify(gameLoop.getEntityPosition(orcId))}`);
  console.log(`Slime: ${JSON.stringify(gameLoop.getEntityPosition(slimeId))}`);

  // Test combat system
  console.log('\n⚔️ Testing combat system...');
  
  // Player attacks goblin
  const combatResult = gameLoop.executeAttack(playerId, goblinId);
  if (combatResult) {
    console.log(`   ${combatResult.message}`);
    console.log(`   Damage: ${combatResult.actualDamage}, Critical: ${combatResult.critical}`);
  }

  // Test item system
  console.log('\n🎒 Testing item system...');
  
  // Create and use health potion
  const healthPotion = {
    hungerValue: 0,
    specialEffects: []
  };
  
  const feedResult = gameLoop.getHungerSystem().feedEntity(playerId, healthPotion);
  if (feedResult) {
    console.log(`   ${feedResult.message}`);
  }

  // Test movement
  console.log('\n🚶 Testing movement...');
  
  const newPosition = { x: 11, y: 10 };
  const moved = gameLoop.moveEntity(playerId, newPosition);
  console.log(`   Player moved to ${JSON.stringify(newPosition)}: ${moved}`);
  
  const currentPos = gameLoop.getEntityPosition(playerId);
  console.log(`   Current position: ${JSON.stringify(currentPos)}`);

  // Start game loop for a short time
  console.log('\n🔄 Starting game loop for 3 seconds...');
  
  gameLoop.start();
  
  // Let it run for 3 seconds
  setTimeout(() => {
    gameLoop.pause();
    
    // Display game statistics
    console.log('\n📊 Game Statistics:');
    const stats = gameLoop.getGameStats();
    console.log(`   FPS: ${stats.fps}`);
    console.log(`   Entities: ${stats.entityCount}`);
    console.log(`   Systems: ${stats.systemCount}`);
    console.log(`   Game Time: ${Math.round(stats.gameTime)}ms`);
    console.log(`   Frame Count: ${stats.frameCount}`);
    
    // Display final positions
    console.log('\n📍 Final positions:');
    console.log(`Player: ${JSON.stringify(gameLoop.getEntityPosition(playerId))}`);
    console.log(`Goblin: ${JSON.stringify(gameLoop.getEntityPosition(goblinId))}`);
    console.log(`Orc: ${JSON.stringify(gameLoop.getEntityPosition(orcId))}`);
    console.log(`Slime: ${JSON.stringify(gameLoop.getEntityPosition(slimeId))}`);
    
    // Stop game loop
    gameLoop.stop();
    
    console.log('\n✅ ECS Game Loop test completed!');
  }, 3000);
}

/**
 * Test game loop with AI behavior
 */
export function testGameLoopAI(): void {
  console.log('\n🤖 Testing Game Loop AI...');

  const gameLoop = new ECSGameLoop({
    targetFPS: 30, // Lower FPS for AI testing
    enableProfiling: true,
    enableDebugging: true,
    maxFrameTime: 100
  });

  // Create player and monsters in strategic positions
  const playerId = gameLoop.createPlayer('Hero', { x: 5, y: 5 }, 1);
  const goblinId = gameLoop.createMonster('goblin', { x: 8, y: 5 }, 1);
  const orcId = gameLoop.createMonster('orc', { x: 12, y: 5 }, 2);
  const slimeId = gameLoop.createMonster('slime', { x: 3, y: 5 }, 1);

  if (!goblinId || !orcId || !slimeId) {
    console.log('❌ Failed to create monsters for AI test');
    return;
  }

  console.log('🎯 AI Test Setup:');
  console.log(`   Player at (5,5) - Level 1`);
  console.log(`   Goblin at (8,5) - Level 1 (basic-hostile)`);
  console.log(`   Orc at (12,5) - Level 2 (aggressive)`);
  console.log(`   Slime at (3,5) - Level 1 (passive)`);

  // Start game loop
  gameLoop.start();

  // Monitor AI behavior for 5 seconds
  const aiMonitor = setInterval(() => {
    const stats = gameLoop.getGameStats();
    const playerPos = gameLoop.getEntityPosition(playerId);
    const goblinPos = gameLoop.getEntityPosition(goblinId);
    const orcPos = gameLoop.getEntityPosition(orcId);
    const slimePos = gameLoop.getEntityPosition(slimeId);
    
    console.log(`\n⏱️  Frame ${stats.frameCount} (${Math.round(stats.gameTime)}ms):`);
    console.log(`   Player: ${JSON.stringify(playerPos)}`);
    console.log(`   Goblin: ${JSON.stringify(goblinPos)}`);
    console.log(`   Orc: ${JSON.stringify(orcPos)}`);
    console.log(`   Slime: ${JSON.stringify(slimePos)}`);
    
    // Check if any monster reached player
    if (goblinPos && playerPos && Math.abs(goblinPos.x - playerPos.x) <= 1 && Math.abs(goblinPos.y - playerPos.y) <= 1) {
      console.log('   ⚔️ Goblin reached player!');
    }
    
    if (orcPos && playerPos && Math.abs(orcPos.x - playerPos.x) <= 1 && Math.abs(orcPos.y - playerPos.y) <= 1) {
      console.log('   ⚔️ Orc reached player!');
    }
    
    if (slimePos && playerPos && Math.abs(slimePos.x - playerPos.x) <= 1 && Math.abs(slimePos.y - playerPos.y) <= 1) {
      console.log('   ⚔️ Slime reached player!');
    }
  }, 1000);

  // Stop after 5 seconds
  setTimeout(() => {
    clearInterval(aiMonitor);
    gameLoop.stop();
    
    console.log('\n📊 AI Test Results:');
    const finalStats = gameLoop.getGameStats();
    console.log(`   Total Frames: ${finalStats.frameCount}`);
    console.log(`   Average FPS: ${finalStats.fps}`);
    console.log(`   Entities: ${finalStats.entityCount}`);
    
    console.log('\n✅ AI test completed!');
  }, 5000);
}
