/**
 * Graphics System (headless-friendly stub)
 * Provides sprite registry and render commands for a 2D tile/sprite view.
 * In a browser, one could adapt `renderCommands` to Canvas/WebGL.
 */
export class GraphicsSystem {
    tileSize;
    sprites = new Map();
    constructor(tileSize = 16) {
        this.tileSize = tileSize;
    }
    registerSprite(sprite) {
        this.sprites.set(sprite.id, sprite);
    }
    getSprite(id) {
        return this.sprites.get(id);
    }
    /**
     * Generate render commands for a tile map (headless)
     */
    renderTilemap(width, height, tileAt) {
        const commands = [];
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
    renderEntity(entity, spriteId) {
        const glyph = entity.name ? entity.name.charAt(0).toLowerCase() : 'e';
        return { type: 'sprite', x: entity.position.x, y: entity.position.y, glyph, spriteId };
    }
    renderText(text, position) {
        return { type: 'text', x: position.x, y: position.y, text };
    }
    tileGlyph(type) {
        switch (type) {
            case 'floor': return '.';
            case 'stairs-down': return '>';
            case 'stairs-up': return '<';
            default: return '#';
        }
    }
}
//# sourceMappingURL=GraphicsSystem.js.map