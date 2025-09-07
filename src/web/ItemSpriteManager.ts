/**
 * Item Sprite Manager
 * Manages item sprites and renders them on canvas
 */

export interface ItemSpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ItemSpritesheetConfig {
  imagePath: string;
  tileSize: number;
  sprites: Record<string, ItemSpriteDefinition>;
}

export class ItemSpriteManager {
  private image: HTMLImageElement | null = null;
  private config: ItemSpritesheetConfig;
  private loaded = false;

  constructor(config: ItemSpritesheetConfig) {
    this.config = config;
  }

  /**
   * 画像パスをGitHub Pagesなどのbase配下でも解決できるように補正
   */
  private resolveImagePath(path: string): string {
    // 既に完全なURL/データURLならそのまま
    if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;

    // ViteのベースURL
    const base = (import.meta as any).env?.BASE_URL || '/';

    // 先頭スラッシュの場合は base を前置
    if (path.startsWith('/')) {
      return base.replace(/\/$/, '') + path;
    }
    // 相対パスの場合は base 配下に解決
    return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => {
        this.loaded = true;
        resolve();
      };
      this.image.onerror = () => {
        reject(new Error(`Failed to load item spritesheet: ${this.config.imagePath}`));
      };
      this.image.src = this.resolveImagePath(this.config.imagePath);
    });
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Draw item sprite on canvas
   */
  drawItemSprite(
    ctx: CanvasRenderingContext2D,
    spriteId: string,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.loaded || !this.image) return;

    const spriteDef = this.config.sprites[spriteId];
    if (!spriteDef) {
      // Fallback to unknown item sprite
      const unknownSprite = this.config.sprites['unknown-item'];
      if (unknownSprite) {
        this.drawSpriteInternal(ctx, unknownSprite, x, y, tileSize);
      }
      return;
    }

    this.drawSpriteInternal(ctx, spriteDef, x, y, tileSize);
  }

  private drawSpriteInternal(
    ctx: CanvasRenderingContext2D,
    spriteDef: ItemSpriteDefinition,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.image) return;

    // ピクセルアートのスムージングを無効化
    ctx.imageSmoothingEnabled = false;

    // 画像から16x16ピクセルを取得
    const actualImageTileSize = 16;
    const sourceX = spriteDef.x * actualImageTileSize;
    const sourceY = spriteDef.y * actualImageTileSize;
    const sourceWidth = spriteDef.width * actualImageTileSize;
    const sourceHeight = spriteDef.height * actualImageTileSize;

    // 16x16の画像を指定サイズのタイルに拡大して描画
    ctx.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      tileSize,
      tileSize
    );
  }

  /**
   * Get sprite definition for an item
   */
  getSpriteDefinition(spriteId: string): ItemSpriteDefinition | undefined {
    return this.config.sprites[spriteId];
  }

  /**
   * Check if sprite exists
   */
  hasSprite(spriteId: string): boolean {
    return spriteId in this.config.sprites;
  }

  /**
   * Get all available sprite IDs
   */
  getAvailableSprites(): string[] {
    return Object.keys(this.config.sprites);
  }
}

