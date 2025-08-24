import type { Dungeon, Room } from '../types/dungeon';
import type { PlayerEntity } from '../entities/Player';
import type { GameConfig } from '../types/core.js';
import { DungeonManager } from '../dungeon/DungeonManager.js';
import { TilesetManager } from './TilesetManager.js';

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
  private gameConfig: GameConfig | null = null;

  constructor(private canvas: HTMLCanvasElement, tileSize: number = 20) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not supported');
    this.ctx = ctx;
    this.tileSize = tileSize;
    this.ctx.imageSmoothingEnabled = false;
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
  }

  /**
   * タイルセットマネージャーを設定
   */
  setTilesetManager(tilesetManager: TilesetManager): void {
    this.tilesetManager = tilesetManager;
  }

  /**
   * ゲーム設定を設定
   */
  setGameConfig(gameConfig: GameConfig): void {
    this.gameConfig = gameConfig;
  }

  render(dungeon: Dungeon, dungeonManager: DungeonManager, player: PlayerEntity, turnSystem?: any): void {
    const { ctx, tileSize } = this;

    // Dungeon change → explored リセット
    if (this.currentDungeonId !== dungeon.id) {
      this.currentDungeonId = dungeon.id;
      this.explored = Array.from({ length: dungeon.height }, () =>
        Array<boolean>(dungeon.width).fill(false)
      );
    }

    // 可視マップを計算（部屋ベース）
    const visible = this.computeVisibility(dungeon, player);

    // explored 更新（ミニマップ用）
    if (this.explored) {
      const px = player.position.x;
      const py = player.position.y;
      const room = this.findRoomAt(dungeon, px, py);
      
      console.log(`Player at (${px}, ${py}), room: ${room ? `(${room.x},${room.y}) ${room.width}x${room.height}` : 'none'}`);
      
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
        console.log(`Room exploration: room=${roomArea}, surrounding=${surroundingArea}, total=${roomArea + surroundingArea}`);
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
        
        console.log(`Corridor exploration: player + 8 surrounding tiles = 9`);
      }
    }

    // カメラ計算
    const [camX, camY, viewW, viewH] = this.computeCamera(dungeon, player);

    // 背景クリア
    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // タイル描画（ビューポート内のみ）
    // 0.5マス分のオフセットを考慮して描画範囲を2マス拡張
    for (let vy = 0; vy < viewH + 2; vy++) {
      const y = camY + vy;
      for (let vx = 0; vx < viewW + 2; vx++) {
        const x = camX + vx;
        
        // 描画位置を0.5マス分ずらす
        const drawX = (vx - 0.5) * tileSize;
        const drawY = (vy - 0.5) * tileSize;

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

          // 見えていない範囲は少し暗くする
          if (!isVisible) {
            color = this.mix(color, '#000000', 0.3);
          }

          ctx.fillStyle = color;
          ctx.fillRect(drawX, drawY, tileSize, tileSize);
        }
      }
    }

    // グリッド（薄く）
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= viewW + 2; x++) {
      ctx.beginPath();
      ctx.moveTo((x - 0.5) * tileSize + 0.5, 0);
      ctx.lineTo((x - 0.5) * tileSize + 0.5, (viewH + 2) * tileSize);
      ctx.stroke();
    }
    for (let y = 0; y <= viewH + 2; y++) {
      ctx.beginPath();
      ctx.moveTo(0, (y - 0.5) * tileSize + 0.5);
      ctx.lineTo((viewW + 2) * tileSize, (y - 0.5) * tileSize + 0.5);
      ctx.stroke();
    }

    // エンティティ描画（可視セルのみ）
    const entities = dungeonManager.getAllEntities();
    for (const entity of entities) {
      const ex = entity.position.x;
      const ey = entity.position.y;
      if (ex < camX || ex >= camX + viewW + 2 || ey < camY || ey >= camY + viewH + 2) continue;
      if (!visible[ey][ex]) continue;
      if ((entity as any).id === player.id) continue;
      const gx = (ex - camX - 0.5) * tileSize;
      const gy = (ey - camY - 0.5) * tileSize;
      const glyph = (entity as any).name ? ((entity as any).name as string).charAt(0).toUpperCase() : 'E';
      this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.ctx.fillRect(gx + 3, gy + 3, tileSize - 6, tileSize - 6);
      this.ctx.fillStyle = '#d0d0d0';
              const fontFamily = this.gameConfig?.ui?.fonts?.primary || 'PixelMplus';
        this.ctx.font = `${Math.floor(tileSize * 0.7)}px '${fontFamily}', ui-monospace, Menlo, monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(glyph, gx + tileSize / 2, gy + tileSize / 2 + 1);
    }

    // プレイヤー
    const px = (player.position.x - camX - 0.5) * tileSize + tileSize / 2;
    const py = (player.position.y - camY - 0.5) * tileSize + tileSize / 2;
    ctx.beginPath();
    ctx.arc(px, py, tileSize * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#58a6ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1f6feb';
    ctx.stroke();

    // 方向ノッチ
    ctx.beginPath();
    ctx.moveTo(px, py - tileSize * 0.35);
    ctx.lineTo(px, py - tileSize * 0.15);
    ctx.strokeStyle = '#cdd9e5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ミニマップ描画
    this.renderMinimap(dungeon, visible, camX, camY, viewW, viewH, player);
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

  private computeVisibility(dungeon: Dungeon, player: PlayerEntity): boolean[][] {
    const w = dungeon.width;
    const h = dungeon.height;
    const visible: boolean[][] = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
    const px = player.position.x;
    const py = player.position.y;

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
      
      console.log(`Room visibility: room=${roomVisibleCount}, surrounding=${surroundingVisibleCount}, total=${roomVisibleCount + surroundingVisibleCount}`);
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
      
      // デバッグ：周囲8マスの可視化確認
      console.log(`Corridor visibility: player at (${px}, ${py}), visible tiles: ${visibleCount}`);
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
    player: PlayerEntity
  ): void {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const mm = this.minimapCtx;
    const W = this.minimapCanvas.width;
    const H = this.minimapCanvas.height;

    // ミニマップ描画時はスムージングを有効化（ピクセル境界を明確に）
    mm.imageSmoothingEnabled = true;

    // 背景
    mm.fillStyle = '#0b0b0d';
    mm.fillRect(0, 0, W, H);

    // Canvasのサイズに合わせて適切なタイルサイズを計算
    // タイルサイズを3pxに固定
    const mmTile = 3;
    const offsetX = Math.floor((W - dungeon.width * mmTile) / 2);
    const offsetY = Math.floor((H - dungeon.height * mmTile) / 2);

    // 描画（探索済みの場所のみ）
    let exploredCount = 0;
    let visibleCount = 0;
    let wallCount = 0;
    let floorCount = 0;
    let stairsDownCount = 0;
    let stairsUpCount = 0;
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const cell = dungeon.cells[y][x];
        const isVisible = visible[y][x];
        const isExplored = this.explored ? this.explored[y][x] : false;

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
            console.log(`Unknown cell type: "${cell.type}" at (${x}, ${y})`);
            break;
        }

        let color = '#2a2a35'; // wall base (brighter for minimap)
        let cellType = cell.type;
        switch (cell.type) {
          case 'floor':
            color = '#4a4a55';
            break;
          case 'room':
            color = '#4a4a55'; // 部屋は床と同じ色
            break;
          case 'corridor':
            color = '#4a4a55'; // 通路も床と同じ色
            break;
          case 'stairs-down':
            color = '#d4a017';
            break;
          case 'stairs-up':
            color = '#3aa3e3';
            break;
          default:
            color = '#2a2a35';
            break;
        }
        // 見えていない範囲は少し暗くする
        if (!isVisible) {
          color = this.mix(color, '#000000', 0.3);
        }
        mm.fillStyle = color;
        mm.fillRect(offsetX + x * mmTile, offsetY + y * mmTile, mmTile, mmTile);
        
        // デバッグ：色の使用状況を追跡
        if (x === 0 && y === 0) { // 最初のセルのみログ出力
          console.log(`Minimap colors: wall=${cell.type === 'wall' ? 'used' : 'not used'}, floor=${cell.type === 'floor' ? 'used' : 'not used'}, stairs-down=${cell.type === 'stairs-down' ? 'used' : 'not used'}, stairs-up=${cell.type === 'stairs-up' ? 'used' : 'not used'}`);
        }
      }
    }
    
    // デバッグ情報をコンソールに出力
    console.log(`Minimap: explored=${exploredCount}, visible=${visibleCount}, total=${dungeon.width * dungeon.height}`);
    console.log(`Minimap cell types: wall=${wallCount}, floor=${floorCount}, stairs-down=${stairsDownCount}, stairs-up=${stairsUpCount}`);

    // ビューポート枠
    mm.strokeStyle = 'rgba(255,255,255,0.6)';
    mm.lineWidth = 1;
    mm.strokeRect(
      offsetX + camX * mmTile + 0.5,
      offsetY + camY * mmTile + 0.5,
      viewW * mmTile,
      viewH * mmTile
    );

    // プレイヤー点
    mm.fillStyle = '#58a6ff';
    mm.fillRect(
      offsetX + player.position.x * mmTile,
      offsetY + player.position.y * mmTile,
      Math.max(1, Math.floor(mmTile / 2)),
      Math.max(1, Math.floor(mmTile / 2))
    );

    // 描画完了後、スムージング設定を元に戻す
    mm.imageSmoothingEnabled = false;
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


