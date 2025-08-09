/**
 * Attribute system for handling elemental types and damage modifiers
 */

import { GameEntity, CharacterAttributes } from '../types/entities';

// Attribute types
export type AttributeType = 'neutral' | 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel';

// Attribute effectiveness
export enum AttributeEffectiveness {
  IMMUNE = 0.0,
  NOT_VERY_EFFECTIVE = 0.8,
  NORMAL = 1.0,
  SUPER_EFFECTIVE = 1.2
}

// Attribute compatibility matrix
export interface AttributeCompatibilityMatrix {
  [attackerAttribute: string]: {
    [defenderAttribute: string]: AttributeEffectiveness;
  };
}

export class AttributeSystem {
  private compatibilityMatrix: AttributeCompatibilityMatrix;

  constructor() {
    this.compatibilityMatrix = this.initializeCompatibilityMatrix();
  }

  /**
   * Calculate attribute damage modifier
   */
  calculateAttributeModifier(
    attackerAttribute: string, 
    defenderAttribute: string
  ): number {
    // If either attribute is neutral, return normal effectiveness
    if (attackerAttribute === 'neutral' || defenderAttribute === 'neutral') {
      return AttributeEffectiveness.NORMAL;
    }

    // Look up effectiveness in matrix
    const attackerMatrix = this.compatibilityMatrix[attackerAttribute];
    if (!attackerMatrix) {
      return AttributeEffectiveness.NORMAL;
    }

    const effectiveness = attackerMatrix[defenderAttribute];
    return effectiveness !== undefined ? effectiveness : AttributeEffectiveness.NORMAL;
  }

  /**
   * Calculate attribute modifier for entity combat
   */
  calculateEntityAttributeModifier(attacker: GameEntity, defender: GameEntity): number {
    const attackerAttributes = this.getEntityAttributes(attacker);
    const defenderAttributes = this.getEntityAttributes(defender);

    if (!attackerAttributes || !defenderAttributes) {
      return AttributeEffectiveness.NORMAL;
    }

    // Use primary attributes for calculation
    return this.calculateAttributeModifier(
      attackerAttributes.primary,
      defenderAttributes.primary
    );
  }

  /**
   * Get entity attributes
   */
  private getEntityAttributes(entity: GameEntity): CharacterAttributes | null {
    // Check if entity has attributes property
    if ('attributes' in entity) {
      return (entity as any).attributes as CharacterAttributes;
    }
    return null;
  }

  /**
   * Get all available attribute types
   */
  getAvailableAttributes(): AttributeType[] {
    return [
      'neutral', 'fire', 'water', 'grass', 'electric', 'ice',
      'fighting', 'poison', 'ground', 'flying', 'psychic',
      'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel'
    ];
  }

  /**
   * Get attribute effectiveness description
   */
  getEffectivenessDescription(effectiveness: AttributeEffectiveness): string {
    switch (effectiveness) {
      case AttributeEffectiveness.IMMUNE:
        return 'No effect';
      case AttributeEffectiveness.NOT_VERY_EFFECTIVE:
        return 'Not very effective';
      case AttributeEffectiveness.NORMAL:
        return 'Normal effectiveness';
      case AttributeEffectiveness.SUPER_EFFECTIVE:
        return 'Super effective';
      default:
        return 'Unknown effectiveness';
    }
  }

  /**
   * Get attribute color for UI
   */
  getAttributeColor(attribute: AttributeType): string {
    const colors: Record<AttributeType, string> = {
      neutral: '#A8A878',
      fire: '#F08030',
      water: '#6890F0',
      grass: '#78C850',
      electric: '#F8D030',
      ice: '#98D8D8',
      fighting: '#C03028',
      poison: '#A040A0',
      ground: '#E0C068',
      flying: '#A890F0',
      psychic: '#F85888',
      bug: '#A8B820',
      rock: '#B8A038',
      ghost: '#705898',
      dragon: '#7038F8',
      dark: '#705848',
      steel: '#B8B8D0'
    };

    return colors[attribute] || colors.neutral;
  }

  /**
   * Check if attribute combination is effective
   */
  isEffective(attackerAttribute: string, defenderAttribute: string): boolean {
    const modifier = this.calculateAttributeModifier(attackerAttribute, defenderAttribute);
    return modifier > AttributeEffectiveness.NORMAL;
  }

  /**
   * Check if attribute combination is not very effective
   */
  isNotVeryEffective(attackerAttribute: string, defenderAttribute: string): boolean {
    const modifier = this.calculateAttributeModifier(attackerAttribute, defenderAttribute);
    return modifier < AttributeEffectiveness.NORMAL && modifier > AttributeEffectiveness.IMMUNE;
  }

  /**
   * Check if attribute combination has no effect
   */
  hasNoEffect(attackerAttribute: string, defenderAttribute: string): boolean {
    const modifier = this.calculateAttributeModifier(attackerAttribute, defenderAttribute);
    return modifier === AttributeEffectiveness.IMMUNE;
  }

  /**
   * Get weaknesses for an attribute
   */
  getWeaknesses(attribute: string): string[] {
    const weaknesses: string[] = [];
    
    for (const [attackerAttr, defenderMatrix] of Object.entries(this.compatibilityMatrix)) {
      if (defenderMatrix[attribute] === AttributeEffectiveness.SUPER_EFFECTIVE) {
        weaknesses.push(attackerAttr);
      }
    }
    
    return weaknesses;
  }

