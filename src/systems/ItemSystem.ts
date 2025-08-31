/**
 * Item system for managing items, inventory, and item usage
 */

import { GameEntity } from '../types/entities';
import { ItemEntity } from '../entities/Item';
import { PlayerEntity } from '../entities/Player';
import { Position } from '../types/core';
import { DungeonManager } from '../dungeon/DungeonManager';
import { MonsterEntity } from '../entities/Monster';

// Item usage result
export interface ItemUsageResult {
  success: boolean;
  item: ItemEntity;
  user: GameEntity;
  effects: ItemUsageEffect[];
  message: string;
  consumed: boolean;
  // 新しく追加：効果適用後の処理用
  appliedEffects?: string[];
}

export interface ItemUsageEffect {
  type: ItemUsageEffectType;
  value?: number;
  target: GameEntity;
  success: boolean;
  message: string;
}

export type ItemUsageEffectType = 
  | 'heal' 
  | 'restore-hunger' 
  | 'cure-status' 
  | 'stat-boost' 
  | 'teleport' 
  | 'identify' 
  | 'damage' 
  | 'special';

// Item pickup result
export interface ItemPickupResult {
  success: boolean;
  item: ItemEntity;
  entity: GameEntity;
  message: string;
  reason?: string;
}

// Item drop result
export interface ItemDropResult {
  success: boolean;
  item: ItemEntity;
  entity: GameEntity;
  position: Position;
  message: string;
  reason?: string;
}

// Inventory management
export interface InventoryManager {
  addItem(entity: GameEntity, item: ItemEntity): boolean;
  removeItem(entity: GameEntity, itemId: string): ItemEntity | null;
  getItems(entity: GameEntity): ItemEntity[];
  hasItem(entity: GameEntity, itemId: string): boolean;
  getItemCount(entity: GameEntity): number;
  getMaxCapacity(entity: GameEntity): number;
  isFull(entity: GameEntity): boolean;
}

export class ItemSystem implements InventoryManager {
  private dungeonManager: DungeonManager;
  private itemTemplates: Map<string, ItemTemplate> = new Map();
  private messageSink?: (message: string) => void;

  constructor(dungeonManager: DungeonManager) {
    this.dungeonManager = dungeonManager;
    this.initializeDefaultItems();
  }

  /**
   * メッセージ出力先を設定（UI ログなど）
   */
  setMessageSink(sink: (message: string) => void): void {
    this.messageSink = sink;
  }

  /**
   * Use an item
   */
  useItem(user: GameEntity, item: ItemEntity, target?: GameEntity): ItemUsageResult {

    const actualTarget = target || user;
    const effects: ItemUsageEffect[] = [];
    let consumed = false;
    let success = false;
    const appliedEffects: string[] = [];

    // Check if item is consumable
    if (!item.isConsumable()) {
      return {
        success: false,
        item,
        user,
        effects: [],
        message: `${item.name} cannot be used`,
        consumed: false,
        appliedEffects: []
      };
    }

    // Process item effects
    for (const effect of item.effects) {
      const effectResult = this.processItemEffect(effect, actualTarget, user);
      effects.push(effectResult);
      
      if (effectResult.success) {
        success = true;
        // 特殊効果の場合は適用済みリストに追加
        if (['reveal-items', 'reveal-map', 'reveal-traps', 'reveal-monsters'].includes(effect.type)) {
          appliedEffects.push(effect.type);
        }
      }
    }

    // Identify item when used
    item.identify();

    // Consume item if it's consumable
    if (item.isConsumable() && success) {
      consumed = true;
      this.removeItem(user, item.id);
    }

    const message = this.generateUsageMessage(user, item, actualTarget, success);

    return {
      success,
      item,
      user,
      effects,
      message,
      consumed,
      appliedEffects
    };
  }

