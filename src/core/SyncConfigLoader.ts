/**
 * Synchronous configuration loader for dungeon templates
 * Loads configuration at build time and provides synchronous access
 */

// ビルド時に埋め込まれるグローバル変数の型定義
declare global {
  const __DUNGEON_TEMPLATES__: DungeonTemplatesConfig;
}

export interface DungeonTemplateConfig {
  id: string;
  name: string;
  description: string;
  floors: number;
  generationParams: {
    width: number;
    height: number;
    minRooms: number;
    maxRooms: number;
    minRoomSize: number;
    maxRoomSize: number;
    corridorWidth: number;
    roomDensity: number;
    specialRoomChance: number;
    trapDensity: number;
    gridDivision: number;
  };
  floorSpecificParams?: Array<{
    floor: number;
    width: number;
    height: number;
    minRooms: number;
    maxRooms: number;
    minRoomSize: number;
    maxRoomSize: number;
    corridorWidth: number;
    roomDensity: number;
    specialRoomChance: number;
    trapDensity: number;
    gridDivision: number;
  }>;
  floorRangeParams?: Array<{
    floorRange: string;
    width: number;
    height: number;
    minRooms: number;
    maxRooms: number;
    minRoomSize: number;
    maxRoomSize: number;
    corridorWidth: number;
    roomDensity: number;
    specialRoomChance: number;
    trapDensity: number;
    gridDivision: number;
  }>;
  tileSet: string;
  monsterTable: any[];
  itemTable: any[];
  specialRules: any[];
}

export interface DungeonTemplatesConfig {
  [templateId: string]: DungeonTemplateConfig;
}

/**
 * Synchronous configuration loader that embeds dungeon templates
 * This avoids async operations during runtime
 */
export class SyncConfigLoader {
  private static instance: SyncConfigLoader;
  private templates: DungeonTemplatesConfig;

  private constructor() {
    // Embed dungeon templates directly to avoid async loading
    this.templates = this.getEmbeddedTemplates();
  }

  public static getInstance(): SyncConfigLoader {
    if (!SyncConfigLoader.instance) {
      SyncConfigLoader.instance = new SyncConfigLoader();
    }
    return SyncConfigLoader.instance;
  }

  /**
   * Get dungeon templates synchronously
   */
  public getDungeonTemplates(): DungeonTemplatesConfig {
    return this.templates;
  }

  /**
   * Get specific template by ID
   */
  public getTemplate(templateId: string): DungeonTemplateConfig | undefined {
    return this.templates[templateId];
  }

  /**
   * Get all template IDs
   */
  public getTemplateIds(): string[] {
    return Object.keys(this.templates);
  }

  /**
   * Get embedded dungeon templates from build-time configuration
   * ビルド時に埋め込まれた設定からダンジョンテンプレートを取得
   */
  private getEmbeddedTemplates(): DungeonTemplatesConfig {
    // ビルド時に埋め込まれたJSONデータを使用
    // @ts-ignore - __DUNGEON_TEMPLATES__はビルド時に定義される
    return __DUNGEON_TEMPLATES__;
  }
}
