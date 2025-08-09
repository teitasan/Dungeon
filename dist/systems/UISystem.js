/**
 * UI System (headless stub)
 * Provides basic text rendering for dungeon and simple message/status hooks.
 */
export class UISystem {
    dungeonManager;
    messages = [];
    constructor(dungeonManager) {
        this.dungeonManager = dungeonManager;
    }
    /**
     * Render current dungeon as ASCII string (for debugging/headless UI)
     */
    renderDungeonAsString(player, revealAll = true) {
        const dungeon = this.dungeonManager.getCurrentDungeon();
        if (!dungeon)
            return '';
        const lines = [];
        for (let y = 0; y < dungeon.height; y++) {
            let line = '';
            for (let x = 0; x < dungeon.width; x++) {
                const cell = dungeon.cells[y][x];
                let ch = '#';
                if (cell.type === 'floor')
                    ch = '.';
                if (cell.type === 'stairs-down')
                    ch = '>';
                if (cell.type === 'stairs-up')
                    ch = '<';
                // Draw player if present
                if (player && player.position.x === x && player.position.y === y) {
                    ch = '@';
                }
                else if (revealAll) {
                    // Draw other entities by first letter
                    const ents = this.dungeonManager.getEntitiesAt({ x, y });
                    if (ents.length > 0) {
                        const e = ents[0];
                        ch = (e.name?.charAt(0) || 'e').toLowerCase();
                    }
                }
                line += ch;
            }
            lines.push(line);
        }
        return lines.join('\n');
    }
    /**
     * Push a UI message
     */
    pushMessage(message) {
        this.messages.push(message);
        if (this.messages.length > 100)
            this.messages.shift();
    }
    /**
     * Get recent messages
     */
    getMessages(limit = 10) {
        return this.messages.slice(-limit);
    }
    /**
     * Simple status summary for a player
     */
    getPlayerStatusLine(player) {
        const hp = `${player.stats.hp}/${player.stats.maxHp}`;
        const lvl = `Lv${player.stats.level}`;
        const hunger = `Hun${player.hunger}/${player.maxHunger}`;
        return `${player.name} ${lvl} HP:${hp} ${hunger}`;
    }
}
//# sourceMappingURL=UISystem.js.map