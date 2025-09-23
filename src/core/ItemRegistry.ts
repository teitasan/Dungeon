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
   * ゲーム設定からテンプレートオブジェクトを読み込み、内部Mapに反映
   * 期待するスキーマ: { "1": { name, itemType, ... }, "2": { ... } }
   */
  public loadFromConfig(templates: any): void {
    this.templates.clear();
    if (!templates || typeof templates !== 'object') return;
    
    for (const [id, tpl] of Object.entries(templates)) {
      if (!tpl || typeof tpl !== 'object') continue;
      const template = tpl as any; // 型アサーションでプロパティアクセスを許可
      const casted: ItemTemplate = {
        id: String(id),
        name: String(template.name ?? id),
        itemType: template.itemType ?? template.type ?? 'consumable',
        identified: !!template.identified,
        cursed: !!template.cursed,
        spriteId: template.spriteId,
        effects: Array.isArray(template.effects) ? template.effects.map((e: any) => ({ ...e })) : undefined,
        equipmentStats: template.equipmentStats ? { ...template.equipmentStats } : undefined,
        attributes: template.attributes ? { ...template.attributes } : undefined,
        durability: typeof template.durability === 'number' ? template.durability : undefined,
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

