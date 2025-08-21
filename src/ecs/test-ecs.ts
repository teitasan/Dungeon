/**
 * ECS System Test - verify ECS architecture implementation
 */

import { World } from './core/World.js';
import { PositionComponentFactory } from './components/common/Position.js';
import { MovementSystem, VelocityComponentFactory } from './systems/movement/MovementSystem.js';

/**
 * Test ECS system functionality
 */
export function testECSSystem(): void {
  console.log('🧪 Testing ECS System...');

  // Create ECS world
  const world = new World({
    maxEntities: 1000,
    enableProfiling: true,
    enableDebugging: true
  });

  // Add movement system
  const movementSystem = new MovementSystem(world.getComponentManager());
  world.addSystem(movementSystem);

  // Initialize systems
  world.initialize();

  // Create test entities
  console.log('📦 Creating test entities...');

  // Entity 1: Stationary entity
  const stationaryEntity = world.createEntityWithComponents(
    PositionComponentFactory.create(10, 10),
    VelocityComponentFactory.createStationary()
  );

  // Entity 2: Moving entity
  const movingEntity = world.createEntityWithComponents(
    PositionComponentFactory.create(0, 0),
    VelocityComponentFactory.create(1, 1) // Move diagonally
  );

  // Entity 3: Fast moving entity
  const fastEntity = world.createEntityWithComponents(
    PositionComponentFactory.create(50, 50),
    VelocityComponentFactory.create(2, -1) // Move right and up
  );

  console.log(`✅ Created ${world.getStats().entityCount} entities`);

  // Test initial state
  console.log('\n📍 Initial positions:');
  const stationaryPos = world.getComponent(stationaryEntity.id, 'position') as any;
  const movingPos = world.getComponent(movingEntity.id, 'position') as any;
  const fastPos = world.getComponent(fastEntity.id, 'position') as any;
  
  console.log(`Stationary: (${stationaryPos?.x}, ${stationaryPos?.y})`);
  console.log(`Moving: (${movingPos?.x}, ${movingPos?.y})`);
  console.log(`Fast: (${fastPos?.x}, ${fastPos?.y})`);

  // Simulate game loop
  console.log('\n🔄 Simulating game loop...');
  
  const deltaTime = 1.0 / 60.0; // 60 FPS
  
  for (let frame = 1; frame <= 5; frame++) {
    console.log(`\nFrame ${frame}:`);
    
    // Update world
    world.update(deltaTime);
    
    // Display positions
    const stationaryPos = world.getComponent(stationaryEntity.id, 'position') as any;
    const movingPos = world.getComponent(movingEntity.id, 'position') as any;
    const fastPos = world.getComponent(fastEntity.id, 'position') as any;
    
    console.log(`Stationary: (${stationaryPos?.x}, ${stationaryPos?.y})`);
    console.log(`Moving: (${movingPos?.x}, ${movingPos?.y})`);
    console.log(`Fast: (${fastPos?.x}, ${fastPos?.y})`);
  }

  // Display final statistics
  console.log('\n📊 Final Statistics:');
  const stats = world.getStats();
  console.log(`Entities: ${stats.entityCount}`);
  console.log(`Component Types: ${stats.componentTypeCount}`);
  console.log(`Systems: ${stats.systemCount}`);
  console.log(`Memory Usage: ~${Math.round(stats.memoryUsage / 1024)} KB`);

  // Test query system
  console.log('\n🔍 Testing query system...');
  
  const querySystem = world.getComponentManager();
  const entitiesWithPosition = querySystem.getEntitiesWithComponent('position');
  const entitiesWithVelocity = querySystem.getEntitiesWithComponent('velocity');
  
  console.log(`Entities with position: ${entitiesWithPosition.length}`);
  console.log(`Entities with velocity: ${entitiesWithVelocity.length}`);

  // Test component removal
  console.log('\n🗑️ Testing component removal...');
  
  const removed = world.removeComponent(movingEntity.id, 'velocity');
  console.log(`Removed velocity from moving entity: ${removed}`);
  
  // Check if movement still works
  console.log(`Moving entity still has velocity: ${world.hasComponent(movingEntity.id, 'velocity')}`);

  console.log('\n✅ ECS System test completed successfully!');
}

/**
 * Test component factory and utilities
 */
export function testComponents(): void {
  console.log('\n🧪 Testing Components...');

  // Test position component
  const pos1 = PositionComponentFactory.create(10, 20);
  const pos2 = PositionComponentFactory.create(15, 25);
  
  console.log(`Position 1: (${pos1.x}, ${pos1.y})`);
  console.log(`Position 2: (${pos2.x}, ${pos2.y})`);

  // Test velocity component
  const vel1 = VelocityComponentFactory.create(1, 2);
  const vel2 = VelocityComponentFactory.createStationary();
  
  console.log(`Velocity 1: (${vel1.vx}, ${vel1.vy})`);
  console.log(`Velocity 2: (${vel2.vx}, ${vel2.vy})`);

  console.log('✅ Component test completed!');
}


