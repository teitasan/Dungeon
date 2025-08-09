/**
 * Attribute system for handling elemental types and damage modifiers
 */
import { GameEntity } from '../types/entities';
export type AttributeType = 'neutral' | 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel';
export declare enum AttributeEffectiveness {
    IMMUNE = 0,
    NOT_VERY_EFFECTIVE = 0.8,
    NORMAL = 1,
    SUPER_EFFECTIVE = 1.2
}
export interface AttributeCompatibilityMatrix {
    [attackerAttribute: string]: {
        [defenderAttribute: string]: AttributeEffectiveness;
    };
}
export declare class AttributeSystem {
    private compatibilityMatrix;
    constructor();
    /**
     * Calculate attribute damage modifier
     */
    calculateAttributeModifier(attackerAttribute: string, defenderAttribute: string): number;
    /**
     * Calculate attribute modifier for entity combat
     */
    calculateEntityAttributeModifier(attacker: GameEntity, defender: GameEntity): number;
    /**
     * Get entity attributes
     */
    private getEntityAttributes;
    /**
     * Get all available attribute types
     */
    getAvailableAttributes(): AttributeType[];
    /**
     * Get attribute effectiveness description
     */
    getEffectivenessDescription(effectiveness: AttributeEffectiveness): string;
    /**
     * Get attribute color for UI
     */
    getAttributeColor(attribute: AttributeType): string;
    /**
     * Check if attribute combination is effective
     */
    isEffective(attackerAttribute: string, defenderAttribute: string): boolean;
    /**
     * Check if attribute combination is not very effective
     */
    isNotVeryEffective(attackerAttribute: string, defenderAttribute: string): boolean;
    /**
     * Check if attribute combination has no effect
     */
    hasNoEffect(attackerAttribute: string, defenderAttribute: string): boolean;
    /**
     * Get weaknesses for an attribute
     */
    getWeaknesses(attribute: string): string[];
    /**
     * Get resistances for an attribute
     */
    getResistances(attribute: string): string[];
    /**
     * Get immunities for an attribute
     */
    getImmunities(attribute: string): string[];
    /**
     * Initialize the attribute compatibility matrix
     * Based on simplified Pokemon-like type chart
     */
    private initializeCompatibilityMatrix;
    /**
     * Get compatibility matrix (for testing/debugging)
     */
    getCompatibilityMatrix(): AttributeCompatibilityMatrix;
    /**
     * Update compatibility matrix
     */
    updateCompatibilityMatrix(newMatrix: Partial<AttributeCompatibilityMatrix>): void;
}
//# sourceMappingURL=AttributeSystem.d.ts.map