import type { Dungeon } from '../types/dungeon';
import type { PlayerEntity } from '../entities/Player';
import { DungeonManager } from '../dungeon/DungeonManager.js';
export declare class CanvasRenderer {
    private canvas;
    private ctx;
    private tileSize;
    private viewportTilesX;
    private viewportTilesY;
    private minimapCtx;
    private minimapCanvas;
    private explored;
    private currentDungeonId;
    constructor(canvas: HTMLCanvasElement, tileSize?: number);
    /**
     * ビューポートのタイル数を設定（プレイヤー中心表示）
     */
    setViewportTiles(tilesX: number, tilesY: number): void;
    /** タイルピクセルサイズを変更（ビューポートに合わせてキャンバスも再設定） */
    setTileSize(tileSize: number): void;
    /**
     * ミニマップ用キャンバスを関連付け
     */
    attachMinimap(minimapCanvas: HTMLCanvasElement): void;
    render(dungeon: Dungeon, dungeonManager: DungeonManager, player: PlayerEntity): void;
    private computeCamera;
    private findRoomAt;
    private computeVisibility;
    private renderMinimap;
    private mix;
    private hexToRgb;
}
//# sourceMappingURL=CanvasRenderer.d.ts.map