  /**
   * Get resistances for an attribute
   */
  getResistances(attribute: string): string[] {
    const resistances: string[] = [];
    
    for (const [attackerAttr, defenderMatrix] of Object.entries(this.compatibilityMatrix)) {
      const effectiveness = defenderMatrix[attribute];
      if (effectiveness === AttributeEffectiveness.NOT_VERY_EFFECTIVE || 
          effectiveness === AttributeEffectiveness.IMMUNE) {
        resistances.push(attackerAttr);
      }
    }
    
    return resistances;
  }

  /**
   * Get immunities for an attribute
   */
  getImmunities(attribute: string): string[] {
    const immunities: string[] = [];
    
    for (const [attackerAttr, defenderMatrix] of Object.entries(this.compatibilityMatrix)) {
      if (defenderMatrix[attribute] === AttributeEffectiveness.IMMUNE) {
        immunities.push(attackerAttr);
      }
    }
    
    return immunities;
  }

  /**
   * Initialize the attribute compatibility matrix
   * Based on simplified Pokemon-like type chart
   */
  private initializeCompatibilityMatrix(): AttributeCompatibilityMatrix {
    const matrix: AttributeCompatibilityMatrix = {};
    const attributes = this.getAvailableAttributes();

    // Initialize all combinations as normal effectiveness
    for (const attacker of attributes) {
      matrix[attacker] = {};
      for (const defender of attributes) {
        matrix[attacker][defender] = AttributeEffectiveness.NORMAL;
      }
    }

    // Define specific effectiveness relationships
    // Fire
    matrix.fire.grass = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fire.ice = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fire.bug = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fire.steel = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fire.fire = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fire.water = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fire.rock = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fire.dragon = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Water
    matrix.water.fire = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.water.ground = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.water.rock = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.water.water = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.water.grass = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.water.dragon = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Grass
    matrix.grass.water = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.grass.ground = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.grass.rock = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.grass.fire = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.grass = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.poison = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.flying = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.bug = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.dragon = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.grass.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Electric
    matrix.electric.water = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.electric.flying = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.electric.electric = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.electric.grass = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.electric.dragon = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.electric.ground = AttributeEffectiveness.IMMUNE;

    // Ice
    matrix.ice.grass = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ice.ground = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ice.flying = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ice.dragon = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ice.fire = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ice.water = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ice.ice = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ice.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Fighting
    matrix.fighting.ice = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fighting.rock = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fighting.dark = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fighting.steel = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.fighting.poison = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fighting.flying = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fighting.psychic = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fighting.bug = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.fighting.ghost = AttributeEffectiveness.IMMUNE;

    // Poison
    matrix.poison.grass = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.poison.poison = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.poison.ground = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.poison.rock = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.poison.ghost = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.poison.steel = AttributeEffectiveness.IMMUNE;

    // Ground
    matrix.ground.fire = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ground.electric = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ground.poison = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ground.rock = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ground.steel = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ground.grass = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ground.bug = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ground.flying = AttributeEffectiveness.IMMUNE;

    // Flying
    matrix.flying.electric = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.flying.rock = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.flying.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.flying.grass = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.flying.fighting = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.flying.bug = AttributeEffectiveness.SUPER_EFFECTIVE;

    // Psychic
    matrix.psychic.fighting = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.psychic.poison = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.psychic.psychic = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.psychic.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.psychic.dark = AttributeEffectiveness.IMMUNE;

    // Bug
    matrix.bug.grass = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.bug.psychic = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.bug.dark = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.bug.fire = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.bug.fighting = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.bug.poison = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.bug.flying = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.bug.ghost = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.bug.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Rock
    matrix.rock.fire = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.rock.ice = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.rock.flying = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.rock.bug = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.rock.fighting = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.rock.ground = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.rock.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Ghost
    matrix.ghost.psychic = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ghost.ghost = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.ghost.dark = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.ghost.fighting = AttributeEffectiveness.IMMUNE;

    // Dragon
    matrix.dragon.dragon = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.dragon.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Dark
    matrix.dark.psychic = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.dark.ghost = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.dark.fighting = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.dark.dark = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    // Steel
    matrix.steel.ice = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.steel.rock = AttributeEffectiveness.SUPER_EFFECTIVE;
    matrix.steel.fire = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.steel.water = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.steel.electric = AttributeEffectiveness.NOT_VERY_EFFECTIVE;
    matrix.steel.steel = AttributeEffectiveness.NOT_VERY_EFFECTIVE;

    return matrix;
  }

  /**
   * Get compatibility matrix (for testing/debugging)
   */
  getCompatibilityMatrix(): AttributeCompatibilityMatrix {
    return { ...this.compatibilityMatrix };
  }

  /**
   * Update compatibility matrix
   */
  updateCompatibilityMatrix(newMatrix: Partial<AttributeCompatibilityMatrix>): void {
    // Merge only existing attacker keys to maintain totality of matrix typing
    for (const [attacker, defenderMap] of Object.entries(newMatrix)) {
      if (!defenderMap) continue;
      this.compatibilityMatrix[attacker] = {
        ...this.compatibilityMatrix[attacker],
        ...defenderMap
      };
    }
  }
}