  /**
   * Process individual item effect
   */
  private processItemEffect(
    effect: any, 
    target: GameEntity, 
    user: GameEntity
  ): ItemUsageEffect {
    let success = false;
    let message = '';
    let value = effect.value || 0;

    switch (effect.type) {
      case 'heal':
        if ('stats' in target) {
          const stats = (target as any).stats;
          const actualHeal = Math.min(value, stats.maxHp - stats.hp);
          stats.hp = Math.min(stats.maxHp, stats.hp + value);
          success = actualHeal > 0;
          message = success ? 
            `${target.id} recovers ${actualHeal} HP` : 
            `${target.id} is already at full health`;
        }
        break;

      case 'restore-hunger':
        if ('hunger' in target) {
          const player = target as PlayerEntity;
          const oldHunger = player.hunger;
          player.hunger = Math.min(player.maxHunger, player.hunger + value);
          const actualRestore = player.hunger - oldHunger;
          success = actualRestore > 0;
          message = success ? 
            `${target.id} feels less hungry` : 
            `${target.id} is not hungry`;
        }
        break;

      case 'cure-status':
        if ('statusEffects' in target) {
          const statusEffects = (target as any).statusEffects;
          const beforeCount = statusEffects.length;
          
          if (effect.statusType) {
            // Cure specific status
            const index = statusEffects.findIndex((s: any) => s.type === effect.statusType);
            if (index !== -1) {
              statusEffects.splice(index, 1);
              success = true;
              message = `${target.id} is cured of ${effect.statusType}`;
            }
          } else {
            // Cure all status effects
            statusEffects.length = 0;
            success = beforeCount > 0;
            message = success ? 
              `${target.id} is cured of all status effects` : 
              `${target.id} has no status effects to cure`;
          }
        }
        break;

      case 'stat-boost':
        // Temporary stat boost (would need integration with status effect system)
        success = true;
        message = `${target.id} feels stronger`;
        break;

      case 'teleport':
        // Random teleportation
        if (this.dungeonManager.getCurrentDungeon()) {
          // Find random walkable position
          const dungeon = this.dungeonManager.getCurrentDungeon()!;
          let attempts = 0;
          let newPos: Position | null = null;
          
          while (attempts < 50 && !newPos) {
            const x = Math.floor(Math.random() * dungeon.width);
            const y = Math.floor(Math.random() * dungeon.height);
            const testPos = { x, y };
            
            if (this.dungeonManager.isWalkable(testPos)) {
              newPos = testPos;
            }
            attempts++;
          }
          
          if (newPos) {
            this.dungeonManager.moveEntity(target, newPos);
            success = true;
            message = `${target.id} is teleported`;
          } else {
            message = `Teleportation failed`;
          }
        }
        break;

      case 'identify':
        // Identify items in inventory
        if ('inventory' in target) {
          const inventory = (target as any).inventory as ItemEntity[];
          let identifiedCount = 0;
          
          for (const invItem of inventory) {
            if (!invItem.identified) {
              invItem.identify();
              identifiedCount++;
            }
          }
          
          success = identifiedCount > 0;
          message = success ? 
            `Identified ${identifiedCount} items` : 
            `All items are already identified`;
        }
        break;

      case 'reveal-items':
        // 千里眼効果：フロア全体のアイテム位置を表示
        success = true;
        message = `${target.id} can see all items on this floor`;
        // 注: 実際の効果はCanvasRendererで処理される
        break;

      case 'reveal-map':
        // レミーラ効果：フロア全体の地形を表示
        success = true;
        message = `${target.id} can see the entire floor layout`;
        // 注: 実際の効果はCanvasRendererで処理される
        break;

      case 'reveal-traps':
        // 罠探知効果：フロア全体の罠の位置を表示
        success = true;
        message = `${target.id} can see all traps on this floor`;
        // 注: 実際の効果はCanvasRendererで処理される
        break;

      case 'reveal-monsters':
        // 透視効果：フロア全体のモンスターの位置を表示
        success = true;
        message = `${target.id} can see all monsters on this floor`;
        // 注: 実際の効果はCanvasRendererで処理される
        break;

      case 'damage':
        if ('stats' in target) {
          const stats = (target as any).stats;
          const actualDamage = Math.min(value, stats.hp);
          stats.hp = Math.max(0, stats.hp - value);
          success = true;
          message = `${target.id} takes ${actualDamage} damage`;
        }
        break;

      default:
        message = `Unknown effect: ${effect.type}`;
    }

    return {
      type: effect.type,
      value,
      target,
      success,
      message
    };
  }

