import type { Dungeon, Room } from '../types/dungeon';
import type { PlayerEntity } from '../entities/Player';
import type { GameEntity } from '../types/entities';
import type { GameConfig } from '../types/core.js';
import { DungeonManager } from '../dungeon/DungeonManager.js';
import { TilesetManager } from './TilesetManager.js';
import { ItemSpriteManager } from './ItemSpriteManager.js';
import { MonsterSpriteManager } from './MonsterSpriteManager.js';
import { DamageDisplayManager } from './DamageDisplayManager.js';

type MovementAnimation = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  elapsed: number;
  duration: number;
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private tileSize: number;
  private viewportTilesX: number | null = null;
  private viewportTilesY: number | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private explored: boolean[][] | null = null;
  private currentDungeonId: string | null = null;
  private tilesetManager: TilesetManager | null = null;
  private itemSpriteManager: ItemSpriteManager | null = null;
  private monsterSpriteManager: MonsterSpriteManager | null = null;
  private gameConfig: GameConfig | null = null;
  private clairvoyanceActive: boolean = false;
  private remillaActive: boolean = false;
  private trapDetectionActive: boolean = false;
  private monsterVisionActive: boolean = false;
  private dungeonManager: DungeonManager | null = null;
  private activeEffectsFloor: number | null = null;
  private transitionInProgress: boolean = false;
  private turnCursorActive: boolean = false; // Cキー方向転換中のカーソル表示フラグ
  private damageDisplayManager: DamageDisplayManager | null = null;
  private readonly movementAnimationDuration = 120; // ms
  private movementAnimations = new Map<string, MovementAnimation>();
  private lastEntityPositions = new Map<string, { x: number; y: number }>();

  constructor(private canvas: HTMLCanvasElement, tileSize: number = 20) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;
    this.tileSize = tileSize;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** 現在アイキャッチ演出中かどうか */
  public isInTransition(): boolean {
    return this.transitionInProgress;
  }

  /** 方向転換中カーソルの表示切替（Cキー押下中にON） */
  public setTurnCursorActive(active: boolean): void {
    this.turnCursorActive = active;
  }

  /**
   * ビューポートのタイル数を設定（プレイヤー中心表示）
   */
  setViewportTiles(tilesX: number, tilesY: number): void {
    this.viewportTilesX = Math.max(1, Math.floor(tilesX));
    this.viewportTilesY = Math.max(1, Math.floor(tilesY));
    this.canvas.width = this.viewportTilesX * this.tileSize;
    this.canvas.height = this.viewportTilesY * this.tileSize;
  }

  /**
   * フロア移動時のアイキャッチ演出（暗転＋ダンジョン名とフロアを表示）
   */
  public async playFloorTransition(dungeonName: string, floor: number): Promise<void> {
    if (this.transitionInProgress) return;
    this.transitionInProgress = true;
    try { window.dispatchEvent(new CustomEvent('ui-transition-start')); } catch {}

    // 暗転用オーバーレイキャンバスを取得
    const transitionCanvas = document.getElementById('transition-canvas') as HTMLCanvasElement;
    const transitionOverlay = document.getElementById('transition-overlay') as HTMLElement;
    
    if (!transitionCanvas || !transitionOverlay) {
      // フォールバック: メインキャンバスを使用
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';
      return this.playFloorTransitionOnCanvas(ctx, W, H, fontFamily, dungeonName, floor);
    }

    // オーバーレイを表示
    transitionOverlay.style.display = 'block';
    
    // キャンバスサイズをメインキャンバスに合わせる
    transitionCanvas.width = this.canvas.width;
    transitionCanvas.height = this.canvas.height;
    
    const ctx = transitionCanvas.getContext('2d')!;
    const W = transitionCanvas.width;
    const H = transitionCanvas.height;
    const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';

    await this.playFloorTransitionOnCanvas(ctx, W, H, fontFamily, dungeonName, floor);
    
    // オーバーレイを非表示
    transitionOverlay.style.display = 'none';
  }

  /**
   * 指定されたキャンバスで暗転演出を実行
   */
  private async playFloorTransitionOnCanvas(
    ctx: CanvasRenderingContext2D, 
    W: number, 
    H: number, 
    fontFamily: string, 
    dungeonName: string, 
    floor: number
  ): Promise<void> {

    const title = dungeonName;
    // 階層表記は BnF 形式（例: B3F）
    const subtitle = `B${floor}F`;

    const fadeIn = 350;   // ms
    const hold = 700;     // ms
    const fadeOut = 450;  // ms
    const total = fadeIn + hold + fadeOut;
    const start = performance.now();

    const drawFrame = (alpha: number) => {
      // 黒フェード
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);

      // テキスト（白・中央）
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha * 1.2).toFixed(3)})`;
      ctx.textBaseline = 'middle';

      // 文字間隔を少し広げて描画するユーティリティ（ふちどり付き）
      const drawTextWithTracking = (text: string, centerX: number, y: number, spacing: number) => {
        ctx.textAlign = 'left';
        // 文字ごとの幅を計測
        const widths: number[] = [];
        let total = 0;
        for (const ch of text) {
          const w = ctx.measureText(ch).width;
          widths.push(w);
          total += w;
        }
        total += spacing * Math.max(0, text.length - 1);
        let x = centerX - total / 2;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          // ふちどり（黒）を4方向に描画
          ctx.fillStyle = '#000000';
          ctx.fillText(ch, x - 1, y - 1);
          ctx.fillText(ch, x + 1, y - 1);
          ctx.fillText(ch, x - 1, y + 1);
          ctx.fillText(ch, x + 1, y + 1);
          // メインの文字（白色に戻す）
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha * 1.2).toFixed(3)})`;
          ctx.fillText(ch, x, y);
          x += widths[i] + spacing;
        }
      };

      // タイトル（画面サイズと文字列長に応じた文字サイズ）
      const maxTitleWidth = W * 0.8; // 画面幅の80%以内
      const baseTitleFontSize = Math.min(Math.floor(W / 20), Math.floor(H / 15), 48);
      
      // 文字列の長さを考慮してフォントサイズを調整
      ctx.font = `bold ${baseTitleFontSize}px '${fontFamily}', ui-monospace, Menlo, monospace`;
      const titleWidth = ctx.measureText(title).width;
      const titleFontSize = titleWidth > maxTitleWidth ? Math.floor(baseTitleFontSize * maxTitleWidth / titleWidth) : baseTitleFontSize;
      
      ctx.font = `bold ${titleFontSize}px '${fontFamily}', ui-monospace, Menlo, monospace`;
      drawTextWithTracking(title, W / 2, H / 2 - titleFontSize * 0.8, Math.max(1, Math.floor(titleFontSize / 8)));

      // サブタイトル（B●F、タイトルより少し小さく）
      const subFontSize = Math.floor(titleFontSize * 0.75);
      ctx.font = `${subFontSize}px '${fontFamily}', ui-monospace, Menlo, monospace`;
      drawTextWithTracking(subtitle, W / 2, H / 2 + titleFontSize * 0.3, Math.max(1, Math.floor(subFontSize / 8)));
      ctx.restore();
    };

    return await new Promise<void>((resolve) => {
      const tick = () => {
        const t = performance.now() - start;
        if (t >= total) {
          // 最終フレーム（透明）
          drawFrame(0);
          this.transitionInProgress = false;
          try { window.dispatchEvent(new CustomEvent('ui-transition-end')); } catch {}
          resolve();
          return;
        }

        let alpha = 0;
        if (t < fadeIn) {
          alpha = t / fadeIn;
        } else if (t < fadeIn + hold) {
          alpha = 1;
        } else {
          const u = (t - fadeIn - hold) / fadeOut;
          alpha = 1 - u;
        }

        drawFrame(alpha);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** タイルピクセルサイズを変更（ビューポートに合わせてキャンバスも再設定） */
  setTileSize(tileSize: number): void {
    this.tileSize = Math.max(1, Math.floor(tileSize));
    if (this.viewportTilesX && this.viewportTilesY) {
      this.canvas.width = this.viewportTilesX * this.tileSize;
      this.canvas.height = this.viewportTilesY * this.tileSize;
    }
  }

  /**
   * ミニマップ用キャンバスを関連付け
   */
  attachMinimap(minimapCanvas: HTMLCanvasElement): void {
    const mm = minimapCanvas.getContext('2d');
    if (!mm) throw new Error('2D context not supported for minimap');
    this.minimapCtx = mm;
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx.imageSmoothingEnabled = false;
    
    // オーバーレイ表示用にサイズを調整（60×45タイル × 6px）
    minimapCanvas.width = 360;
    minimapCanvas.height = 270;
    
  }

  /**
   * タイルセットマネージャーを設定
   */
  setTilesetManager(tilesetManager: TilesetManager): void {
    this.tilesetManager = tilesetManager;
  }

  setItemSpriteManager(itemSpriteManager: ItemSpriteManager): void {
    this.itemSpriteManager = itemSpriteManager;
  }

  setMonsterSpriteManager(monsterSpriteManager: MonsterSpriteManager): void {
    this.monsterSpriteManager = monsterSpriteManager;
  }

  /**
   * Check if entity is an item
   */
  private isItem(entity: any): boolean {
    // より厳密なアイテム判定
    const isItem = entity && 
      entity.itemType !== undefined && 
      entity.effects !== undefined && 
      entity.identified !== undefined && 
      entity.cursed !== undefined;
    
    
    return isItem;
  }

  /**
   * Check if entity is a monster
   */
  private isMonster(entity: any): boolean {
    // モンスター判定（aiType は廃止）
    return !!(entity && entity.monsterType !== undefined);
  }

  /**
   * Render item sprite
   */
  private renderItem(entity: any, x: number, y: number): void {
    if (!this.itemSpriteManager || !this.itemSpriteManager.isLoaded()) {
      // フォールバック: 文字で描画
      this.renderItemFallback(entity, x, y);
      return;
    }

    const spriteId = entity.spriteId;
    if (!spriteId || !this.itemSpriteManager.hasSprite(spriteId)) {
      // スプライトIDがない場合や存在しない場合はフォールバック
      this.renderItemFallback(entity, x, y);
      return;
    }

    // スプライトで描画
    this.itemSpriteManager.drawItemSprite(
      this.ctx,
      spriteId,
      x,
      y,
      this.tileSize
    );
  }

  /**
   * Fallback item rendering (text-based)
   */
  private renderItemFallback(entity: any, x: number, y: number): void {
    const glyph = entity.name ? entity.name.charAt(0).toUpperCase() : 'I';
    
    // 背景
    this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.ctx.fillRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);
    
    // 文字（ふちどり付き）
    const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';
    this.ctx.font = `${Math.floor(this.tileSize * 0.7)}px '${fontFamily}', ui-monospace, Menlo, monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2 + 1;
    
    // ふちどり（黒）を4方向に描画
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(glyph, centerX - 1, centerY - 1);
    this.ctx.fillText(glyph, centerX + 1, centerY - 1);
    this.ctx.fillText(glyph, centerX - 1, centerY + 1);
    this.ctx.fillText(glyph, centerX + 1, centerY + 1);
    
    // メインの文字
    this.ctx.fillStyle = '#d0d0d0';
    this.ctx.fillText(glyph, centerX, centerY);
  }

  /**
   * Render monster sprite
   */
  private renderMonster(entity: any, x: number, y: number): void {
    if (!this.monsterSpriteManager || !this.monsterSpriteManager.isLoaded()) {
      // フォールバック: 文字で描画
      this.renderMonsterFallback(entity, x, y);
      return;
    }

    const spriteId = entity.spriteId;
    const monsterType = (entity as any).spritesheet || 'basic';
    
    if (!spriteId || !this.monsterSpriteManager.hasSprite(spriteId, monsterType)) {
      // スプライトIDがない場合や存在しない場合はフォールバック
      this.renderMonsterFallback(entity, x, y);
      return;
    }

    // スプライトで描画（保存された方向を使用）
    const direction = (entity as any).currentDirection || 'front';
    this.monsterSpriteManager.drawMonsterSprite(
      this.ctx,
      spriteId,
      x,
      y,
      this.tileSize,
      direction,
      monsterType
    );
  }

  /**
   * Fallback monster rendering (text-based)
   */
  private renderMonsterFallback(entity: any, x: number, y: number): void {
    const glyph = entity.name ? entity.name.charAt(0).toUpperCase() : 'M';
    
    // 背景
    this.ctx.fillStyle = 'rgba(255,0,0,0.1)';
    this.ctx.fillRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);
    
    // 文字（ふちどり付き）
    const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';
    this.ctx.font = `${Math.floor(this.tileSize * 0.7)}px '${fontFamily}', ui-monospace, Menlo, monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2 + 1;
    
    // ふちどり（黒）を4方向に描画
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(glyph, centerX - 1, centerY - 1);
    this.ctx.fillText(glyph, centerX + 1, centerY - 1);
    this.ctx.fillText(glyph, centerX - 1, centerY + 1);
    this.ctx.fillText(glyph, centerX + 1, centerY + 1);
    
    // メインの文字
    this.ctx.fillStyle = '#ff4444';
    this.ctx.fillText(glyph, centerX, centerY);
  }

  /**
   * Calculate monster direction relative to player
   */
  private calculateMonsterDirection(monster: any, monsterX: number, monsterY: number): string {
    // プレイヤーの位置を取得（現在のビューポート中心から計算）
    const viewportCenterX = this.viewportTilesX ? this.viewportTilesX / 2 : 0;
    const viewportCenterY = this.viewportTilesY ? this.viewportTilesY / 2 : 0;
    
    // モンスターのビューポート内での相対位置
    const relativeX = monsterX / this.tileSize + viewportCenterX;
    const relativeY = monsterY / this.tileSize + viewportCenterY;
    
    // プレイヤー（ビューポート中心）からの方向を計算
    const deltaX = relativeX - viewportCenterX;
    const deltaY = relativeY - viewportCenterY;
    
    
    // 8方向の判定（座標系を修正）
    if (Math.abs(deltaX) < 0.5 && deltaY > 0) return 'front';      // 南（正面）
    if (Math.abs(deltaX) < 0.5 && deltaY < 0) return 'back';       // 北（後ろ）
    if (deltaX > 0 && Math.abs(deltaY) < 0.5) return 'right';      // 東（右）
    if (deltaX < 0 && Math.abs(deltaY) < 0.5) return 'left';       // 西（左）
    
    if (deltaX > 0 && deltaY > 0) return 'se';                      // 南東
    if (deltaX < 0 && deltaY > 0) return 'sw';                      // 南西
    if (deltaX > 0 && deltaY < 0) return 'ne';                      // 北東
    if (deltaX < 0 && deltaY < 0) return 'nw';                      // 北西
    
    return 'front'; // デフォルト
  }

  /**
   * ゲーム設定を設定
   */
  setGameConfig(gameConfig: GameConfig): void {
    this.gameConfig = gameConfig;
  }

  /**
   * ダメージ表示マネージャーを設定
   */
  setDamageDisplayManager(manager: DamageDisplayManager): void {
    this.damageDisplayManager = manager;
  }

  private getEntityId(entity: GameEntity): string | null {
    const id = (entity as any)?.id;
    if (id === undefined || id === null) return null;
    return String(id);
  }

  private updateMovementAnimations(entities: GameEntity[], deltaTime: number): void {
    const seen = new Set<string>();

    for (const entity of entities) {
      const id = this.getEntityId(entity);
      if (!id) continue;
      seen.add(id);

      const current = { x: entity.position.x, y: entity.position.y };
      const last = this.lastEntityPositions.get(id);

      if (!last) {
        this.lastEntityPositions.set(id, { ...current });
        continue;
      }

      const moved = last.x !== current.x || last.y !== current.y;
      if (moved) {
        const deltaX = current.x - last.x;
        const deltaY = current.y - last.y;
        const maxDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY));

        if (maxDelta <= 1) {
          this.movementAnimations.set(id, {
            startX: last.x,
            startY: last.y,
            endX: current.x,
            endY: current.y,
            elapsed: 0,
            duration: this.movementAnimationDuration
          });
        } else {
          this.movementAnimations.delete(id);
        }

        this.lastEntityPositions.set(id, { ...current });
      }
    }

    for (const id of Array.from(this.lastEntityPositions.keys())) {
      if (!seen.has(id)) {
        this.lastEntityPositions.delete(id);
        this.movementAnimations.delete(id);
      }
    }

    for (const [id, animation] of Array.from(this.movementAnimations.entries())) {
      animation.elapsed = Math.min(animation.elapsed + deltaTime, animation.duration);
      if (animation.elapsed >= animation.duration) {
        this.movementAnimations.delete(id);
      }
    }
  }

  private applyMovementEasing(progress: number): number {
    const clamped = Math.max(0, Math.min(1, progress));
    return clamped;
  }

  private getAnimatedPosition(entity: GameEntity): { x: number; y: number } {
    const id = this.getEntityId(entity);
    if (!id) {
      return { x: entity.position.x, y: entity.position.y };
    }

    const animation = this.movementAnimations.get(id);
    if (!animation) {
      return { x: entity.position.x, y: entity.position.y };
    }

    const progress = animation.duration === 0 ? 1 : animation.elapsed / animation.duration;
    const eased = this.applyMovementEasing(progress);

    return {
      x: animation.startX + (animation.endX - animation.startX) * eased,
      y: animation.startY + (animation.endY - animation.startY) * eased
    };
  }

  render(
    dungeon: Dungeon,
    dungeonManager: DungeonManager,
    player: PlayerEntity,
    turnSystem?: any,
    deltaTime: number = 16.67
  ): void {
    const { ctx, tileSize } = this;

    // フロア移動中の暗転表示中は通常の描画をスキップ
    if (this.transitionInProgress) {
      return;
    }

    // 敵のアニメーション更新
    if (this.monsterSpriteManager) {
      this.monsterSpriteManager.updateAnimation();
    }

    // Dungeon change → explored リセット + 効果リセット
    if (this.currentDungeonId !== dungeon.id) {
      this.currentDungeonId = dungeon.id;
      this.explored = Array.from({ length: dungeon.height }, () =>
        Array<boolean>(dungeon.width).fill(false)
      );
      
      // ダンジョン変更時は効果もリセット
      if (this.activeEffectsFloor !== null) {
        this.clairvoyanceActive = false;
        this.remillaActive = false;
        this.trapDetectionActive = false;
        this.monsterVisionActive = false;
        this.activeEffectsFloor = null;
      }
    }

    const entities = dungeonManager.getAllEntities();
    const trackedEntities: GameEntity[] = [...entities];
    if (!trackedEntities.some(e => (e as any)?.id === player.id)) {
      trackedEntities.push(player);
    }
    this.updateMovementAnimations(trackedEntities, deltaTime);

    const playerAnimated = this.getAnimatedPosition(player);
    const playerTileX = Math.max(0, Math.min(dungeon.width - 1, Math.round(playerAnimated.x)));
    const playerTileY = Math.max(0, Math.min(dungeon.height - 1, Math.round(playerAnimated.y)));

    // 可視マップを計算（部屋ベース）
    const visible = this.computeVisibility(dungeon, player, { x: playerTileX, y: playerTileY });

    // explored 更新（ミニマップ用）
    if (this.explored) {
      const px = playerTileX;
      const py = playerTileY;
      const room = this.findRoomAt(dungeon, px, py);
      
      if (room) {
        // 部屋内なら部屋全体をマッピング
        for (let y = room.y; y < room.y + room.height; y++) {
          for (let x = room.x; x < room.x + room.width; x++) {
            this.explored[y][x] = true;
          }
        }
        // 部屋の周囲1マスまで可視にする（通路・壁問わず）
        for (let y = room.y - 1; y < room.y + room.height + 1; y++) {
          for (let x = room.x - 1; x < room.x + room.width + 1; x++) {
            // 部屋の範囲外のみチェック
            const isOutsideRoom = (x < room.x || x >= room.x + room.width || y < room.y || y >= room.y + room.height);
            if (!isOutsideRoom) continue;
            
            // 境界チェック
            if (x < 0 || x >= dungeon.width || y < 0 || y >= dungeon.height) continue;
            
            // 通路・壁問わず可視にする
            this.explored[y][x] = true;
          }
        }
        
        const roomArea = room.width * room.height;
        const surroundingArea = (room.width + 2) * (room.height + 2) - roomArea;
      } else {
        // 通路内：プレイヤー位置と周囲8マス
        this.explored[py][px] = true;

        // 周囲8マスを可視にする
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // プレイヤー位置はスキップ

            const cx = px + dx;
            const cy = py + dy;

            if (cx < 0 || cx >= dungeon.width || cy < 0 || cy >= dungeon.height) continue;

            this.explored[cy][cx] = true;
          }
        }
      }
    }

    // カメラ計算
    const [camX, camY, viewW, viewH] = this.computeCamera(dungeon, player);

    // 背景クリア
    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const cameraOffsetTilesX = playerAnimated.x - player.position.x;
    const cameraOffsetTilesY = playerAnimated.y - player.position.y;
    const effectiveCamX = camX + cameraOffsetTilesX;
    const effectiveCamY = camY + cameraOffsetTilesY;

    // タイル描画（ビューポート内のみ）
    // 補間による最大1タイル分のずれを吸収するため、上下左右に1タイル分拡張
    for (let vy = -1; vy < viewH + 3; vy++) {
      const y = camY + vy;
      for (let vx = -1; vx < viewW + 3; vx++) {
        const x = camX + vx;
        
        // 補間オフセットを含めた描画位置
        const drawX = (vx - cameraOffsetTilesX - 0.5) * tileSize;
        const drawY = (vy - cameraOffsetTilesY - 0.5) * tileSize;

        // マップ範囲外の場合は壁として描画
        if (y < 0 || y >= dungeon.height || x < 0 || x >= dungeon.width) {
          if (this.tilesetManager && this.tilesetManager.isLoaded()) {
            // 床を描画してから壁を重ね描画
            this.tilesetManager.drawTile(ctx, 'floor', drawX, drawY, tileSize);
            this.tilesetManager.drawTile(ctx, 'wall', drawX, drawY, tileSize);
            
            // 視界外と同じ処理：少し暗くする
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000000';
            ctx.fillRect(drawX, drawY, tileSize, tileSize);
            ctx.globalAlpha = 1.0;
          } else {
            // フォールバック：色塗り（視界外と同じ処理）
            const color = '#15151b'; // wall
            const darkenedColor = this.mix(color, '#000000', 0.3);
            ctx.fillStyle = darkenedColor;
            ctx.fillRect(drawX, drawY, tileSize, tileSize);
          }
          continue;
        }

        const cell = dungeon.cells[y][x];
        const isVisible = visible[y][x];

        // マップチップ画像がある場合はそれを使用、なければ色塗り
        if (this.tilesetManager && this.tilesetManager.isLoaded()) {
          // 床を常に描画
          this.tilesetManager.drawTile(
            ctx,
            'floor',
            drawX,
            drawY,
            tileSize
          );
          
          // 壁や階段の場合は床の上に重ね描画
          if (cell.type === 'wall' || cell.type === 'stairs-down' || cell.type === 'stairs-up') {
            const overlayType = cell.type === 'wall' ? 'wall' : cell.type;
            this.tilesetManager.drawTile(
              ctx,
              overlayType,
              drawX,
              drawY,
              tileSize
            );
          }
          
          // 見えていない範囲は少し暗くする
          if (!isVisible) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000000';
            ctx.fillRect(drawX, drawY, tileSize, tileSize);
            ctx.globalAlpha = 1.0;
          }
        } else {
          // フォールバック: 色塗り
          let color = '#15151b'; // wall
          switch (cell.type) {
            case 'floor':
              color = '#2a2a31';
              break;
            case 'stairs-down':
              color = '#b58900';
              break;
            case 'stairs-up':
              color = '#268bd2';
              break;
            default:
              color = '#15151b';
              break;
          }

          // 視界外でも色は変更しない（すべて同じ色で表示）

          ctx.fillStyle = color;
          ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }
      }
    }

    // グリッド（薄く）
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = -1; x <= viewW + 2; x++) {
      const lineX = (x - cameraOffsetTilesX - 0.5) * tileSize + 0.5;
      ctx.beginPath();
      ctx.moveTo(lineX, (-1 - cameraOffsetTilesY - 0.5) * tileSize);
      ctx.lineTo(lineX, (viewH + 2 - cameraOffsetTilesY - 0.5) * tileSize);
      ctx.stroke();
    }
    for (let y = -1; y <= viewH + 2; y++) {
      const lineY = (y - cameraOffsetTilesY - 0.5) * tileSize + 0.5;
      ctx.beginPath();
      ctx.moveTo((-1 - cameraOffsetTilesX - 0.5) * tileSize, lineY);
      ctx.lineTo((viewW + 2 - cameraOffsetTilesX - 0.5) * tileSize, lineY);
      ctx.stroke();
    }

    // エンティティ描画（可視セルのみ）
    for (const entity of entities) {
      const ex = entity.position.x;
      const ey = entity.position.y;
      if (ex < camX || ex >= camX + viewW + 2 || ey < camY || ey >= camY + viewH + 2) continue;
      if (!visible[ey][ex]) continue;
      if ((entity as any).id === player.id) continue;
      
      const animatedPosition = this.getAnimatedPosition(entity);
      const gx = (animatedPosition.x - effectiveCamX - 0.5) * tileSize;
      const gy = (animatedPosition.y - effectiveCamY - 0.5) * tileSize;
      
      try {
        // アイテムの場合はスプライトで描画
        if (this.isItem(entity)) {
          this.renderItem(entity, gx, gy);
        } else if (this.isMonster(entity)) {
          // モンスターの場合はスプライトで描画
          this.renderMonster(entity, gx, gy);
        } else {
          // その他のエンティティは従来通り文字で描画
          const glyph = (entity as any).name ? ((entity as any).name as string).charAt(0).toUpperCase() : 'E';
          this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
          this.ctx.fillRect(gx + 3, gy + 3, tileSize - 6, tileSize - 6);
          
          // 文字（ふちどり付き）
          const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';
          this.ctx.font = `${Math.floor(tileSize * 0.7)}px '${fontFamily}', ui-monospace, Menlo, monospace`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          const centerX = gx + tileSize / 2;
          const centerY = gy + tileSize / 2 + 1;
          
          // ふちどり（黒）を4方向に描画
          this.ctx.fillStyle = '#000000';
          this.ctx.fillText(glyph, centerX - 1, centerY - 1);
          this.ctx.fillText(glyph, centerX + 1, centerY - 1);
          this.ctx.fillText(glyph, centerX - 1, centerY + 1);
          this.ctx.fillText(glyph, centerX + 1, centerY + 1);
          
          // メインの文字
          this.ctx.fillStyle = '#d0d0d0';
          this.ctx.fillText(glyph, centerX, centerY);
        }
      } catch (error) {
        // エラーが発生しても描画を続行
      }
    }

    // プレイヤー（円形）
    try {
      const px = (playerAnimated.x - effectiveCamX - 0.5) * tileSize + tileSize / 2;
      const py = (playerAnimated.y - effectiveCamY - 0.5) * tileSize + tileSize / 2;
      const playerDirection = (player as any).direction || 'south';
    
    // 円形を描画
    ctx.beginPath();
    ctx.arc(px, py, tileSize * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = this.gameConfig?.ui.minimap.playerColor || '#58a6ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1f6feb';
    ctx.stroke();

    // かわいいおめめ（プレイヤーの向きに基づいて配置）
    const directionAngles: Record<string, number> = {
      'north': 0,
      'northeast': Math.PI / 4,
      'east': Math.PI / 2,
      'southeast': 3 * Math.PI / 4,
      'south': Math.PI,
      'southwest': 5 * Math.PI / 4,
      'west': 3 * Math.PI / 2,
      'northwest': 7 * Math.PI / 4
    };
    
    const angle = directionAngles[playerDirection] || 0;
    const eyeDistance = tileSize * 0.15;  // 目の間の距離
    const eyeSize = tileSize * 0.08;      // 目のサイズ
    const eyeOffset = tileSize * 0.25;    // プレイヤー円からの距離
    
    // 左目の位置を計算
    const leftEyeAngle = angle - Math.PI / 6;  // 少し内側
    const leftEyeX = px + Math.sin(leftEyeAngle) * eyeOffset;
    const leftEyeY = py - Math.cos(leftEyeAngle) * eyeOffset;
    
    // 右目の位置を計算
    const rightEyeAngle = angle + Math.PI / 6;  // 少し内側
    const rightEyeX = px + Math.sin(rightEyeAngle) * eyeOffset;
    const rightEyeY = py - Math.cos(rightEyeAngle) * eyeOffset;
    
    // 左目を描画
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';  // 白目
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 左目の黒目を描画
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // 右目を描画
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';  // 白目
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 右目の黒目を描画
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeSize * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 向きカーソル（三角アイコン）: Cキー押下中のみ表示
    if (this.turnCursorActive) {
      const dirVec: Record<string, { x: number; y: number }> = {
        north: { x: 0, y: -1 },
        northeast: { x: 1, y: -1 },
        east: { x: 1, y: 0 },
        southeast: { x: 1, y: 1 },
        south: { x: 0, y: 1 },
        southwest: { x: -1, y: 1 },
        west: { x: -1, y: 0 },
        northwest: { x: -1, y: -1 }
      };
      const v = dirVec[playerDirection] || { x: 0, y: 1 };
      const tx = player.position.x + v.x;
      const ty = player.position.y + v.y;
      if (tx >= 0 && tx < dungeon.width && ty >= 0 && ty < dungeon.height) {
        const baseX = (tx - effectiveCamX - 0.5) * tileSize;
        const baseY = (ty - effectiveCamY - 0.5) * tileSize;
        const cx2 = baseX + tileSize / 2;
        const cy2 = baseY + tileSize / 2;
        const len = Math.hypot(v.x, v.y) || 1;
        const nx = v.x / len;
        const ny = v.y / len;
        const size = tileSize * 0.16; // 三角のサイズ（リクエストにより半分に）
        // 正三角形の3頂点（向きベクトルを±120度回転）
        const rot = (x: number, y: number, ang: number) => ({
          x: x * Math.cos(ang) - y * Math.sin(ang),
          y: x * Math.sin(ang) + y * Math.cos(ang)
        });
        const v1 = { x: nx, y: ny };
        const v2 = rot(nx, ny, (2 * Math.PI) / 3);
        const v3 = rot(nx, ny, -(2 * Math.PI) / 3);
        const p1 = { x: cx2 + v1.x * size, y: cy2 + v1.y * size };
        const p2 = { x: cx2 + v2.x * size, y: cy2 + v2.y * size };
        const p3 = { x: cx2 + v3.x * size, y: cy2 + v3.y * size };
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fillStyle = '#ffffff'; // 白一色のシンプルな三角
        ctx.fill();
      }
    }
    
    } catch (error) {
      // エラーが発生しても描画を続行
    }

    // ダメージ表示を描画（補間オフセットを考慮）
    if (this.damageDisplayManager) {
      this.damageDisplayManager.render(
        ctx,
        tileSize,
        effectiveCamX,
        effectiveCamY,
        dungeonManager
      );
    }

    // ミニマップ描画
    this.renderMinimap(
      dungeon,
      visible,
      camX,
      camY,
      viewW,
      viewH,
      player,
      { x: playerTileX, y: playerTileY }
    );
  }

  private computeCamera(dungeon: Dungeon, player: PlayerEntity): [number, number, number, number] {
    const tilesX = this.viewportTilesX ?? dungeon.width;
    const tilesY = this.viewportTilesY ?? dungeon.height;
    // プレイヤーを常に画面中央に配置（境界クランプなし）
    const camX = player.position.x - Math.floor(tilesX / 2);
    const camY = player.position.y - Math.floor(tilesY / 2);
    return [camX, camY, tilesX, tilesY];
  }

  private findRoomAt(dungeon: Dungeon, x: number, y: number): Room | null {
    for (const room of dungeon.rooms) {
      if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
        return room;
      }
    }
    return null;
  }

  private computeVisibility(
    dungeon: Dungeon,
    player: PlayerEntity,
    overridePosition?: { x: number; y: number }
  ): boolean[][] {
    const w = dungeon.width;
    const h = dungeon.height;
    const visible: boolean[][] = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
    const pxFloat = overridePosition?.x ?? player.position.x;
    const pyFloat = overridePosition?.y ?? player.position.y;
    const px = Math.max(0, Math.min(w - 1, Math.round(pxFloat)));
    const py = Math.max(0, Math.min(h - 1, Math.round(pyFloat)));

    const room = this.findRoomAt(dungeon, px, py);
    if (room) {
      // 部屋内なら部屋全体可視
      let roomVisibleCount = 0;
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          visible[y][x] = true;
          roomVisibleCount++;
        }
      }
      
      // 部屋の周囲1マスまで可視にする（通路・壁問わず）
      let surroundingVisibleCount = 0;
      for (let y = room.y - 1; y < room.y + room.height + 1; y++) {
        for (let x = room.x - 1; x < room.x + room.width + 1; x++) {
          // 部屋の範囲外のみチェック
          const isOutsideRoom = (x < room.x || x >= room.x + room.width || y < room.y || y >= room.y + room.height);
          if (!isOutsideRoom) continue;
          
          // 境界チェック
          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          
          // 通路・壁問わず可視にする
          visible[y][x] = true;
          surroundingVisibleCount++;
        }
      }
      
    } else {
      // 廊下内：プレイヤー位置と周囲8マス
      visible[py][px] = true;

      // 周囲8マスを可視にする
      let visibleCount = 1; // プレイヤー位置
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue; // プレイヤー位置はスキップ

          const cx = px + dx;
          const cy = py + dy;

          if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

          visible[cy][cx] = true;
          visibleCount++;
        }
      }
      
    }

    return visible;
  }

  private renderMinimap(
    dungeon: Dungeon,
    visible: boolean[][],
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    player: PlayerEntity,
    playerTileOverride?: { x: number; y: number }
  ): void {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const mm = this.minimapCtx;
    const W = this.minimapCanvas.width;
    const H = this.minimapCanvas.height;

    // ミニマップ描画時はスムージングを無効化（ピクセル境界を明確に）
    mm.imageSmoothingEnabled = false;

    try {
      // 背景を透明に（クリア）
      mm.clearRect(0, 0, W, H);

      // タイルサイズを固定6pxに設定
      const mmTile = 6;
      
      
      const offsetX = Math.floor((W - dungeon.width * mmTile) / 2);
      const offsetY = Math.floor((H - dungeon.height * mmTile) / 2);
      
    // 描画（探索済みの場所のみ、レミーラ効果が有効な場合は全エリア表示）
    let exploredCount = 0;
    let visibleCount = 0;
    let wallCount = 0;
    let floorCount = 0;
    let stairsDownCount = 0;
    let stairsUpCount = 0;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.cells[y][x];
        const isVisible = visible && visible[y] && visible[y][x] ? visible[y][x] : false;
        const isExplored = this.explored && this.explored[y] && this.explored[y][x] ? this.explored[y][x] : false;

        if (isExplored) exploredCount++;
        if (isVisible) visibleCount++;

        // 探索済みの場所のみ表示
        if (!isExplored) continue;
        
        // セルタイプの統計
        switch (cell.type) {
          case 'wall':
            wallCount++;
            break;
          case 'floor':
          case 'room':
          case 'corridor':
            floorCount++;
            break;
          case 'stairs-down':
            stairsDownCount++;
            break;
          case 'stairs-up':
            stairsUpCount++;
            break;
          default:
            break;
        }

        let color = 'rgba(42, 42, 53, 0.7)'; // wall base (半透明)
        let cellType = cell.type;
        switch (cell.type) {
          case 'floor':
            color = 'rgba(74, 74, 85, 0.6)'; // 床（半透明）
            break;
          case 'room':
            color = 'rgba(74, 74, 85, 0.6)'; // 部屋（半透明）
            break;
          case 'corridor':
            color = 'rgba(74, 74, 85, 0.6)'; // 通路（半透明）
            break;
          case 'stairs-down':
            // 設定ファイルから色を取得、なければデフォルト色
            color = this.gameConfig?.ui?.minimap?.colors?.['stairs-down'] || 'rgba(135, 206, 235, 0.8)'; // 階段下（半透明）
            break;
          case 'stairs-up':
            // 設定ファイルから色を取得、なければデフォルト色
            color = this.gameConfig?.ui?.minimap?.colors?.['stairs-up'] || 'rgba(135, 206, 235, 0.8)'; // 階段上（半透明）
            break;
          default:
            color = '#2a2a35';
            break;
        }
        // 視界外でも色は変更しない（すべて同じ色で表示）
        
        // 壁は描画しない
        if (cell.type === 'wall') {
          // 壁は描画をスキップ
        } else if (cell.type === 'stairs-down' || cell.type === 'stairs-up') {
          // 階段アイコンを描画（111111, 100001, 100001, 100001, 100001, 111111）
          const baseX = offsetX + x * mmTile;
          const baseY = offsetY + y * mmTile;
          
          // 床色を取得（階段の背景色）
          const floorColor = 'rgba(74, 74, 85, 0.6)'; // 床と同じ色
          
          // まず床色で全体を塗りつぶし
          mm.fillStyle = floorColor;
          mm.fillRect(baseX, baseY, 6, 6);
          
          // 1の部分を階段色で上書き
          mm.fillStyle = color;
          
          // 1行目: 111111 (全6ピクセル)
          mm.fillRect(baseX + 0, baseY + 0, 6, 1);
          
          // 2-5行目: 100001 (両端のみ)
          mm.fillRect(baseX + 0, baseY + 1, 1, 1); // 左端
          mm.fillRect(baseX + 5, baseY + 1, 1, 1); // 右端
          mm.fillRect(baseX + 0, baseY + 2, 1, 1); // 左端
          mm.fillRect(baseX + 5, baseY + 2, 1, 1); // 右端
          mm.fillRect(baseX + 0, baseY + 3, 1, 1); // 左端
          mm.fillRect(baseX + 5, baseY + 3, 1, 1); // 右端
          mm.fillRect(baseX + 0, baseY + 4, 1, 1); // 左端
          mm.fillRect(baseX + 5, baseY + 4, 1, 1); // 右端
          
          // 6行目: 111111 (全6ピクセル)
          mm.fillRect(baseX + 0, baseY + 5, 6, 1);
        } else {
          // その他のセルは塗りつぶしで描画
          mm.fillStyle = color;
          mm.fillRect(offsetX + x * mmTile, offsetY + y * mmTile, mmTile, mmTile);
        }
        
      }
    }

    // 床の領域境界に白い枠線を描画
    mm.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // 白い枠線（半透明）
    mm.lineWidth = 1;
    
    // 床系セルの境界を検出して枠線を描画
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.cells[y][x];
        const isVisible = visible && visible[y] && visible[y][x] ? visible[y][x] : false;
        const isExplored = this.explored && this.explored[y] && this.explored[y][x] ? this.explored[y][x] : false;
        
        // 探索済みの場所のみ表示
        if (!isExplored) continue;
        
        // 床系セルの場合のみ境界線を描画（視界外でも探索済みなら枠線を描画）
        if (cell.type === 'floor' || cell.type === 'room' || cell.type === 'corridor') {
          const baseX = offsetX + x * mmTile;
          const baseY = offsetY + y * mmTile;
          
          // 上辺：上のセルが床系でない場合（未探索でも床系なら枠線を描画しない）
          if (y === 0 || !this.isFloorType(dungeon.cells[y-1][x])) {
            mm.beginPath();
            mm.moveTo(baseX, baseY);
            mm.lineTo(baseX + mmTile, baseY);
            mm.stroke();
          }
          
          // 下辺：下のセルが床系でない場合（未探索でも床系なら枠線を描画しない）
          if (y === dungeon.height - 1 || !this.isFloorType(dungeon.cells[y+1][x])) {
            mm.beginPath();
            mm.moveTo(baseX, baseY + mmTile);
            mm.lineTo(baseX + mmTile, baseY + mmTile);
            mm.stroke();
          }
          
          // 左辺：左のセルが床系でない場合（未探索でも床系なら枠線を描画しない）
          if (x === 0 || !this.isFloorType(dungeon.cells[y][x-1])) {
            mm.beginPath();
            mm.moveTo(baseX, baseY);
            mm.lineTo(baseX, baseY + mmTile);
            mm.stroke();
          }
          
          // 右辺：右のセルが床系でない場合（未探索でも床系なら枠線を描画しない）
          if (x === dungeon.width - 1 || !this.isFloorType(dungeon.cells[y][x+1])) {
            mm.beginPath();
            mm.moveTo(baseX + mmTile, baseY);
            mm.lineTo(baseX + mmTile, baseY + mmTile);
            mm.stroke();
          }
        }
      }
    }

    // アイテムを表示（視界内のみ、水色）
    if (this.dungeonManager) {
      const all = this.dungeonManager.getAllEntities();
      const items = all.filter(e => (e as any).constructor?.name === 'ItemEntity');
      mm.fillStyle = '#0ad4e1'; // 水色
      for (const it of items) {
        const ix = it.position.x;
        const iy = it.position.y;
        if (ix < 0 || ix >= dungeon.width || iy < 0 || iy >= dungeon.height) continue;
        if (!visible[iy][ix]) continue; // 視界内のみ

        const x = offsetX + ix * mmTile;
        const y = offsetY + iy * mmTile;
        this.drawMinimapIcon(mm, x, y);
      }
      
      // 敵を表示（視界内のみ、赤色）
      const monsters = all.filter(e => (e as any).constructor?.name === 'MonsterEntity');
      mm.fillStyle = '#da1809'; // 赤
      for (const m of monsters) {
        const mx = m.position.x;
        const my = m.position.y;
        if (mx < 0 || mx >= dungeon.width || my < 0 || my >= dungeon.height) continue;
        if (!visible[my][mx]) continue; // 視界内のみ

        const x = offsetX + mx * mmTile;
        const y = offsetY + my * mmTile;
        this.drawMinimapIcon(mm, x, y);
      }
    }


    // プレイヤー点
    mm.fillStyle = this.gameConfig?.ui.minimap.playerColor || 'rgba(88, 166, 255, 0.9)'; // プレイヤー（半透明）
    const playerTileX = playerTileOverride ? playerTileOverride.x : player.position.x;
    const playerTileY = playerTileOverride ? playerTileOverride.y : player.position.y;
    const x = offsetX + playerTileX * mmTile;
    const y = offsetY + playerTileY * mmTile;
    this.drawMinimapIcon(mm, x, y);

      // 特殊効果による表示（千里眼・透視効果）
      this.renderMinimapItems(mm, dungeon, mmTile, offsetX, offsetY);
      this.renderMinimapMonsters(mm, dungeon, mmTile, offsetX, offsetY);

      // 描画完了後、スムージング設定を元に戻す
      mm.imageSmoothingEnabled = false;
    } catch (error) {
      // エラーを無視
    }
  }

  /**
   * 床系セルかどうかを判定（階段も含む）
   */
  private isFloorType(cell: any): boolean {
    return cell && (cell.type === 'floor' || cell.type === 'room' || cell.type === 'corridor' || 
                   cell.type === 'stairs-down' || cell.type === 'stairs-up');
  }


  /**
   * ミニマップアイコン描画ヘルパー
   */
  private drawMinimapIcon(
    mm: CanvasRenderingContext2D,
    x: number,
    y: number
  ): void {
    // アイコン形状の定義（共用）
    const iconPattern = [
      { x: 1, y: 0, w: 4, h: 1 }, // 011110
      { x: 0, y: 1, w: 6, h: 1 }, // 111111
      { x: 0, y: 2, w: 6, h: 1 }, // 111111
      { x: 0, y: 3, w: 6, h: 1 }, // 111111
      { x: 0, y: 4, w: 6, h: 1 }, // 111111
      { x: 1, y: 5, w: 4, h: 1 }  // 011110
    ];

    for (const pattern of iconPattern) {
      mm.fillRect(x + pattern.x, y + pattern.y, pattern.w, pattern.h);
    }
  }

  /**
   * ミニマップにアイテム位置を表示
   */
  private renderMinimapItems(
    mm: CanvasRenderingContext2D,
    dungeon: Dungeon,
    mmTile: number,
    offsetX: number,
    offsetY: number
  ): void {
    // 千里眼効果が有効な場合のみアイテムを表示
    if (!this.clairvoyanceActive) return;

    // DungeonManagerが設定されていない場合は表示しない
    if (!this.dungeonManager) return;

    // ダンジョン内の全エンティティを取得し、アイテムをフィルタリング
    const allEntities = this.dungeonManager.getAllEntities();
    const items = allEntities.filter(entity => {
      // アイテムかどうかを判定（クラス名、ID、名前で判定）
      return (entity as any).constructor?.name === 'ItemEntity' ||
             entity.id.includes('scroll') || entity.id.includes('item') || 
             (entity as any).name?.includes('巻物') || (entity as any).name?.includes('アイテム');
    });

    // アイテムを表示（6x6ピクセル）
    mm.fillStyle = '#0ad4e1'; // 水色
    for (const item of items) {
      if (item.position) {
        const x = offsetX + item.position.x * mmTile;
        const y = offsetY + item.position.y * mmTile;
        this.drawMinimapIcon(mm, x, y);
      }
    }
  }

  /**
   * ミニマップにモンスター位置を表示
   */
  private renderMinimapMonsters(
    mm: CanvasRenderingContext2D,
    dungeon: Dungeon,
    mmTile: number,
    offsetX: number,
    offsetY: number
  ): void {
    // 透視効果が有効な場合のみモンスターを表示
    if (!this.monsterVisionActive) return;

    // DungeonManagerが設定されていない場合は表示しない
    if (!this.dungeonManager) return;

    // ダンジョン内の全エンティティを取得し、モンスターをフィルタリング
    const allEntities = this.dungeonManager.getAllEntities();
    const monsters = allEntities.filter(entity => {
      // モンスターかどうかを判定（クラス名、ID、名前で判定）
      return (entity as any).constructor?.name === 'MonsterEntity' ||
             entity.id.includes('monster') || entity.id.includes('enemy') || 
             (entity as any).name?.includes('モンスター') || (entity as any).name?.includes('敵');
    });

    // モンスターを表示（6x6ピクセル）
    mm.fillStyle = '#da1809'; // 赤色
    for (const monster of monsters) {
      if (monster.position) {
        const x = offsetX + monster.position.x * mmTile;
        const y = offsetY + monster.position.y * mmTile;
        this.drawMinimapIcon(mm, x, y);
      }
    }
  }

  /**
   * 千里眼効果を有効化
   */
  public activateClairvoyance(floor: number): void {
    this.clairvoyanceActive = true;
    this.activeEffectsFloor = floor;
    
    // ミニマップが接続されている場合は即座に更新
    this.forceMinimapUpdate();
  }

  /**
   * 千里眼効果を無効化
   */
  public deactivateClairvoyance(): void {
    this.clairvoyanceActive = false;
  }

  /**
   * DungeonManagerを設定
   */
  public setDungeonManager(dungeonManager: DungeonManager): void {
    this.dungeonManager = dungeonManager;
  }

  /**
   * レミーラ効果を有効化（今のフロアをすべて探索済みにする）
   */
  public activateRemilla(floor: number): void {
    this.remillaActive = true;
    this.activeEffectsFloor = floor;
    
    // 現在のフロアをすべて探索済みにする
    if (this.dungeonManager) {
      const currentDungeon = this.dungeonManager.getCurrentDungeon();
      if (currentDungeon && this.explored) {
        for (let y = 0; y < currentDungeon.height; y++) {
          for (let x = 0; x < currentDungeon.width; x++) {
            if (!this.explored[y]) {
              this.explored[y] = [];
            }
            this.explored[y][x] = true;
          }
        }
      }
    }
    
    // ミニマップが接続されている場合は即座に更新
    this.forceMinimapUpdate();
  }

  /**
   * レミーラ効果を無効化
   */
  public deactivateRemilla(): void {
    this.remillaActive = false;
  }

  /**
   * 罠探知効果を有効化
   */
  public activateTrapDetection(floor: number): void {
    this.trapDetectionActive = true;
    this.activeEffectsFloor = floor;
    
    // ミニマップが接続されている場合は即座に更新
    this.forceMinimapUpdate();
  }

  /**
   * 罠探知効果を無効化
   */
  public deactivateTrapDetection(): void {
    this.trapDetectionActive = false;
  }

  /**
   * 透視効果を有効化
   */
  public activateMonsterVision(floor: number): void {
    this.monsterVisionActive = true;
    this.activeEffectsFloor = floor;
    
    // ミニマップが接続されている場合は即座に更新
    this.forceMinimapUpdate();
  }

  /**
   * 透視効果を無効化
   */
  public deactivateMonsterVision(): void {
    this.monsterVisionActive = false;
  }

  /**
   * ミニマップの強制更新
   */
  private forceMinimapUpdate(): void {
    if (!this.minimapCtx || !this.minimapCanvas) {
      return;
    }
    
    // 現在のダンジョンとプレイヤー情報がない場合は更新できない
    if (!this.dungeonManager) {
      return;
    }
    
    const currentDungeon = this.dungeonManager.getCurrentDungeon();
    if (!currentDungeon) {
      return;
    }
    
    const player = this.dungeonManager.getAllEntities().find(e => e.id === 'player-1') as PlayerEntity;
    if (!player) {
      return;
    }
    
    // 可視性を計算してミニマップを更新
    const visible = this.computeVisibility(currentDungeon, player);
    const [camX, camY, viewW, viewH] = this.computeCamera(currentDungeon, player);
    this.renderMinimap(currentDungeon, visible, camX, camY, viewW, viewH, player);
  }

  /**
   * フロア変更時に効果をチェック（異なるフロアの場合は効果を無効化）
   */
  
  public checkFloorChange(currentFloor: number): void {
    // フロアが変更された場合、すべての効果を無効化
    if (this.activeEffectsFloor !== null && this.activeEffectsFloor !== currentFloor) {
      this.clairvoyanceActive = false;
      this.remillaActive = false;
      this.trapDetectionActive = false;
      this.monsterVisionActive = false;
      this.activeEffectsFloor = null;
    }
  }

  // 簡易カラー合成
  private mix(hex1: string, hex2: string, ratio: number): string {
    const c1 = this.hexToRgb(hex1);
    const c2 = this.hexToRgb(hex2);
    const r = Math.round(c1[0] * (1 - ratio) + c2[0] * ratio);
    const g = Math.round(c1[1] * (1 - ratio) + c2[1] * ratio);
    const b = Math.round(c1[2] * (1 - ratio) + c2[2] * ratio);
    return `rgb(${r},${g},${b})`;
  }

  private hexToRgb(hex: string): [number, number, number] {
    // Accept formats like '#rrggbb' or 'rgb(...)'
    if (hex.startsWith('#')) {
      const v = hex.replace('#', '');
      const r = parseInt(v.substring(0, 2), 16);
      const g = parseInt(v.substring(2, 4), 16);
      const b = parseInt(v.substring(4, 6), 16);
      return [r, g, b];
    }
    if (hex.startsWith('rgb')) {
      const m = hex.match(/rgb\((\d+),(\d+),(\d+)\)/);
      if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    }
    return [0, 0, 0];
  }
}
