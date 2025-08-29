/**
 * AI Component - manages AI behavior for monsters
 */

export interface AIComponent {
  readonly id: string;
  readonly type: 'ai';
  readonly behavior: AIBehavior;
  readonly state: AIState;
  readonly lastActionTime: number;
  readonly actionCooldown: number;
  readonly targetId?: string;
  readonly patrolPoints?: Array<{ x: number; y: number }>;
  readonly currentPatrolIndex: number;
}

export type AIBehavior = 
  | 'passive'      // 攻撃されない限り行動しない
  | 'aggressive'   // プレイヤーを見つけると攻撃
  | 'patrol'       // 決まったルートを巡回
  | 'wander'       // ランダムに移動
  | 'guard'        // 特定の場所を守る
  | 'flee'         // 低HP時に逃げる
  | 'boss';        // ボス行動

export type AIState = 
  | 'idle'         // 待機
  | 'patrolling'   // 巡回中
  | 'chasing'      // 追跡中
  | 'attacking'    // 攻撃中
  | 'fleeing'      // 逃走中
  | 'dead';        // 死亡

/**
 * AI Component Factory
 */
export class AIComponentFactory {
  static create(behavior: AIBehavior, actionCooldown: number = 1000): AIComponent {
    return {
      id: `ai_${Date.now()}_${Math.random()}`,
      type: 'ai',
      behavior,
      state: 'idle',
      lastActionTime: 0,
      actionCooldown,
      currentPatrolIndex: 0
    };
  }

  static createPatrol(patrolPoints: Array<{ x: number; y: number }>, actionCooldown: number = 1000): AIComponent {
    return {
      id: `ai_${Date.now()}_${Math.random()}`,
      type: 'ai',
      behavior: 'patrol',
      state: 'patrolling',
      lastActionTime: 0,
      actionCooldown,
      patrolPoints,
      currentPatrolIndex: 0
    };
  }

  static createAggressive(actionCooldown: number = 800): AIComponent {
    return {
      id: `ai_${Date.now()}_${Math.random()}`,
      type: 'ai',
      behavior: 'aggressive',
      state: 'idle',
      lastActionTime: 0,
      actionCooldown,
      currentPatrolIndex: 0
    };
  }

  static createPassive(actionCooldown: number = 2000): AIComponent {
    return {
      id: `ai_${Date.now()}_${Math.random()}`,
      type: 'ai',
      behavior: 'passive',
      state: 'idle',
      lastActionTime: 0,
      actionCooldown,
      currentPatrolIndex: 0
    };
  }
}

/**
 * AI Utilities
 */
export class AIUtils {
  /**
   * Check if AI can perform action based on cooldown
   */
  static canAct(ai: AIComponent, currentTime: number): boolean {
    return currentTime - ai.lastActionTime >= ai.actionCooldown;
  }

  /**
   * Update AI state
   */
  static updateState(ai: AIComponent, newState: AIState): AIComponent {
    return {
      ...ai,
      state: newState
    };
  }

  /**
   * Set target for AI
   */
  static setTarget(ai: AIComponent, targetId: string): AIComponent {
    return {
      ...ai,
      targetId
    };
  }

  /**
   * Clear target
   */
  static clearTarget(ai: AIComponent): AIComponent {
    return {
      ...ai,
      targetId: undefined
    };
  }

  /**
   * Move to next patrol point
   */
  static nextPatrolPoint(ai: AIComponent): AIComponent {
    if (!ai.patrolPoints || ai.patrolPoints.length === 0) {
      return ai;
    }

    const nextIndex = (ai.currentPatrolIndex + 1) % ai.patrolPoints.length;
    return {
      ...ai,
      currentPatrolIndex: nextIndex
    };
  }

  /**
   * Get current patrol point
   */
  static getCurrentPatrolPoint(ai: AIComponent): { x: number; y: number } | null {
    if (!ai.patrolPoints || ai.patrolPoints.length === 0) {
      return null;
    }
    return ai.patrolPoints[ai.currentPatrolIndex];
  }
}
