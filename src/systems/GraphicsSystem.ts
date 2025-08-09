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
  // For headless: store an ASCII glyph as placeholder
  glyph?: string;
  // For browser, a spritesheet key/URL could be stored here
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

export class GraphicsSystem {
  private tileSize: number;
  private sprites: Map<SpriteId, Sprite> = new Map();

  constructor(tileSize: number = 16) {
    this.tileSize = tileSize;
  }

  registerSprite(sprite: Sprite): void {
    this.sprites.set(sprite.id, sprite);
  }

  getSprite(id: SpriteId): Sprite | undefined {
    return this.sprites.get(id);
  }

  /**
   * Generate render commands for a tile map (headless)
   */
  renderTilemap(width: number, height: number, tileAt: (x: number, y: number) => { type: string }): RenderCommand[] {
    const commands: RenderCommand[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = tileAt(x, y);
        const glyph = this.tileGlyph(tile.type);
        commands.push({ type: 'tile', x, y, glyph });
      }
    }
    return commands;
  }

  /**
   * Generate a render command for a game entity (uses first letter as fallback)
   */
  renderEntity(entity: GameEntity, spriteId?: SpriteId): RenderCommand {
    const glyph = (entity as any).name ? ((entity as any).name as string).charAt(0).toLowerCase() : 'e';
    return { type: 'sprite', x: entity.position.x, y: entity.position.y, glyph, spriteId };
  }

  renderText(text: string, position: Position): RenderCommand {
    return { type: 'text', x: position.x, y: position.y, text };
  }

  private tileGlyph(type: string): string {
    switch (type) {
      case 'floor': return '.';
      case 'stairs-down': return '>';
      case 'stairs-up': return '<';
      default: return '#';
    }
  }
}
