/**
 * Item Identification System
 * Manages unidentified states and identification methods.
 */
export class ItemIdentificationSystem {
    config;
    rng;
    constructor(config, rng) {
        this.config = {
            unidentifiedItemTypes: ['weapon-melee', 'weapon-ranged', 'armor', 'accessory', 'consumable'],
            identificationMethods: [
                { method: 'use-item' },
                { method: 'identification-scroll', successRate: 1.0 },
            ],
            ...config
        };
        this.rng = rng || Math.random;
    }
    /**
     * Decide if a newly generated item should start unidentified
     */
    shouldStartUnidentified(item) {
        return this.config.unidentifiedItemTypes.includes(item.itemType);
    }
    /**
     * Try to identify a specific item with a given method
     */
    identifyItem(player, item, method) {
        if (item.identified)
            return true;
        const methodCfg = this.config.identificationMethods.find(m => m.method === method);
        if (!methodCfg)
            return false;
        const successRate = methodCfg.successRate ?? 1.0;
        const success = this.rng() <= successRate;
        if (success)
            item.identify();
        return success;
    }
}
//# sourceMappingURL=ItemIdentificationSystem.js.map