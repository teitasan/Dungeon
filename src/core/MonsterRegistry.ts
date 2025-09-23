import type { MonsterTemplate } from '../types/entities.js';

/**
 * MonsterRegistry - 単一のモンスターテンプレートを保持するレジストリ
 * - public/config/game.json の monsters.templates を読み込んで保持
 * - 非ECS/ECS の両方から参照できるようにする（段階的移行用）
 */
export class MonsterRegistry {
  private static instance: MonsterRegistry | null = null;
  private templates: Map<string, MonsterTemplate> = new Map();

  private constructor() {}

  public static getInstance(): MonsterRegistry {
    if (!MonsterRegistry.instance) {
      MonsterRegistry.instance = new MonsterRegistry();
    }
    return MonsterRegistry.instance;
  }

  /**
   * ゲーム設定からテンプレートオブジェクトを読み込み、内部Mapに反映
   * 期待するスキーマ: { "1": { name, monsterType, ... }, "2": { ... } }
   */
  public loadFromConfig(templates: any): void {
    this.templates.clear();
    if (!templates || typeof templates !== 'object') return;
    
    for (const [id, tpl] of Object.entries(templates)) {
      if (!tpl || typeof tpl !== 'object') continue;
      const template = tpl as any; // 型アサーションでプロパティアクセスを許可
      const casted: MonsterTemplate = {
        id: String(id),
        name: String(template.name ?? id),
        monsterType: template.monsterType ?? 'basic',
        spriteId: template.spriteId,
        spritesheet: template.spritesheet,
        stats: template.stats ? { ...template.stats } : undefined,
        movementPattern: template.movementPattern,
        movementConfig: template.movementConfig ? { ...template.movementConfig } : undefined,
        experienceValue: typeof template.experienceValue === 'number' ? template.experienceValue : undefined,
        dropRate: typeof template.dropRate === 'number' ? template.dropRate : undefined,
        dropTableId: template.dropTableId,
        level: typeof template.level === 'number' ? template.level : undefined,
        description: template.description,
        characterStats: template.characterStats ? { ...template.characterStats } : undefined,
      } as MonsterTemplate;
      this.templates.set(casted.id, casted);
    }
  }

  public hasTemplates(): boolean {
    return this.templates.size > 0;
  }

  public getTemplate(id: string): MonsterTemplate | undefined {
    return this.templates.get(id);
  }

  public getAll(): MonsterTemplate[] {
    return Array.from(this.templates.values());
  }
}
