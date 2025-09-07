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

// 一時的にコメントアウト
// export interface MonsterSpritesheetsConfig {
//   basic: MonsterSpritesheetConfig;
//   elite: MonsterSpritesheetConfig;
//   boss: MonsterSpritesheetConfig;
//   animations: {
//     [key: string]: {
//       frames: string[];
//       frameDuration: number;
//     };
//   };
// }

export class MonsterSpriteManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private spritesheets: any;
  private animations: any;
  private loaded = false;
  private animationFrame = 0;
  private lastAnimationTime = 0;

  constructor(config: any) {
    this.spritesheets = config;
    this.animations = config.animations;
  }

  async load(): Promise<void> {
    if (this.loaded) return;


    const loadPromises: Promise<void>[] = [];
    
    // 3つのスプライトシートを読み込み
    const types = ['basic', 'elite', 'boss'];
    
    for (const type of types) {
      const spritesheet = this.spritesheets[type];
      if (spritesheet && spritesheet.imagePath) {
        
        const loadPromise = new Promise<void>((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            this.images.set(type, image);
            resolve();
          };
          image.onerror = () => {
            reject(new Error(`Failed to load ${type}: ${spritesheet.imagePath}`));
          };
          image.src = spritesheet.imagePath;
        });
        loadPromises.push(loadPromise);
      }
    }

    try {
      await Promise.all(loadPromises);
      this.loaded = true;
    } catch (error) {
      console.error(`[DEBUG] Error loading spritesheets:`, error);
      throw error;
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasSprite(spriteId: string, monsterType: string = 'basic'): boolean {
    const spritesheet = this.spritesheets[monsterType];
    return spritesheet?.sprites[spriteId] !== undefined;
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
    direction: string = 'front',
    monsterType: string = 'basic'
  ): void {
    // 敵の種類に応じた画像を取得
    const image = this.images.get(monsterType);
    if (!image) {
      console.warn(`Image not found for type: ${monsterType}`);
      return;
    }

    // 敵の種類に応じたスプライトシート設定を取得
    const spritesheet = this.spritesheets[monsterType];
    if (!spritesheet) {
      console.warn(`Spritesheet not found for type: ${monsterType}`);
      return;
    }

    // 方向に応じたスプライトIDを取得
    const directionSpriteId = this.getDirectionSpriteId(spriteId, direction);
    const spriteDef = spritesheet.sprites[directionSpriteId];
    
    if (!spriteDef) {
      console.warn(`Sprite not found: ${directionSpriteId}`);
      return;
    }

    // アニメーション対応
    const animatedSpriteId = this.getAnimatedSpriteId(directionSpriteId);
    const finalSpriteDef = spritesheet.sprites[animatedSpriteId] || spriteDef;

    this.drawSpriteInternal(ctx, finalSpriteDef, x, y, tileSize, image);
  }

  /**
   * Get sprite ID for specific direction
   */
  private getDirectionSpriteId(baseSpriteId: string, direction: string): string {
    // スプライトIDからベースIDを抽出（例: "enemy-1-0" -> "enemy"）
    const baseId = baseSpriteId.split('-')[0];
    
    const directionMap: { [key: string]: string } = {
      'front': `${baseId}-1-0`,    // 正面（x1y0）
      'left': `${baseId}-1-1`,     // 左（x1y1）
      'right': `${baseId}-1-2`,    // 右（x1y2）
      'back': `${baseId}-1-3`,     // 後ろ（x1y3）
      'sw': `${baseId}-4-0`,       // 南西（x4y0）
      'se': `${baseId}-4-1`,       // 南東（x4y1）
      'nw': `${baseId}-4-2`,       // 北西（x4y2）
      'ne': `${baseId}-4-3`        // 北東（x4y3）
    };

    return directionMap[direction] || `${baseId}-1-0`;
  }

  /**
   * Get animated sprite ID for current frame
   */
  private getAnimatedSpriteId(spriteId: string): string {
    // アニメーション更新は updateAnimation() で行うため、ここでは現在のフレームを取得するのみ

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
      // console.log(`[MonsterSpriteManager] スプライトID: ${spriteId}, 判定された方向: ${direction}`);
      const animation = this.animations[direction];
      if (animation && animation.frames.length > 0) {
        const frameIndex = this.animationFrame % animation.frames.length;
        const animatedSpriteId = animation.frames[frameIndex];
        
        // console.log(`[MonsterSpriteManager] アニメーション: ${direction}, フレーム${frameIndex}: ${animatedSpriteId}`);
        
        // アニメーション用スプライトが存在するかチェック（基本的なスプライトシートでチェック）
        if (this.spritesheets.basic.sprites[animatedSpriteId]) {
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
    tileSize: number,
    image: HTMLImageElement
  ): void {

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
      image,
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
  getSpriteDefinition(spriteId: string, monsterType: string = 'basic'): MonsterSpriteDefinition | undefined {
    const spritesheet = this.spritesheets[monsterType];
    return spritesheet?.sprites[spriteId];
  }

  /**
   * Update animation frame
   */
  updateAnimation(): void {
    const now = Date.now();
    if (now - this.lastAnimationTime > 200) {
      this.animationFrame = (this.animationFrame + 1) % 4; // 4フレームのアニメーション（ABACループ）
      this.lastAnimationTime = now;
    }
  }
}
