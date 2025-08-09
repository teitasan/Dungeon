import { Game } from './Game.js';

/**
 * Main entry point for the mystery dungeon game
 */
async function main() {
  try {
    console.log('Starting Mystery Dungeon Game...');
    
    const game = new Game();
    await game.initialize();
    
    console.log('Game ready!');
    console.log('Configuration loaded:', game.getConfig());
    
  } catch (error) {
    console.error('Failed to start game:', error);
    process.exit(1);
  }
}

// Run the game if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Game };
export * from './types/core.js';
export * from './core/ConfigLoader.js';
export * from './core/Component.js';
export * from './core/ComponentRegistry.js';
export * from './core/ComponentSystem.js';