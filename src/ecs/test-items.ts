/**
 * ECS Item System Test
 */

import { World } from './core/World.js';
import { PositionComponentFactory } from './components/common/Position.js';
import { HealthComponentFactory } from './components/common/Health.js';
import { HungerComponentFactory } from './components/status/Hunger.js';
import { InventoryComponentFactory } from './components/common/Inventory.js';
import { ItemComponentFactory } from './components/common/Item.js';
import { ECSItemSystem } from './systems/common/ItemSystem.js';

/**
 * Test ECS item system
 */
export function testItemSystem(): void {
  console.log('🎒 Testing ECS Item System...');

  // Create ECS world
  const world = new World();

  // Add item system
  const itemSystem = new ECSItemSystem(world.getComponentManager());
  world.addSystem(itemSystem);

  // Initialize systems
  world.initialize();

  // Create test entities
  console.log('🎮 Creating entities with inventory...');

  // Player with inventory
  const player = world.createEntityWithComponents(
    PositionComponentFactory.create(5, 5),
    HealthComponentFactory.create(15, 30), // Damaged
    HungerComponentFactory.create(40, 100), // Hungry
    InventoryComponentFactory.createPlayer()
  );

  // Companion with inventory
  const companion = world.createEntityWithComponents(
    PositionComponentFactory.create(6, 5),
    HealthComponentFactory.createFull(20),
    HungerComponentFactory.createFull(100),
    InventoryComponentFactory.create(10) // Smaller inventory
  );

  console.log(`✅ Created ${world.getStats().entityCount} entities with inventory`);

  // Display initial stats
  console.log('\n📊 Initial Stats:');
  const playerHealth = world.getComponent(player.id, 'health') as any;
  const playerHunger = world.getComponent(player.id, 'hunger') as any;
  const playerInventory = world.getComponent(player.id, 'inventory') as any;
  
  console.log(`Player: HP=${playerHealth?.current}/${playerHealth?.maximum}, Hunger=${playerHunger?.current}/${playerHunger?.maximum}, Items=${playerInventory?.currentCapacity}/${playerInventory?.maxCapacity}`);

  // Test item creation and pickup
  console.log('\n🍖 Testing item pickup...');

  // Create some items on the ground
  const healthPotion = itemSystem.createItemFromTemplate('health-potion');
  const bread = itemSystem.createItemFromTemplate('bread');
  const sword = itemSystem.createItemFromTemplate('basic-sword');

  if (healthPotion && bread && sword) {
    // Drop items at player position
    const playerPos = world.getComponent(player.id, 'position') as any;
    
    itemSystem.dropItem(player.id, healthPotion.id, playerPos); // This will fail since item isn't in inventory
    
    // Instead, let's add items to inventory directly for testing
    const healthPotionInvItem = {
      id: healthPotion.id,
      templateId: healthPotion.templateId,
      name: healthPotion.name,
      itemType: healthPotion.itemType,
      identified: healthPotion.identified,
      cursed: healthPotion.cursed,
      quantity: healthPotion.quantity
    };

    const breadInvItem = {
      id: bread.id,
      templateId: bread.templateId,
      name: bread.name,
      itemType: bread.itemType,
      identified: bread.identified,
      cursed: bread.cursed,
      quantity: bread.quantity
    };

    const added1 = itemSystem.addItemToInventory(player.id, healthPotionInvItem);
    const added2 = itemSystem.addItemToInventory(player.id, breadInvItem);
    
    console.log(`   Added health potion: ${added1}`);
    console.log(`   Added bread: ${added2}`);
  }

  // Display inventory
  console.log('\n🎒 Player Inventory:');
  const items = itemSystem.getInventoryItems(player.id);
  items.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.name} (${item.itemType}) x${item.quantity}`);
  });

  // Test item usage
  console.log('\n💊 Testing item usage...');

  // Use health potion
  if (items.length > 0) {
    const healthPotionItem = items.find(item => item.templateId === 'health-potion');
    if (healthPotionItem) {
      const result = itemSystem.useItem(player.id, healthPotionItem.id);
      console.log(`   ${result.message}`);
      console.log(`   Success: ${result.success}, Consumed: ${result.consumed}`);
      
      for (const effect of result.effects) {
        console.log(`     Effect: ${effect.message}`);
      }
    }
  }

  // Check health after healing
  const playerHealthAfter = world.getComponent(player.id, 'health') as any;
  console.log(`   Player HP after healing: ${playerHealthAfter?.current}/${playerHealthAfter?.maximum}`);

  // Use bread
  const breadItem = items.find(item => item.templateId === 'bread');
  if (breadItem) {
    const result = itemSystem.useItem(player.id, breadItem.id);
    console.log(`   ${result.message}`);
    console.log(`   Success: ${result.success}, Consumed: ${result.consumed}`);
  }

  // Check hunger after eating
  const playerHungerAfter = world.getComponent(player.id, 'hunger') as any;
  console.log(`   Player Hunger after eating: ${playerHungerAfter?.current}/${playerHungerAfter?.maximum}`);

  // Display final inventory
  console.log('\n🎒 Final Inventory:');
  const finalItems = itemSystem.getInventoryItems(player.id);
  if (finalItems.length === 0) {
    console.log('   Inventory is empty');
  } else {
    finalItems.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.name} (${item.itemType}) x${item.quantity}`);
    });
  }

  // Test capacity info
  const capacity = itemSystem.getInventoryCapacity(player.id);
  if (capacity) {
    console.log(`   Capacity: ${capacity.current}/${capacity.max}`);
  }

  console.log('\n✅ ECS Item System test completed!');
}

/**
 * Test item templates and creation
 */
export function testItemTemplates(): void {
  console.log('\n🏭 Testing Item Templates...');

  const world = new World();
  const itemSystem = new ECSItemSystem(world.getComponentManager());
  world.initialize();

  console.log('\n📋 Available item templates:');
  const templateIds = itemSystem.getItemTemplateIds();
  
  for (const templateId of templateIds) {
    const template = itemSystem.getItemTemplate(templateId);
    if (template) {
      console.log(`   ${templateId}: ${template.name} (${template.itemType})`);
      
      if (template.effects.length > 0) {
        console.log(`     Effects: ${template.effects.map(e => e.description).join(', ')}`);
      }
      
      if (template.equipmentStats) {
        const stats = template.equipmentStats;
        console.log(`     Equipment: ATK+${stats.attackBonus}, DEF+${stats.defenseBonus}`);
      }
    }
  }

  console.log('\n🔧 Testing item creation:');
  
  // Test creating items from templates
  for (const templateId of templateIds.slice(0, 3)) { // Test first 3 templates
    const item = itemSystem.createItemFromTemplate(templateId);
    if (item) {
      console.log(`   Created: ${item.name} (ID: ${item.id})`);
    }
  }

  console.log('\n✅ Item templates test completed!');
}
