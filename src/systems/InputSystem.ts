/**
 * Input handling system for keyboard and mouse input
 * Extended for ECS integration and event-driven architecture
 */

import type { Position } from '../types/core.js';
import type { GameConfig } from '../types/core.js';

export interface InputAction {
  type: 'movement' | 'action';
  direction?: 'up' | 'down' | 'left' | 'right';
  action?: 'confirm' | 'cancel' | 'inventory';
}

export interface ECSInputEvent {
  type: 'player-movement' | 'player-action' | 'system-command';
  playerId: string;
  data: {
    direction?: 'up' | 'down' | 'left' | 'right';
    action?: 'confirm' | 'cancel' | 'inventory' | 'attack' | 'use-item';
    targetPosition?: Position;
    itemId?: string;
  };
  timestamp: number;
}

export interface ECSInputHandler {
  handleInputEvent(event: ECSInputEvent): Promise<boolean>;
  isInputEnabled(): boolean;
  setInputEnabled(enabled: boolean): void;
}

export class InputSystem implements ECSInputHandler {
  private config: GameConfig;
  private inputEnabled: boolean = true;
  private eventQueue: ECSInputEvent[] = [];
  private eventHandlers: Map<string, (event: ECSInputEvent) => void> = new Map();

  constructor(config: GameConfig) {
    this.config = config;
  }

  /**
   * 入力イベントハンドラーを登録
   */
  registerEventHandler(eventType: string, handler: (event: ECSInputEvent) => void): void {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * 入力イベントをキューに追加
   */
  queueInputEvent(event: ECSInputEvent): void {
    if (this.inputEnabled) {
      this.eventQueue.push(event);
    }
  }

  /**
   * キューされたイベントを処理
   */
  async processEventQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        await this.handleInputEvent(event);
      }
    }
  }

  /**
   * キーイベントをECS入力イベントに変換
   */
  processKeyEvent(key: string, playerId: string = 'player-1'): ECSInputEvent | null {
    // 移動キーの処理
    for (const [direction, keys] of Object.entries(this.config.input.keys.movement)) {
      if (keys.includes(key)) {
        return {
          type: 'player-movement',
          playerId,
          data: {
            direction: direction as 'up' | 'down' | 'left' | 'right'
          },
          timestamp: Date.now()
        };
      }
    }

    // アクションキーの処理
    for (const [action, keys] of Object.entries(this.config.input.keys.actions)) {
      if (keys.includes(key)) {
        return {
          type: 'player-action',
          playerId,
          data: {
            action: action as 'confirm' | 'cancel' | 'inventory'
          },
          timestamp: Date.now()
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

  // ECSInputHandler インターフェースの実装
  async handleInputEvent(event: ECSInputEvent): Promise<boolean> {
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      try {
        handler(event);
        return true;
      } catch (error) {
        console.error('Error handling input event:', error);
        return false;
      }
    }
    return false;
  }

  isInputEnabled(): boolean {
    return this.inputEnabled;
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  /**
   * システムコマンドイベントを作成
   */
  createSystemCommand(command: string, data?: any): ECSInputEvent {
    return {
      type: 'system-command',
      playerId: 'system',
      data: {
        action: command as any,
        ...data
      },
      timestamp: Date.now()
    };
  }
}