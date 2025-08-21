/**
 * Input handling system for keyboard and mouse input
 */

import type { Position } from '../types/core.js';
import type { GameConfig } from '../types/core.js';

export interface InputAction {
  type: 'movement' | 'action';
  direction?: 'up' | 'down' | 'left' | 'right';
  action?: 'confirm' | 'cancel' | 'inventory';
}

export class InputSystem {
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  /**
   * キーイベントを入力アクションに変換
   */
  processKeyEvent(key: string): InputAction | null {
    // 移動キーの処理
    for (const [direction, keys] of Object.entries(this.config.input.keys.movement)) {
      if (keys.includes(key)) {
        return {
          type: 'movement',
          direction: direction as 'up' | 'down' | 'left' | 'right'
        };
      }
    }

    // アクションキーの処理
    for (const [action, keys] of Object.entries(this.config.input.keys.actions)) {
      if (keys.includes(key)) {
        return {
          type: 'action',
          action: action as 'confirm' | 'cancel' | 'inventory'
        };
      }
    }

    return null;
  }

  /**
   * 移動方向から次の位置を計算
   */
  calculateNextPosition(current: Position, direction: 'up' | 'down' | 'left' | 'right'): Position {
    const movementConfig = this.config.player.movementConfig;
    const distance = movementConfig.distance;

    switch (direction) {
      case 'up':
        return { x: current.x, y: current.y - distance };
      case 'down':
        return { x: current.x, y: current.y + distance };
      case 'left':
        return { x: current.x - distance, y: current.y };
      case 'right':
        return { x: current.x + distance, y: current.y };
      default:
        return current;
    }
  }

  /**
   * キーが移動キーかチェック
   */
  isMovementKey(key: string): boolean {
    return Object.values(this.config.input.keys.movement).flat().includes(key);
  }

  /**
   * キーがアクションキーかチェック
   */
  isActionKey(key: string): boolean {
    return Object.values(this.config.input.keys.actions).flat().includes(key);
  }

  /**
   * キーがナビゲーションキーかチェック（ページスクロール防止用）
   */
  isNavigationKey(key: string): boolean {
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', '.'];
    return navKeys.includes(key);
  }
}