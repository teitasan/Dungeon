/**
 * ダメージ表示管理クラス
 * キャラクターの頭上にダメージ数値を表示する
 */

import { DamageDisplay, DamageDisplayConfig, DamageDisplayManager as IDamageDisplayManager } from '../types/damage-display';
import { GameEntity } from '../types/core';
import { FontManager } from '../core/FontManager.js';

export class DamageDisplayManager implements IDamageDisplayManager {
  private displays: DamageDisplay[] = [];
  private config: DamageDisplayConfig;
  private nextId = 0;

  constructor(config?: Partial<DamageDisplayConfig>) {
    // FontManagerからフォント設定を取得
    const fontManager = FontManager.getInstance();
    const fontFamily = fontManager ? fontManager.getCSSFontFamily() : 'PixelMplus12';
    
    this.config = {
      duration: 600, // 0.6秒間表示
      fontSize: 12, // 12pxに調整
      fontFamily: fontFamily, // FontManagerから取得したフォント設定
      criticalMultiplier: 1.5,
      animationSpeed: 15, // ピクセル/秒（さらにゆっくりに）
      maxDisplays: 20,
      bounceHeight: 6, // 飛び跳ねの高さ（ピクセル）
      bounceDuration: 0.2, // 飛び跳ねアニメーションの持続時間（秒）- キレがある
      ...config
    };
  }

  /**
   * ダメージ表示を追加
   */
  addDamage(entityId: string, damage: number, isCritical: boolean = false, isHealing: boolean = false, x?: number, y?: number): void {
    // 最大表示数を超えている場合は古いものを削除
    if (this.displays.length >= this.config.maxDisplays) {
      this.displays.shift();
    }

    // 同じエンティティの既存表示数をカウント（現在表示中のもののみ）
    const currentTime = Date.now();
    const sameEntityCount = this.displays.filter(d => 
      d.entityId === entityId && (currentTime - d.timestamp) < d.duration
    ).length;

    const display: DamageDisplay = {
      id: `damage_${this.nextId++}`,
      entityId,
      damage,
      isCritical,
      isHealing,
      timestamp: Date.now(),
      duration: this.config.duration,
      animationOffset: 0,
      positionOffset: sameEntityCount,
      x: x || 0,
      y: y || 0
    };

    this.displays.push(display);
  }

  /**
   * MISS表示を追加
   */
  addMiss(entityId: string, x?: number, y?: number): void {
    // 最大表示数を超えている場合は古いものを削除
    if (this.displays.length >= this.config.maxDisplays) {
      this.displays.shift();
    }

    // 同じエンティティの既存表示数をカウント（現在表示中のもののみ）
    const currentTime = Date.now();
    const sameEntityCount = this.displays.filter(d => 
      d.entityId === entityId && (currentTime - d.timestamp) < d.duration
    ).length;

    const display: DamageDisplay = {
      id: `miss_${this.nextId++}`,
      entityId,
      damage: 0, // MISSの場合は0
      isCritical: false,
      isHealing: false,
      isMiss: true, // MISSフラグを追加
      timestamp: Date.now(),
      duration: this.config.duration,
      animationOffset: 0,
      positionOffset: sameEntityCount,
      x: x || 0,
      y: y || 0
    };

    this.displays.push(display);
  }

  /**
   * ダメージ表示を更新
   */
  update(deltaTime: number, dungeonManager: any): void {
    const currentTime = Date.now();
    
    // 期限切れの表示とエンティティが存在しない表示を削除
    const beforeCount = this.displays.length;
    this.displays = this.displays.filter(display => {
      const elapsed = currentTime - display.timestamp;
      if (elapsed >= display.duration) {
        return false; // 期限切れ
      }
      
      // エンティティの存在チェックを無効化（死亡後もダメージ表示を継続）
      // エンティティが削除されてもダメージ表示は継続し、期限切れのみで削除
      
      return true;
    });
    const afterCount = this.displays.length;

    // アニメーション更新
    this.displays.forEach(display => {
      const elapsed = currentTime - display.timestamp;
      const progress = elapsed / display.duration;
      
      // 飛び跳ねるアニメーション（SFC時代のファイナルファンタジー風）
      const bounceProgress = Math.min(1, elapsed / (this.config.bounceDuration * 1000));
      
      // 放物線を描くアニメーション（上に跳ね上がって元の位置に戻る）
      // 0から1の間で、0.5の時点で最高点に到達
      let bounceOffset = 0;
      if (bounceProgress < 1) {
        // 0.4秒間の飛び跳ねアニメーション（キレがある動き）
        const t = bounceProgress;
        // より鋭い放物線（y = -6x^2 + 6x）でキレのある動き
        const parabola = -6 * t * t + 6 * t;
        bounceOffset = parabola * this.config.bounceHeight;
      } else {
        // 0.4秒後は元の位置（0）で固定（残り0.6秒間）
        bounceOffset = 0;
      }
      
      display.animationOffset = bounceOffset;
      
      // フェードイン効果（最初の0.1秒で透明から表示）
      const fadeInEndTime = 0.1; // 0.1秒でフェードイン完了
      const fadeInProgress = Math.min(1, progress / fadeInEndTime);
      
      // フェードアウト効果（0.8秒後から開始、0.2秒で完全に消える）
      const fadeOutStartTime = 0.8; // 80%の時点からフェードアウト開始
      const fadeOutProgress = Math.max(0, (progress - fadeOutStartTime) / (1 - fadeOutStartTime));
      
      // フェードインとフェードアウトを組み合わせ
      display.alpha = fadeInProgress * (1 - fadeOutProgress);
    });
  }