  /**
   * Generate usage message
   */
  private generateUsageMessage(
    user: GameEntity, 
    item: ItemEntity, 
    target: GameEntity, 
    success: boolean
  ): string {
    const userName = (user as any).name || user.id;
    const targetName = (target as any).name || target.id;
    
    if (success) {
      if (user === target) {
        return `${userName} uses ${item.name}`;
      } else {
        return `${userName} uses ${item.name} on ${targetName}`;
      }
    } else {
      return `${userName} tries to use ${item.name} but nothing happens`;
    }
  }

  /**
   * Pick up item from ground
   */
  pickupItem(entity: GameEntity, position: Position): ItemPickupResult {

    const entitiesAtPosition = this.dungeonManager.getEntitiesAt(position);
    const items = entitiesAtPosition.filter(e => e instanceof ItemEntity) as ItemEntity[];
    
    if (items.length === 0) {
      return {
        success: false,
        item: null as any,
        entity,
        message: 'No items to pick up',
        reason: 'no-items'
      };
    }

    // Pick up first item
    const item = items[0];
    
    // Check if entity can hold more items
    if (this.isFull(entity)) {
      return {
        success: false,
        item,
        entity,
        message: 'Inventory is full',
        reason: 'inventory-full'
      };
    }

    // Remove from ground and add to inventory
    this.dungeonManager.removeEntity(item);
    const added = this.addItem(entity, item);
    
    if (added) {
      const entityName = (entity as any).name || entity.id;
      // ピックアップメッセージ（ログ）
      const pickupMessage = `${item.getDisplayName()} を ひろった！`;
      if (this.messageSink) this.messageSink(pickupMessage);
      return {
        success: true,
        item,
        entity,
        message: `${entityName} picks up ${item.getDisplayName()}`
      };
    } else {
      // Put back on ground if couldn't add to inventory
      this.dungeonManager.addEntity(item, position);
      return {
        success: false,
        item,
        entity,
        message: 'Could not pick up item',
        reason: 'add-failed'
      };
    }
  }

  /**
   * 投擲: 所持アイテムをプレイヤーの向きに直線で最長10マス飛ばす。
   * 壁（非walkable）で手前に落下。敵（MonsterEntity）に当たったらそのマスに落下。
   * 何にも当たらなければ10マス先に着地。
   */
  throwItem(user: GameEntity, itemId: string, direction: 'north'|'south'|'east'|'west'|'northeast'|'southeast'|'southwest'|'northwest'): {
    success: boolean;
    message: string;
    landingPosition?: Position;
  } {

    // フォールバック: 旧実装（ECS未対応の特殊効果など）
    // インベントリから取り出し
    const item = this.removeItem(user, itemId);
    if (!item) {
      return { success: false, message: '投げるアイテムが見つかりません' };
    }

    const dirMap: Record<string, Position> = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      west: { x: -1, y: 0 },
      east: { x: 1, y: 0 },
      northeast: { x: 1, y: -1 },
      southeast: { x: 1, y: 1 },
      southwest: { x: -1, y: 1 },
      northwest: { x: -1, y: -1 }
    };

    const v = dirMap[direction] || { x: 0, y: 1 };
    const start = { ...user.position };
    let lastValid = { ...start };
    let landing: Position | null = null;

