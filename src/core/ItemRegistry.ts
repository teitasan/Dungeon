import type { ItemTemplate } from '../systems/ItemSystem.js';

/**
 * ItemRegistry - 単一のテンプレ正本を保持するレジストリ
 * - public/config/game.json の items.templates を読み込んで保持
 * - 非ECS/ECS の両方から参照できるようにする（段階的移行用）
 */
export class ItemRegistry {
  private static instance: ItemRegistry | null = null;
  private templates: Map<string, ItemTemplate> = new Map();
  private unidentifiedPrefixPools: Record<string, string[]> = {};

  private constructor() {}

  public static getInstance(): ItemRegistry {
    if (!ItemRegistry.instance) {
      ItemRegistry.instance = new ItemRegistry();
    }
    return ItemRegistry.instance;
  }

  /**
   * ゲーム設定からテンプレートオブジェクトと関連情報を読み込み、内部に反映
   * 期待するスキーマ: { templates: { "1": {...} }, unidentifiedPrefixPools?: { category: [] } }
   */
  public loadFromConfig(config: any): void {
    this.templates.clear();
    this.unidentifiedPrefixPools = {};
    if (!config || typeof config !== 'object') {
      return;
    }

    const templates: any = config.templates ?? config;

    const pools = config.unidentifiedPrefixPools;
    if (pools && typeof pools === 'object') {
      const sanitized: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(pools)) {
        if (!Array.isArray(value)) continue;
        const filtered = Array.from(new Set(
          value.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
        ));
        if (filtered.length > 0) {
          sanitized[key] = filtered;
        }
      }
      this.unidentifiedPrefixPools = sanitized;
    } else if (Array.isArray(config.unidentifiedPrefixes)) {
      const filtered = Array.from(new Set(
        config.unidentifiedPrefixes.filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
      ));
      if (filtered.length > 0) {
        this.unidentifiedPrefixPools = { default: filtered as string[] };
      }
    }

    if (!templates || typeof templates !== 'object') {
      return;
    }

    for (const [id, tpl] of Object.entries(templates)) {
      if (!tpl || typeof tpl !== 'object') continue;
      const template = tpl as any; // 型アサーションでプロパティアクセスを許可
      const casted: ItemTemplate = {
        id: String(template.id ?? id),
        name: String(template.name ?? id),
        itemType: template.itemType ?? template.type ?? 'consumable',
        identified: !!template.identified,
        cursed: !!template.cursed,
        spriteId: template.spriteId,
        effects: Array.isArray(template.effects) ? template.effects.map((e: any) => ({ ...e })) : undefined,
        equipmentStats: template.equipmentStats ? { ...template.equipmentStats } : undefined,
        attributes: template.attributes ? { ...template.attributes } : undefined,
        durability: typeof template.durability === 'number' ? template.durability : undefined,
        identification: template.identification ? { ...template.identification } : undefined,
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

  public getUnidentifiedPrefixPools(): Record<string, string[]> {
    const copy: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(this.unidentifiedPrefixPools)) {
      copy[key] = [...value];
    }
    return copy;
  }
}

