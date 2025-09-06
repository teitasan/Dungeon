// 移動パターンの基本型定義
export type MovementPattern =
  | 'approach'        // 近づく
  | 'escape'          // 離れる
  | 'idle'            // 動かない
  | 'keep-distance'   // 一定の距離を保つ
  | 'random'          // ランダム
  | 'patrol'          // パトロール
  | 'warp';           // ワープ

export interface MovementPatternConfig {
  // 共通
  decisionCooldown?: number;

  // approach / keep-distance
  desiredRange?: number; // approach
  minDistance?: number;  // keep-distance
  maxDistance?: number;  // keep-distance

  // flee
  safeDistance?: number;

  // random
  moveProbability?: number; // 0..1

  // patrol
  patrolPoints?: { x: number; y: number }[];
  loop?: boolean;
  pauseTicks?: number;

  // warp
  warpRange?: number;     // マンハッタン距離の最大
  warpCooldownTicks?: number; // 簡易クールダウン（ターン単位想定）
}
