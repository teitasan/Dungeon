/**
 * Graphics System (headless-friendly stub)
 * Provides sprite registry and render commands for a 2D tile/sprite view.
 * In a browser, one could adapt `renderCommands` to Canvas/WebGL.
 */
import { Position } from '../types/core';
import { GameEntity } from '../types/entities';
export type SpriteId = string;
export interface Sprite {
    id: SpriteId;
    width: number;
    height: number;
    glyph?: string;
    source?: string;
    sx?: number;
    sy?: number;
}
export interface RenderCommand {
    type: 'tile' | 'sprite' | 'text';
    x: number;
    y: number;
    glyph?: string;
    text?: string;
    spriteId?: SpriteId;
}
export declare class GraphicsSystem {
    private tileSize;
    private sprites;
    constructor(tileSize?: number);
    registerSprite(sprite: Sprite): void;
    getSprite(id: SpriteId): Sprite | undefined;
    /**
     * Generate render commands for a tile map (headless)
     */
    renderTilemap(width: number, height: number, tileAt: (x: number, y: number) => {
        type: string;
    }): RenderCommand[];
    /**
     * Generate a render command for a game entity (uses first letter as fallback)
     */
    renderEntity(entity: GameEntity, spriteId?: SpriteId): RenderCommand;
    renderText(text: string, position: Position): RenderCommand;
    private tileGlyph;
}
//# sourceMappingURL=GraphicsSystem.d.ts.map