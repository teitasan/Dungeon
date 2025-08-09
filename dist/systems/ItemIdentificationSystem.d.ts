/**
 * Item Identification System
 * Manages unidentified states and identification methods.
 */
import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';
export interface IdentificationMethodConfig {
    method: 'use-item' | 'identification-scroll' | 'shop-appraisal' | 'level-up';
    cost?: number;
    successRate?: number;
}
export interface ItemIdentificationConfig {
    unidentifiedItemTypes: string[];
    identificationMethods: IdentificationMethodConfig[];
}
export declare class ItemIdentificationSystem {
    private config;
    private rng;
    constructor(config?: Partial<ItemIdentificationConfig>, rng?: () => number);
    /**
     * Decide if a newly generated item should start unidentified
     */
    shouldStartUnidentified(item: ItemEntity): boolean;
    /**
     * Try to identify a specific item with a given method
     */
    identifyItem(player: PlayerEntity, item: ItemEntity, method: IdentificationMethodConfig['method']): boolean;
}
//# sourceMappingURL=ItemIdentificationSystem.d.ts.map