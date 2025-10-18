/**
 * Item Sprite Manager
 * Manages item sprites and renders them on canvas
 */

// 画像ファイルのインポート
import potionPngUrl from '../assets/images/potion.png';
import potionMapPngUrl from '../assets/images/potion_map.png';
import scrollPngUrl from '../assets/images/unkwon_scroll.png';
import scrollMapPngUrl from '../assets/images/scroll_map.png';
import orangePngUrl from '../assets/images/orange.png';
import orangeMapPngUrl from '../assets/images/orange_map.png';

export interface ItemSpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
  imagePath?: string; // 個別の画像ファイルパス（オプション）
  mapImagePath?: string; // マップ用の画像ファイルパス（オプション）
}

export interface ItemSpritesheetConfig {
  imagePath: string;
  tileSize: number;
  sprites: Record<string, ItemSpriteDefinition>;
}

export class ItemSpriteManager {
  private image: HTMLImageElement | null = null;
  private individualImages: Map<string, HTMLImageElement> = new Map();
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

    // 既知のファイル名に対してはバンドル済みURLへフォールバック
    const filename = path.split('/').pop() || path;
    if (/^potion\.png$/i.test(filename)) return potionPngUrl as string;
    if (/^potion_map\.png$/i.test(filename)) return potionMapPngUrl as string;
    if (/^unkwon_scroll\.png$/i.test(filename)) return scrollPngUrl as string;
    if (/^scroll_map\.png$/i.test(filename)) return scrollMapPngUrl as string;
    if (/^orange\.png$/i.test(filename)) return orangePngUrl as string;
    if (/^orange_map\.png$/i.test(filename)) return orangeMapPngUrl as string;

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

    const loadPromises: Promise<void>[] = [];

    // メインのスプライトシートを読み込み
    const mainImagePromise = new Promise<void>((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => resolve();
      this.image.onerror = () => {
        reject(new Error(`Failed to load item spritesheet: ${this.config.imagePath}`));
      };
      this.image.src = this.resolveImagePath(this.config.imagePath);
    });
    loadPromises.push(mainImagePromise);

    // 個別の画像ファイルを読み込み
    for (const [spriteId, spriteDef] of Object.entries(this.config.sprites)) {
      // インベントリ用画像
      if (spriteDef.imagePath) {
        const individualImagePromise = new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            this.individualImages.set(spriteId, image);
            this.individualImages.set(spriteDef.imagePath!, image);
            resolve();
          };
          image.onerror = () => {
            reject(new Error(`Failed to load individual image: ${spriteDef.imagePath}`));
          };
          image.src = this.resolveImagePath(spriteDef.imagePath!);
        });
        loadPromises.push(individualImagePromise);
      }
      
      // マップ用画像
      if (spriteDef.mapImagePath) {
        const mapImagePromise = new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            this.individualImages.set(`${spriteId}_map`, image);
            this.individualImages.set(spriteDef.mapImagePath!, image);
            resolve();
          };
          image.onerror = () => {
            reject(new Error(`Failed to load map image: ${spriteDef.mapImagePath}`));
          };
          image.src = this.resolveImagePath(spriteDef.mapImagePath!);
        });
        loadPromises.push(mapImagePromise);
      }
    }

    try {
      await Promise.all(loadPromises);
      this.loaded = true;
    } catch (error) {
      console.error('Error loading item images:', error);
      throw error;
    }
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

  /**
   * Draw item sprite for map display
   */
  drawItemSpriteForMap(
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
        this.drawSpriteInternalForMap(ctx, unknownSprite, x, y, tileSize);
      }
      return;
    }

    this.drawSpriteInternalForMap(ctx, spriteDef, x, y, tileSize);
  }

  private drawSpriteInternal(
    ctx: CanvasRenderingContext2D,
    spriteDef: ItemSpriteDefinition,
    x: number,
    y: number,
    tileSize: number
  ): void {
    // ピクセルアートのスムージングを無効化
    ctx.imageSmoothingEnabled = false;

    // 個別の画像ファイルがある場合はそれを使用
    if (spriteDef.imagePath) {
      const individualImage = this.individualImages.get(spriteDef.imagePath);
      if (individualImage) {
        // 個別画像をそのまま描画
        ctx.drawImage(individualImage, x, y, tileSize, tileSize);
        return;
      }
    }

    // メインのスプライトシートから描画
    if (!this.image) return;

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

  private drawSpriteInternalForMap(
    ctx: CanvasRenderingContext2D,
    spriteDef: ItemSpriteDefinition,
    x: number,
    y: number,
    tileSize: number
  ): void {
    // ピクセルアートのスムージングを無効化
    ctx.imageSmoothingEnabled = false;

    // マップ用の個別画像ファイルがある場合はそれを使用
    if (spriteDef.mapImagePath) {
      const mapImage = this.individualImages.get(spriteDef.mapImagePath);
      if (mapImage) {
        // マップ用画像を中央に配置（24x24で中央配置）
        const itemSize = Math.min(tileSize * 0.75, 24);
        const offsetX = (tileSize - itemSize) / 2;
        const offsetY = (tileSize - itemSize) / 2;
        ctx.drawImage(mapImage, x + offsetX, y + offsetY, itemSize, itemSize);
        return;
      }
    }

    // フォールバック: 通常の個別画像を使用
    if (spriteDef.imagePath) {
      const individualImage = this.individualImages.get(spriteDef.imagePath);
      if (individualImage) {
        // 個別画像を中央に配置（24x24で中央配置）
        const itemSize = Math.min(tileSize * 0.75, 24);
        const offsetX = (tileSize - itemSize) / 2;
        const offsetY = (tileSize - itemSize) / 2;
        ctx.drawImage(individualImage, x + offsetX, y + offsetY, itemSize, itemSize);
        return;
      }
    }

    // メインのスプライトシートから描画
    if (!this.image) return;

    const actualImageTileSize = 16;
    const sourceX = spriteDef.x * actualImageTileSize;
    const sourceY = spriteDef.y * actualImageTileSize;
    const sourceWidth = spriteDef.width * actualImageTileSize;
    const sourceHeight = spriteDef.height * actualImageTileSize;

    // 16x16の画像を中央に配置（24x24で中央配置）
    const itemSize = Math.min(tileSize * 0.75, 24);
    const offsetX = (tileSize - itemSize) / 2;
    const offsetY = (tileSize - itemSize) / 2;
    ctx.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x + offsetX,
      y + offsetY,
      itemSize,
      itemSize
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

