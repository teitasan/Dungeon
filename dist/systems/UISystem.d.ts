/**
 * UI System (headless stub)
 * Provides basic text rendering for dungeon and simple message/status hooks.
 */
import { DungeonManager } from '../dungeon/DungeonManager';
import { PlayerEntity } from '../entities/Player';
export declare class UISystem {
    private dungeonManager;
    private messages;
    constructor(dungeonManager: DungeonManager);
    /**
     * Render current dungeon as ASCII string (for debugging/headless UI)
     */
    renderDungeonAsString(player?: PlayerEntity, revealAll?: boolean): string;
    /**
     * Push a UI message
     */
    pushMessage(message: string): void;
    /**
     * Get recent messages
     */
    getMessages(limit?: number): string[];
    /**
     * Simple status summary for a player
     */
    getPlayerStatusLine(player: PlayerEntity): string;
}
//# sourceMappingURL=UISystem.d.ts.map