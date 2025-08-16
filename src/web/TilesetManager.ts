export interface TileDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TilesetConfig {
  imagePath: string;
  tileSize: number;
  tiles: Record<string, TileDefinition>;
  overlay?: Record<string, TileDefinition>;
}

export class TilesetManager {
  private image: HTMLImageElement | null = null;
  private config: TilesetConfig;
  private loaded = false;

  constructor(config: TilesetConfig) {
    this.config = config;
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    console.log('Loading tileset image from:', this.config.imagePath);
    return new Promise((resolve, reject) => {
      this.image = new Image();
      this.image.onload = () => {
        console.log('Tileset image loaded successfully');
        this.loaded = true;
        resolve();
      };
      this.image.onerror = (error) => {
        console.error('Failed to load tileset image:', error);
        reject(new Error(`Failed to load tileset image: ${this.config.imagePath}`));
      };
      this.image.src = this.config.imagePath;
    });
  }

  isLoaded(): boolean {
    return this.loaded && this.image !== null;
  }

  drawTile(
    ctx: CanvasRenderingContext2D,
    tileType: string,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.isLoaded() || !this.image) {
      console.log('Tileset not loaded or image missing');
      return;
    }

    const tileDef = this.config.tiles[tileType];
    if (!tileDef) {
      console.log(`Tile definition not found for type: ${tileType}`);
      // タイル定義がない場合はデフォルトの床タイルを使用
      const defaultTile = this.config.tiles['floor'] || { x: 0, y: 0, width: 1, height: 1 };
      this.drawTileInternal(ctx, defaultTile, x, y, tileSize);
      return;
    }

    console.log(`Drawing tile: ${tileType} at (${x}, ${y}) with definition:`, tileDef);
    this.drawTileInternal(ctx, tileDef, x, y, tileSize);
  }

  private drawTileInternal(
    ctx: CanvasRenderingContext2D,
    tileDef: TileDefinition,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.image) return;

    // ピクセルアートのスムージングを無効化
    ctx.imageSmoothingEnabled = false;

    // 画像から16x16ピクセルを取得（設定のtileSizeは32だが、実際の画像は16x16）
    const actualImageTileSize = 16;
    const sourceX = tileDef.x * actualImageTileSize;
    const sourceY = tileDef.y * actualImageTileSize;
    const sourceWidth = tileDef.width * actualImageTileSize;
    const sourceHeight = tileDef.height * actualImageTileSize;



    // 16x16の画像を32x32のタイルに2倍拡大して描画
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

  getTileSize(): number {
    return this.config.tileSize;
  }

  getConfig(): TilesetConfig {
    return this.config;
  }

  /**
   * オーバーレイタイルを描画（床の上に重ねる）
   */
  drawOverlay(
    ctx: CanvasRenderingContext2D,
    tileType: string,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.isLoaded() || !this.image || !this.config.overlay) return;

    const overlayDef = this.config.overlay[tileType];
    if (!overlayDef) return;

    console.log(`Drawing overlay: ${tileType} at (${x}, ${y})`);
    this.drawTileInternal(ctx, overlayDef, x, y, tileSize);
  }
}