    for (let step = 1; step <= 10; step++) {
      const pos = { x: start.x + v.x * step, y: start.y + v.y * step };
      const cell = this.dungeonManager.getCellAt(pos);
      if (!cell) {
        // 範囲外 → 直前で落下
        landing = { ...lastValid };
        break;
      }
      // 壁
      if (!cell.walkable) {
        landing = { ...lastValid };
        break;
      }

      // キャラクター（敵・味方・自分を含む）に命中
      const hitEntity = cell.entities.find(e => !(e instanceof ItemEntity));
      if (hitEntity) {
        // 投擲挙動フラグに従って処理（全アイテムが保持）
        const behavior = item.itemFlags?.onThrow || ((item.effects && item.effects.length > 0) ? 'effect-then-disappear' : 'damage-then-disappear');
        if (behavior === 'effect-then-disappear') {
          // 効果あり: 使用時と同様の効果を発動し、原則として消滅（落下しない）
          const useResult = this.useItem(user, item, hitEntity);
          if (this.messageSink && useResult.message) this.messageSink(useResult.message);
          return { success: true, message: useResult.message || '投擲効果を適用', landingPosition: undefined };
        } else if (behavior === 'damage-then-disappear') {
          // 効果がないアイテムは適当なダメージを与えて消滅
          const defaultThrowDamage = 5;
          const targetStats = (hitEntity as any).stats;
          if (targetStats && typeof targetStats.hp === 'number') {
            const dealt = Math.min(defaultThrowDamage, targetStats.hp);
            targetStats.hp = Math.max(0, targetStats.hp - defaultThrowDamage);
            if (this.messageSink) {
              const targetName = (hitEntity as any).name || hitEntity.id;
              const msg = `${targetName} に ${dealt} ダメージ（投擲）` + (targetStats.hp <= 0 ? ' たおした！' : '');
              this.messageSink(msg);
            }
          }
          // 消滅（インベントリから取り出したまま地面には置かない）
          return { success: true, message: '投擲ダメージ適用（アイテム消滅）', landingPosition: undefined };
        } else {
          // special: 現状は空（将来拡張用）→ ひとまず消滅にしておく
          return { success: true, message: '特殊投擲（未実装）', landingPosition: undefined };
        }
      }

      // ここまで来れたら通過、最後に更新
      lastValid = { ...pos };
      if (step === 10) {
        landing = { ...pos };
        break;
      }
    }

    if (!landing) landing = { ...lastValid };

    const finalLanding = this.resolveItemLanding(landing);
    if (!finalLanding) {
      if (this.messageSink) {
        this.messageSink(`${item.getDisplayName()} は きえてしまった…`);
      }
      return { success: true, message: '着地点が混雑していたため消滅', landingPosition: undefined };
    }

    // 地面に配置（失敗したらインベントリに戻す）
    const placed = this.dungeonManager.addEntity(item, finalLanding);
    if (!placed) {
      this.addItem(user, item); // 戻す
      return { success: false, message: 'その方向には投げられない', landingPosition: undefined };
    }

    // メッセージ
    if (this.messageSink) {
      this.messageSink(`${item.getDisplayName()} を なげた！`);
    }

