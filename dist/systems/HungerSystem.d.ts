/**
 * Hunger system for managing player hunger and related effects
 */
import { GameEntity } from '../types/entities';
export interface HungerConfig {
    maxValue: number;
    decreaseRate: number;
    minValue: number;
    damageAmount: number;
    recoveryAmount: number;
    maxOverfeedTime: number;
    hungerThresholds: HungerThreshold[];
}
export interface HungerThreshold {
    value: number;
    state: HungerState;
    description: string;
    effects: HungerEffect[];
}
export type HungerState = 'overfed' | 'full' | 'satisfied' | 'hungry' | 'very-hungry' | 'starving';
export interface HungerEffect {
    type: HungerEffectType;
    value?: number;
    description: string;
}
export type HungerEffectType = 'stat-modifier' | 'damage-over-time' | 'healing-over-time' | 'movement-speed' | 'action-restriction';
export interface HungerResult {
    entity: GameEntity;
    previousHunger: number;
    currentHunger: number;
    previousState: HungerState;
    currentState: HungerState;
    effects: HungerEffectResult[];
    messages: string[];
}
export interface HungerEffectResult {
    type: HungerEffectType;
    value?: number;
    applied: boolean;
    message: string;
}
export interface FoodItem {
    id: string;
    name: string;
    hungerValue: number;
    maxHungerIncrease?: number;
    specialEffects?: FoodEffect[];
}
export interface FoodEffect {
    type: string;
    value?: number;
    duration?: number;
    description: string;
}
export declare class HungerSystem {
    private config;
    constructor(config?: Partial<HungerConfig>);
    /**
     * Process hunger for entity (typically called each turn)
     */
    processHunger(entity: GameEntity): HungerResult | null;
    /**
     * Feed entity with food item
     */
    feedEntity(entity: GameEntity, food: FoodItem): HungerResult | null;
    /**
     * Get current hunger state
     */
    getHungerState(hungerValue: number): HungerState;
    /**
     * Get hunger state description
     */
    getHungerStateDescription(state: HungerState): string;
    /**
     * Apply hunger effects to entity
     */
    private applyHungerEffects;
    /**
     * Apply individual hunger effect
     */
    private applyHungerEffect;
    /**
     * Apply food special effects
     */
    private applyFoodEffects;
    /**
     * Generate hunger-related messages
     */
    private generateHungerMessages;
    /**
     * Check if entity supports hunger system
     */
    private hasHungerSupport;
    /**
     * Get hunger percentage (0-100)
     */
    getHungerPercentage(entity: GameEntity): number;
    /**
     * Check if entity is hungry
     */
    isHungry(entity: GameEntity): boolean;
    /**
     * Check if entity is starving
     */
    isStarving(entity: GameEntity): boolean;
    /**
     * Check if entity is overfed
     */
    isOverfed(entity: GameEntity): boolean;
    /**
     * Create food item
     */
    createFoodItem(id: string, name: string, hungerValue: number, maxHungerIncrease?: number, specialEffects?: FoodEffect[]): FoodItem;
    /**
     * Get hunger configuration
     */
    getConfig(): HungerConfig;
    /**
     * Update hunger configuration
     */
    updateConfig(newConfig: Partial<HungerConfig>): void;
    /**
     * Reset entity hunger to full
     */
    resetHunger(entity: GameEntity): boolean;
    /**
     * Set entity hunger to specific value
     */
    setHunger(entity: GameEntity, value: number): boolean;
}
//# sourceMappingURL=HungerSystem.d.ts.map