  /**
   * ダメージ表示を描画
   */
  render(ctx: CanvasRenderingContext2D, tileSize: number, camX: number = 0, camY: number = 0, dungeonManager: any): void {
    if (this.displays.length === 0) {
      return;
    }

    ctx.save();

    this.displays.forEach((display, index) => {
      // 保存された位置を使用（エンティティが削除されていても表示継続）
      let entityX = display.x;
      let entityY = display.y;
      
      // エンティティが存在する場合は現在位置を更新
      if (dungeonManager) {
        const entities = dungeonManager.getAllEntities();
        const entity = entities.find((e: GameEntity) => e.id === display.entityId);
        if (entity && entity.position) {
          entityX = entity.position.x;
          entityY = entity.position.y;
          // 位置を更新して保存
          display.x = entityX;
          display.y = entityY;
        }
      }
      
      // カメラ位置を考慮して画面座標を計算（マップと同じ0.5オフセットを適用）
      const baseX = (entityX - camX - 0.5) * tileSize + tileSize / 2;
      // エンティティのマスの中心から半マス分上に開始
      const baseY = (entityY - camY - 0.5) * tileSize + tileSize / 2 - tileSize / 2 - display.animationOffset;
      
      // 同じ位置の表示オフセットを適用（縦方向のみずらす）
      const positionOffset = display.positionOffset || 0;
      const screenX = baseX;
      const screenY = baseY - (positionOffset * 6); // 6ピクセルずつ上にずらす
      
      // 画面範囲外の場合は描画をスキップ
      if (screenX < -100 || screenX > 1000 || screenY < -100 || screenY > 1000) {
        return;
      }

      // フォント設定（クリティカルでもサイズは変更しない）
      const fontSize = this.config.fontSize;
      
      // フォント設定を明示的にリセット
      ctx.imageSmoothingEnabled = true; // 文字描画時はスムージングを有効
      ctx.font = `${fontSize}px ${this.config.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '-1px'; // 文字間隔を狭くする

      // 色設定
      if (display.isHealing) {
        ctx.fillStyle = '#00ff00'; // 緑色（回復）
      } else if (display.isCritical) {
        ctx.fillStyle = '#da1809'; // 赤色（クリティカル）- マップの敵と同じ色
      } else {
        ctx.fillStyle = '#ffffff'; // 白色（通常ダメージ）
      }

      // アルファ値設定
      ctx.globalAlpha = display.alpha || 1;

      // 縁取りを描画（黒2px）
      ctx.fillStyle = '#000000';
      const text = display.isMiss ? 'MISS' : display.damage.toString();
      const outlineWidth = 1;
      
      for (let x = -outlineWidth; x <= outlineWidth; x++) {
        for (let y = -outlineWidth; y <= outlineWidth; y++) {
          if (x !== 0 || y !== 0) { // 中心は除外
            ctx.fillText(text, screenX + x, screenY + y);
          }
        }
      }
      
      // メインテキストを描画
      if (display.isMiss) {
        ctx.fillStyle = '#ffffff'; // MISSは白色
        ctx.fillText(text, screenX, screenY);
      } else if (display.isHealing) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText(text, screenX, screenY);
      } else if (display.isCritical) {
        ctx.fillStyle = '#da1809'; // マップの敵と同じ色
        ctx.fillText(text, screenX, screenY);
      } else {
        ctx.fillStyle = '#ffffff'; // 通常ダメージは白色
        ctx.fillText(text, screenX, screenY);
      }
    });

    ctx.restore();
  }

  /**
   * 全てのダメージ表示をクリア
   */
  clear(): void {
    const clearedCount = this.displays.length;
    this.displays = [];
  }

  /**
   * 特定のエンティティのダメージ表示をクリア（遅延付き）
   */
  clearByEntity(entityId: string, delay: number = 200): void {
    setTimeout(() => {
      const beforeCount = this.displays.length;
      this.displays = this.displays.filter(display => display.entityId !== entityId);
      const afterCount = this.displays.length;
    }, delay);
  }

  /**
   * ターン処理と連動してダメージ表示をクリア
   */
  clearOnTurnEnd(): void {
    // 現在表示中のダメージ表示をすべてクリア
    const clearedCount = this.displays.length;
    this.displays = [];
    console.log(`[DEBUG] ターン終了でダメージ表示をクリア: ${clearedCount}個の表示をクリア`);
  }

  /**
   * 設定を更新
   */
  updateConfig(newConfig: Partial<DamageDisplayConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
