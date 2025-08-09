/**
 * Death and Game Over System
 * Applies penalties and resets state on player death.
 */
import { PlayerEntity } from '../entities/Player';
export interface DeathPenaltyConfig {
    itemLoss: 'all' | 'partial' | 'none';
    levelReset: boolean;
    statReset: boolean;
}
export interface GameOverConfig {
    allowRevive: boolean;
    allowContinue: boolean;
    resetToTown: boolean;
    showDeathMessage: boolean;
}
export interface DeathSystemConfig {
    penalties: DeathPenaltyConfig;
    gameOver: GameOverConfig;
}
export declare class DeathSystem {
    private config;
    constructor(config?: Partial<DeathSystemConfig>);
    /**
     * Handle player death according to configured penalties.
     */
    onPlayerDeath(player: PlayerEntity): {
        message: string;
    };
}
//# sourceMappingURL=DeathSystem.d.ts.map