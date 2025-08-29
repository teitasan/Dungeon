import type { ItemTemplate } from '../systems/ItemSystem.js';

/**
 * ItemRegistry - 単一のテンプレ正本を保持するレジストリ
 * - public/config/game.json の items.templates を読み込んで保持
 * - 非ECS/ECS の両方から参照できるようにする（段階的移行用）
 */
export class ItemRegistry {
  private static instance: ItemRegistry | null = null;
  private templates: Map<string, ItemTemplate> = new Map();

  private constructor() {}

  public static getInstance(): ItemRegistry {
    if (!ItemRegistry.instance) {
      ItemRegistry.instance = new ItemRegistry();
    }
    return ItemRegistry.instance;
  }

  /**
   * ゲーム設定からテンプレ配列を読み込み、内部Mapに反映
   * 期待する最小スキーマ: { id, name, itemType, identified, cursed, effects?, equipmentStats? }
   */
  public loadFromConfig(templates: any[] | undefined | null): void {
    this.templates.clear();
    if (!templates || !Array.isArray(templates)) return;
    for (const tpl of templates) {
      if (!tpl || !tpl.id) continue;
      const casted: ItemTemplate = {
        id: String(tpl.id),
        name: String(tpl.name ?? tpl.id),
        itemType: tpl.itemType ?? tpl.type ?? 'consumable',
        identified: !!tpl.identified,
        cursed: !!tpl.cursed,
        effects: Array.isArray(tpl.effects) ? tpl.effects.map((e: any) => ({ ...e })) : undefined,
        equipmentStats: tpl.equipmentStats ? { ...tpl.equipmentStats } : undefined,
        attributes: tpl.attributes ? { ...tpl.attributes } : undefined,
        durability: typeof tpl.durability === 'number' ? tpl.durability : undefined,
      } as ItemTemplate;
      this.templates.set(casted.id, casted);
    }
  }

  public hasTemplates(): boolean {
    return this.templates.size > 0;
  }

  public getTemplate(id: string): ItemTemplate | undefined {
    return this.templates.get(id);
  }

  public getAll(): ItemTemplate[] {
    return Array.from(this.templates.values());
  }
}

