/**
 * ダメージ表示関連の型定義
 */

export interface DamageDisplay {
  id: string;
  entityId: string; // エンティティID
  damage: number;
  isCritical: boolean;
  isHealing: boolean;
  isMiss?: boolean; // MISS表示フラグ
  timestamp: number;
  duration: number; // 表示時間（ミリ秒）
  animationOffset: number; // アニメーション用のオフセット
  positionOffset?: number; // 同じ位置の表示オフセット
  alpha?: number; // 透明度（0-1）
  x: number; // 表示位置X（エンティティ削除後も保持）
  y: number; // 表示位置Y（エンティティ削除後も保持）
}

export interface DamageDisplayConfig {
  duration: number; // 表示時間（ミリ秒）
  fontSize: number;
  fontFamily: string;
  criticalMultiplier: number; // クリティカル時のサイズ倍率
  animationSpeed: number; // アニメーション速度
  maxDisplays: number; // 同時表示可能な最大数
}

export interface DamageDisplayManager {
  addDamage(entityId: string, damage: number, isCritical?: boolean, isHealing?: boolean): void;
  addMiss(entityId: string): void;
  update(deltaTime: number, dungeonManager: any): void;
  render(ctx: CanvasRenderingContext2D, tileSize: number, camX: number, camY: number, dungeonManager: any): void;
  clear(): void;
  clearByEntity(entityId: string): void;
}