    return { success: true, message: '投擲完了', landingPosition: finalLanding };
  }

  /**
   * Drop item at position
   */
  dropItem(entity: GameEntity, itemId: string, position: Position): ItemDropResult {

    const item = this.removeItem(entity, itemId);
    
    if (!item) {
      return {
        success: false,
        item: null as any,
        entity,
        position,
        message: 'Item not found in inventory',
        reason: 'item-not-found'
      };
    }

    // ドロップ着地判定（投擲と同じルール）
    const finalLanding = this.resolveItemLanding(position);
    if (!finalLanding) {
      if (this.messageSink) {
        this.messageSink(`${item.getDisplayName()} は きえてしまった…`);
      }
      return {
        success: true,
        item,
        entity,
        position,
        message: '着地点が混雑していたため消滅'
      };
    }

    // 最終着地点に配置
    const placed = this.dungeonManager.addEntity(item, finalLanding);
    if (placed) {
      const entityName = (entity as any).name || entity.id;
      return {
        success: true,
        item,
        entity,
        position: finalLanding,
        message: `${entityName} drops ${item.getDisplayName()}`
      };
    } else {
      // 配置に失敗 → インベントリへ戻す
      this.addItem(entity, item);
      return {
        success: false,
        item,
        entity,
        position,
        message: 'Could not drop item',
        reason: 'place-failed'
      };
    }
  }

  /**
   * アイテム着地位置の解決: 指定位置が不可 or アイテム重なりなら周囲8マスをランダム探索し、
   * 'floor' | 'room' | 'corridor' かつアイテムがないマスへ。それも無ければ null。
   */
  private resolveItemLanding(desired: Position): Position | null {
    const isAllowedCell = (cell: any): boolean => {
      if (!cell) return false;
      return cell.type === 'floor' || cell.type === 'room' || cell.type === 'corridor';
    };
    const hasItem = (cell: any): boolean => !!cell?.entities.some((e: any) => e instanceof ItemEntity);

    const cell = this.dungeonManager.getCellAt(desired);
    if (cell && isAllowedCell(cell) && !hasItem(cell)) {
      return { ...desired };
    }

    const neighbors: Position[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        neighbors.push({ x: desired.x + dx, y: desired.y + dy });
      }
    }
    // シャッフル
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }

    for (const pos of neighbors) {
      const c = this.dungeonManager.getCellAt(pos);
      if (!c) continue;
      if (!isAllowedCell(c)) continue;
      if (hasItem(c)) continue;
      return pos;
    }
    return null;
  }

  /**
   * Add item to entity inventory
   */
  addItem(entity: GameEntity, item: ItemEntity): boolean {
    if (!this.hasInventorySupport(entity)) {
      return false;
    }

    if (this.isFull(entity)) {
      return false;
    }

    const inventory = this.getInventory(entity);
    inventory.push(item);
    return true;
  }

  /**
   * Remove item from entity inventory
   */
  removeItem(entity: GameEntity, itemId: string): ItemEntity | null {
    if (!this.hasInventorySupport(entity)) {
      return null;
    }

    const inventory = this.getInventory(entity);
    const index = inventory.findIndex(item => item.id === itemId);
    
    if (index !== -1) {
      return inventory.splice(index, 1)[0];
    }

    return null;
  }

  /**
   * Get all items in entity inventory
   */
  getItems(entity: GameEntity): ItemEntity[] {
    if (!this.hasInventorySupport(entity)) {
      return [];
    }

    return [...this.getInventory(entity)];
  }

  /**
   * Check if entity has specific item
   */
  hasItem(entity: GameEntity, itemId: string): boolean {
    const inventory = this.getInventory(entity);
    return inventory.some(item => item.id === itemId);
  }

  /**
   * Get item count in inventory
   */
  getItemCount(entity: GameEntity): number {
    return this.getInventory(entity).length;
  }

  /**
   * Get maximum inventory capacity
   */
  getMaxCapacity(entity: GameEntity): number {
    // Default capacity, could be modified by equipment/stats
    return 20;
  }

  /**
   * Check if inventory is full
   */
  isFull(entity: GameEntity): boolean {
    return this.getItemCount(entity) >= this.getMaxCapacity(entity);
  }

  /**
   * Check if entity has inventory support
   */
  private hasInventorySupport(entity: GameEntity): boolean {
    return 'inventory' in entity;
  }

  /**
   * Get entity inventory array
   */
  private getInventory(entity: GameEntity): ItemEntity[] {
    if (!this.hasInventorySupport(entity)) {
      return [];
    }
    
    return (entity as any).inventory as ItemEntity[];
  }

  /**
   * Create item from template
   */
  createItem(templateId: string, position: Position): ItemEntity | null {
    const template = this.itemTemplates.get(templateId);
    if (!template) {
      return null;
    }

    const item = new ItemEntity(
      `${templateId}-${Date.now()}`,
      template.name,
      template.itemType,
      position,
      template.identified,
      template.cursed,
      (template as any).spriteId
    );

    // Apply template properties
    if (template.effects) {
      for (const effect of template.effects) {
        item.addEffect(effect);
      }
    }

    if (template.equipmentStats) {
      item.setEquipmentStats(template.equipmentStats);
    }

    if (template.attributes) {
      item.setAttributes(template.attributes);
    }

    if (template.durability !== undefined) {
      item.setDurability(template.durability);
    }

    // アイテムフラグの初期化（テンプレ依存。指定がなければ効果有無でデフォルト）
    if ((template as any).throwBehavior) {
      const beh = (template as any).throwBehavior as 'effect-then-disappear' | 'damage-then-disappear' | 'special';
      item.itemFlags.onThrow = beh;
    } else {
      item.itemFlags.onThrow = (item.effects && item.effects.length > 0)
        ? 'effect-then-disappear'
        : 'damage-then-disappear';
    }

    return item;
  }

  /**
   * Register item template
   */
  registerItemTemplate(template: ItemTemplate): void {
    this.itemTemplates.set(template.id, template);
  }

  /**
   * Get item template
   */
  getItemTemplate(templateId: string): ItemTemplate | undefined {
    return this.itemTemplates.get(templateId);
  }

  /**
   * Get all item template IDs
   */
  getItemTemplateIds(): string[] {
    return Array.from(this.itemTemplates.keys());
  }

  /**
   * ItemRegistry が読み込まれていれば、そちらのテンプレートを優先して再ロードする
   */
  reloadTemplatesFromRegistry(): void {
    try {
      // 動的import（ブラウザ環境）
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      // @ts-ignore
      const mod = require('../core/ItemRegistry.js');
      const reg = mod?.ItemRegistry?.getInstance?.();
      if (!reg || !reg.hasTemplates()) return;
      this.itemTemplates.clear();
      for (const tpl of reg.getAll()) {
        this.registerItemTemplate(tpl);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Initialize default item templates
   */
  private initializeDefaultItems(): void {
    // Health Potion
    this.registerItemTemplate({
      id: 'health-potion',
      name: 'Health Potion',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      spriteId: 'consumable',
      effects: [
        {
          type: 'heal',
          value: 20,
          description: 'Restores 20 HP'
        }
      ]
    });

    // Bread
    this.registerItemTemplate({
      id: 'bread',
      name: 'Bread',
      itemType: 'consumable',
      identified: true,
      cursed: false,
      spriteId: 'consumable',
      effects: [
        {
          type: 'restore-hunger',
          value: 30,
          description: 'Restores 30 hunger'
        }
      ]
    });

    // Antidote
    this.registerItemTemplate({
      id: 'antidote',
      name: 'Antidote',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      spriteId: 'consumable',
      effects: [
        {
          type: 'cure-status',
          statusType: 'poison',
          description: 'Cures poison'
        }
      ]
    });

    // Scroll of Identify
    this.registerItemTemplate({
      id: 'scroll-identify',
      name: 'Scroll of Identify',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      spriteId: 'consumable',
      effects: [
        {
          type: 'identify',
          description: 'Identifies all items in inventory'
        }
      ]
    });

    // Teleport Scroll
    this.registerItemTemplate({
      id: 'scroll-teleport',
      name: 'Scroll of Teleport',
      itemType: 'consumable',
      identified: false,
      cursed: false,
      spriteId: 'consumable',
      effects: [
        {
          type: 'teleport',
          description: 'Teleports to random location'
        }
      ]
    });
  }
}

// Item template interface
export interface ItemTemplate {
  id: string;
  name: string;
  itemType: any;
  identified: boolean;
  cursed: boolean;
  spriteId?: string;
  effects?: any[];
  equipmentStats?: any;
  attributes?: any;
  durability?: number;
}
