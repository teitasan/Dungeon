/**
 * Monster Sprite Manager
 * Manages monster sprites and renders them on canvas with direction and animation support
 */

export interface MonsterSpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonsterSpritesheetConfig {
  imagePath: string;
  tileSize: number;
  sprites: {
    [key: string]: MonsterSpriteDefinition;
  };
  animations: {
    [key: string]: {
      frames: string[];
      frameDuration: number;
    };
  };
}

export class MonsterSpriteManager {
  private image: HTMLImageElement | null = null;
  private config: MonsterSpritesheetConfig;
  private loaded = false;
  private animationFrame = 0;
  private lastAnimationTime = 0;

  constructor(config: MonsterSpritesheetConfig) {
    this.config = config;
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
        reject(new Error(`Failed to load monster spritesheet: ${this.config.imagePath}`));
      };
      this.image.src = this.config.imagePath;
    });
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasSprite(spriteId: string): boolean {
    return this.config.sprites[spriteId] !== undefined;
  }

  /**
   * Draw monster sprite with direction and animation
   */
  drawMonsterSprite(
    ctx: CanvasRenderingContext2D,
    spriteId: string,
    x: number,
    y: number,
    tileSize: number,
    direction: string = 'front'
  ): void {
    if (!this.image) return;

    // ベーススプライトIDを取得（例: "enemy-1-0" -> "enemy"）
    const baseId = spriteId.split('-')[0];
    
    // console.log(`[DEBUG] MonsterSpriteManager: spriteId=${spriteId}, baseId=${baseId}, direction=${direction}`);
    
    // 方向に応じたスプライトIDを取得
    const directionSpriteId = this.getDirectionSpriteId(baseId, direction);
    const spriteDef = this.config.sprites[directionSpriteId];
    
    // console.log(`[DEBUG] MonsterSpriteManager: directionSpriteId=${directionSpriteId}, spriteDef=`, spriteDef);
    
    if (!spriteDef) {
      console.warn(`Monster sprite not found: ${directionSpriteId}`);
      return;
    }

    // アニメーション対応
    const animatedSpriteId = this.getAnimatedSpriteId(directionSpriteId);
    const finalSpriteDef = this.config.sprites[animatedSpriteId] || spriteDef;

    // console.log(`[DEBUG] MonsterSpriteManager: animatedSpriteId=${animatedSpriteId}, finalSpriteDef=`, finalSpriteDef);

    this.drawSpriteInternal(ctx, finalSpriteDef, x, y, tileSize);
  }

  /**
   * Get sprite ID for specific direction
   */
  private getDirectionSpriteId(baseSpriteId: string, direction: string): string {
    const directionMap: { [key: string]: string } = {
      'front': `${baseSpriteId}-1-0`,    // 正面（x1y0）
      'left': `${baseSpriteId}-1-1`,     // 左（x1y1）
      'right': `${baseSpriteId}-1-2`,    // 右（x1y2）
      'back': `${baseSpriteId}-1-3`,     // 後ろ（x1y3）
      'sw': `${baseSpriteId}-4-0`,       // 南西（x4y0）
      'se': `${baseSpriteId}-4-1`,       // 南東（x4y1）
      'nw': `${baseSpriteId}-4-2`,       // 北西（x4y2）
      'ne': `${baseSpriteId}-4-3`        // 北東（x4y3）
    };

    return directionMap[direction] || `${baseSpriteId}-1-0`;
  }

  /**
   * Get animated sprite ID for current frame
   */
  private getAnimatedSpriteId(spriteId: string): string {
    const now = Date.now();
    if (now - this.lastAnimationTime > 200) { // 200ms間隔でアニメーション
      this.animationFrame = (this.animationFrame + 1) % 5; // 5フレームのアニメーション
      this.lastAnimationTime = now;
    }

    // スプライトIDから座標を抽出（例: "enemy-1-0" -> enemy, 1, 0）
    const parts = spriteId.split('-');
    if (parts.length >= 3) {
      const baseId = parts[0];
      const x = parts[1];
      const y = parts[2];
      
      // 方向を取得（斜め方向を先に判定）
      let direction = 'front';
      if ((x === '3' || x === '4' || x === '5') && y === '0') direction = 'sw';
      else if ((x === '3' || x === '4' || x === '5') && y === '1') direction = 'se';
      else if ((x === '3' || x === '4' || x === '5') && y === '2') direction = 'nw';
      else if ((x === '3' || x === '4' || x === '5') && y === '3') direction = 'ne';
      else if (y === '1') direction = 'left';
      else if (y === '2') direction = 'right';
      else if (y === '3') direction = 'back';
      
      // 方向別のアニメーションを取得
      console.log(`[MonsterSpriteManager] スプライトID: ${spriteId}, 判定された方向: ${direction}`);
      const animation = this.config.animations[direction];
      if (animation && animation.frames.length > 0) {
        const frameIndex = this.animationFrame % animation.frames.length;
        const animatedSpriteId = animation.frames[frameIndex];
        
        console.log(`[MonsterSpriteManager] アニメーション: ${direction}, フレーム${frameIndex}: ${animatedSpriteId}`);
        
        // アニメーション用スプライトが存在するかチェック
        if (this.config.sprites[animatedSpriteId]) {
          return animatedSpriteId;
        }
      }
    }
    
    // 存在しない場合は元のスプライトIDを返す
    return spriteId;
  }

  private drawSpriteInternal(
    ctx: CanvasRenderingContext2D,
    spriteDef: MonsterSpriteDefinition,
    x: number,
    y: number,
    tileSize: number
  ): void {
    if (!this.image) return;

    // ピクセルアートのスムージングを無効化
    ctx.imageSmoothingEnabled = false;

    // 画像から32x32ピクセルを取得
    const actualImageTileSize = 32;
    const sourceX = spriteDef.x * actualImageTileSize;
    const sourceY = spriteDef.y * actualImageTileSize;
    const sourceWidth = spriteDef.width * actualImageTileSize;
    const sourceHeight = spriteDef.height * actualImageTileSize;

    // 32x32の画像を指定サイズのタイルに拡大して描画
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
   * Get sprite definition for a monster
   */
  getSpriteDefinition(spriteId: string): MonsterSpriteDefinition | undefined {
    return this.config.sprites[spriteId];
  }

  /**
   * Update animation frame
   */
  updateAnimation(): void {
    const now = Date.now();
    if (now - this.lastAnimationTime > 200) {
      this.animationFrame = (this.animationFrame + 1) % 5; // 5フレームのアニメーション
      this.lastAnimationTime = now;
    }
  }
}
