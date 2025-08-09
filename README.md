# Mystery Dungeon Game

A roguelike mystery dungeon game built with TypeScript and a component-based architecture.

## Project Structure

```
src/
├── types/
│   └── core.ts              # Core type definitions
├── core/
│   ├── ConfigLoader.ts      # Configuration loading system
│   ├── Component.ts         # Base component class
│   ├── ComponentRegistry.ts # Component factory registry
│   └── ComponentSystem.ts   # Component execution system
├── Game.ts                  # Main game class
└── index.ts                 # Entry point

config/
└── game.json               # Game configuration file

tests/
├── core/__tests__/         # Core system tests
└── __tests__/              # Game tests
```

## Features Implemented (Task 1)

### ✅ TypeScript Project Setup
- Complete TypeScript configuration with strict mode
- ESNext modules with Node.js resolution
- Build system with source maps and declarations
- Vitest testing framework integration

### ✅ Configuration Loading System
- JSON-based configuration files
- Validation and error handling
- Default configuration fallback
- Configuration caching and reloading
- Type-safe configuration access

### ✅ Component System Foundation
- Base component abstract class
- Component registry with factory pattern
- Component execution system with error handling
- Plugin-like component registration
- Execution order management
- Error recovery mechanisms

## Architecture Principles

1. **Configuration-Driven**: All game rules, values, and behaviors are defined in configuration files
2. **Component-Based**: Game functionality is implemented as replaceable components
3. **Type-Safe**: Full TypeScript typing for all interfaces and data structures
4. **Extensible**: Plugin-like architecture for adding new components and features
5. **Testable**: Comprehensive test coverage with unit tests

## Getting Started

### Installation
```bash
npm install
```

### Build
```bash
npm run build
```

### Run Tests
```bash
npm test
```

### Start Game
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## Configuration

The game uses JSON configuration files in the `config/` directory:

- `game.json` - Main game configuration including player stats, combat rules, and system settings

Example configuration structure:
```json
{
  "player": {
    "initialStats": { "hp": 100, "attack": 10, "defense": 5 },
    "levelUpConfig": { "maxLevel": 100, "statGrowthRates": {...} },
    "hungerConfig": { "maxValue": 100, "decreaseRate": 1 },
    "movementConfig": { "distance": 1, "directions": [...] }
  },
  "combat": {
    "baseDamageFormula": "{attack * 1.3 * (35/36)^defense} * random(7/8, 9/8)",
    "minDamage": 1,
    "criticalChance": 0.05,
    "evasionEnabled": true
  }
}
```

## Component System

Components are the building blocks of game functionality:

```typescript
// Example component implementation
class MovementComponent extends BaseComponent {
  constructor(id: string, config: ComponentConfig) {
    super(id, 'movement', config);
  }

  execute(context: GameContext): ComponentResult {
    // Component logic here
    return this.createSuccessResult('Movement executed');
  }
}

// Register component
registry.registerComponentFactory('movement', 
  (id, config) => new MovementComponent(id, config)
);
```

## Testing

The project includes comprehensive tests:
- Unit tests for all core systems
- Configuration loading tests
- Component system tests
- Integration tests for the main game class

Run tests with:
```bash
npm test
```

## Next Steps

This foundation supports the implementation of:
- Dungeon generation system
- Player and monster entities
- Combat system
- Item system
- Turn-based gameplay
- UI rendering system

Each feature will be implemented as components that plug into this foundation system.