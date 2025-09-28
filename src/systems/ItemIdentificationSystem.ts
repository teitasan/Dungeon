/**
 * Item Identification System
 * Manages unidentified states and identification methods.
 */

import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';

export interface IdentificationMethodConfig {
  method: 'use-item' | 'identification-scroll' | 'shop-appraisal' | 'level-up';
  cost?: number;
  successRate?: number; // 0-1
}

export interface ItemIdentificationConfig {
  unidentifiedItemTypes: string[];
  identificationMethods: IdentificationMethodConfig[];
}

export class ItemIdentificationSystem {
  private config: ItemIdentificationConfig;
  private rng: () => number;

  constructor(config?: Partial<ItemIdentificationConfig>, rng?: () => number) {
    this.config = {
      unidentifiedItemTypes: ['weapon-melee', 'weapon-ranged', 'armor', 'accessory', 'consumable'],
      identificationMethods: [
        { method: 'use-item' },
        { method: 'identification-scroll', successRate: 1.0 },
      ],
      ...config
    } as ItemIdentificationConfig;
    this.rng = rng || Math.random;
  }

  /**
   * Decide if a newly generated item should start unidentified
   */
  shouldStartUnidentified(item: ItemEntity): boolean {
    if (item.alwaysIdentified) {
      return false;
    }
    return this.config.unidentifiedItemTypes.includes(item.itemType) && !item.identified;
  }

  /**
   * Try to identify a specific item with a given method
   */
  identifyItem(player: PlayerEntity, item: ItemEntity, method: IdentificationMethodConfig['method']): boolean {
    if (item.identified) return true;
    const methodCfg = this.config.identificationMethods.find(m => m.method === method);
    if (!methodCfg) return false;
    const successRate = methodCfg.successRate ?? 1.0;
    const success = this.rng() <= successRate;
    if (success) item.identify();
    return success;
  }
}
