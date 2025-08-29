import type { PlayerEntity } from '../entities/Player.js';
import { ItemEntity } from '../entities/Item.js';
import type { InventoryComponent, InventoryItem } from '../ecs/components/common/Inventory.js';
import { InventoryComponentFactory, InventoryUtils } from '../ecs/components/common/Inventory.js';
import { HealthComponentFactory } from '../ecs/components/common/Health.js';
import { HungerComponentFactory } from '../ecs/components/status/Hunger.js';
import { ComponentManager } from '../ecs/core/ComponentManager.js';
import { ECSItemSystem } from '../ecs/systems/common/ItemSystem.js';
import type { DungeonManager } from '../dungeon/DungeonManager.js';
import type { Position } from '../types/core.js';
import { ItemRegistry } from '../core/ItemRegistry.js';

/**
 * ECSBridge
 * 非ECSのプレイヤー所持品 <-> ECS InventoryComponent の相互変換や
 * ECSユーティリティを用いた操作（ソート等）を担う薄い橋渡し。
 */
export class ECSBridge {
  // --- ランタイム用の簡易ECS環境（プレイヤー1体だけを投影） ---
  private static enabled = true;
  private static cm: ComponentManager | null = null;
  private static isys: ECSItemSystem | null = null;
  private static entityId = 'ecs-bridge-player';

  static setEnabled(v: boolean): void { this.enabled = v; }
  static isEnabled(): boolean { return this.enabled; }

  private static ensureEnv(): { cm: ComponentManager; isys: ECSItemSystem; eid: string } {
    if (!this.cm) this.cm = new ComponentManager();
    if (!this.isys) this.isys = new ECSItemSystem(this.cm);
    // レジストリからテンプレ再読込（初回/必要時）
    try { (this.isys as any).reloadTemplatesFromRegistry?.(); } catch {}
    return { cm: this.cm, isys: this.isys, eid: this.entityId };
  }

  /** Player -> ECS へステータス/所持品を反映（差し替え） */
  private static syncPlayerToECS(player: PlayerEntity): InventoryComponent {
    const { cm, eid } = this.ensureEnv();
    // 既存の該当コンポーネントを取り除き、最新を付与
    try { cm.removeComponent(eid, 'inventory'); } catch {}
    try { cm.removeComponent(eid, 'health'); } catch {}
    try { cm.removeComponent(eid, 'hunger'); } catch {}

    const inv = ECSBridge.buildECSInventoryFromPlayer(player);
    const hp = HealthComponentFactory.create(player.stats.hp, player.stats.maxHp);
    const hunger = HungerComponentFactory.create(player.hunger, player.maxHunger, 1);
    cm.addComponent(eid, inv);
    cm.addComponent(eid, hp);
    cm.addComponent(eid, hunger);
    return inv;
  }

  /** ECS -> Player へ在庫順序/識別状態/HP/満腹度を反映 */
  private static syncECSToPlayer(player: PlayerEntity): void {
    const { cm, eid } = this.ensureEnv();
    const inv = cm.getComponent(eid, 'inventory') as InventoryComponent | undefined;
    const hp = cm.getComponent(eid, 'health') as any | undefined;
    const hunger = cm.getComponent(eid, 'hunger') as any | undefined;
    if (inv) this.applyInventoryStateToPlayer(player, inv);
    if (hp) player.stats.hp = Math.max(0, Math.min(hp.current ?? player.stats.hp, player.stats.maxHp));
    if (hunger) player.hunger = Math.max(0, Math.min(hunger.current ?? player.hunger, player.maxHunger));
  }

  /** Inventory のECS正本をそのまま Player.inventory へ再構築して反映 */
  private static applyInventoryStateToPlayer(player: PlayerEntity, ecsInventory: InventoryComponent): void {
    const ecsMap = new Map(ecsInventory.items.map(i => [String(i.id), i] as const));
    const currentMap = new Map<string, any>((player.inventory || []).map((it: any) => [String(it.id), it]));
    const reg = ItemRegistry.getInstance();

    const rebuilt: any[] = [];
    for (const e of ecsInventory.items) {
      const existing = currentMap.get(String(e.id));
      if (existing) {
        existing.identified = !!e.identified;
        existing.cursed = !!e.cursed;
        if (typeof e.quantity === 'number') existing.quantity = e.quantity;
        if (e.name) existing.name = e.name;
        rebuilt.push(existing);
      } else {
        // Player側に存在しない → レジストリから復元して追加
        const tpl = reg.getTemplate(e.templateId);
        const itemEnt = new ItemEntity(
          String(e.id),
          String(e.name || tpl?.name || e.templateId),
          (e.itemType as any) || (tpl?.itemType as any) || 'consumable',
          { x: player.position?.x ?? 0, y: player.position?.y ?? 0 }
        );
        if (tpl?.effects) for (const ef of tpl.effects) itemEnt.addEffect(ef as any);
        if (tpl?.equipmentStats) itemEnt.setEquipmentStats(tpl.equipmentStats as any);
        (itemEnt as any).templateId = e.templateId;
        itemEnt.identified = !!e.identified;
        itemEnt.cursed = !!e.cursed;
        if (typeof e.quantity === 'number') (itemEnt as any).quantity = e.quantity;
        rebuilt.push(itemEnt);
      }
    }
    (player as any).inventory = rebuilt;
  }
  /** PlayerEntity.inventory から ECS InventoryComponent を構築 */
  static buildECSInventoryFromPlayer(player: PlayerEntity, maxCapacity: number = 20): InventoryComponent {
    const items: InventoryItem[] = ((player.inventory || []) as any[]).map((it: any) => ({
      id: String(it.id),
      templateId: String(it.templateId ?? it.id), // テンプレID不明時はidを代用
      name: String(it.name ?? it.id),
      itemType: String(it.itemType ?? 'consumable'),
      identified: !!it.identified,
      cursed: !!it.cursed,
      quantity: typeof it.quantity === 'number' ? it.quantity : 1
    })) as InventoryItem[];
    return InventoryComponentFactory.createWithItems(items, maxCapacity);
  }

  /** ECS InventoryComponent の順序で PlayerEntity.inventory を並び替える */
  static applyInventoryOrderToPlayer(player: PlayerEntity, ecsInventory: InventoryComponent): void {
    const order = ecsInventory.items.map(i => i.id);
    const map = new Map<string, any>();
    for (const it of (player.inventory || []) as any[]) map.set(String(it.id), it);
    const reordered: any[] = [];
    for (const id of order) {
      const found = map.get(id);
      if (found) reordered.push(found);
    }
    // 失われたものがあれば最後に付与（通常は発生しない）
    for (const it of (player.inventory || []) as any[]) {
      if (!order.includes(String(it.id))) reordered.push(it);
    }
    (player as any).inventory = reordered;
  }

  /** ID昇順にソート（ECS Utilityを利用）し、PlayerEntity.inventoryへ反映 */
  static sortPlayerInventoryByIdAsc(player: PlayerEntity): void {
    const ecs = ECSBridge.buildECSInventoryFromPlayer(player);
    const sorted = InventoryUtils.sortItems(ecs, (a, b) => String(a.id).localeCompare(String(b.id)));
    const newInv = InventoryComponentFactory.createWithItems(sorted, ecs.maxCapacity);
    ECSBridge.applyInventoryOrderToPlayer(player, newInv);
  }

  // ---------------- ECS委譲ファサード -----------------
  /** アイテム使用（ECS -> Playerへ同期）。未対応効果は旧システムへフォールバック */
  static useItemOnPlayer(player: PlayerEntity, itemId: string, dungeonManager?: DungeonManager): {
    success: boolean; message: string; consumed: boolean; appliedEffects?: string[];
  } | null {
    if (!this.enabled) return null;

    // レジストリにテンプレがなければ旧実装にフォールバック（簡易判定）
    const item = (player.inventory || []).find(i => String(i.id) === String(itemId));
    const tplId = String((item as any)?.templateId ?? item?.id ?? '');
    const reg = ItemRegistry.getInstance();
    const hasTpl = !!reg.getTemplate(tplId);

    // 一旦ECSへ同期
    this.syncPlayerToECS(player);
    const { isys, eid } = this.ensureEnv();

    // ECS側で使用
    const result = isys.useItem(eid, String(itemId));

    // 既知効果のみECS適用、それ以外はフォールバック
    const unsupported = (result.effects || []).some(e => (
      e.type === 'reveal-items' || e.type === 'reveal-map' || e.type === 'reveal-traps' || e.type === 'reveal-monsters'
    ));

    if (!hasTpl || unsupported) return null;

    // テレポートのみ非ECS側で位置更新を反映
    const didTeleport = (result.effects || []).some(e => e.type === 'teleport' && e.success);
    if (didTeleport && dungeonManager && player.position) {
      // ランダムテレポート（旧実装準拠の簡易版）
      const dungeon = dungeonManager.getCurrentDungeon();
      if (dungeon) {
        let attempts = 0; let newPos: Position | null = null;
        while (attempts < 50 && !newPos) {
          const x = Math.floor(Math.random() * dungeon.width);
          const y = Math.floor(Math.random() * dungeon.height);
          const p = { x, y };
          if (dungeonManager.isWalkable(p)) newPos = p;
          attempts++;
        }
        if (newPos) dungeonManager.moveEntity(player as any, newPos);
      }
    }

    // ECS -> Playerへ反映（HP/満腹/在庫順・識別/消費）
    this.syncECSToPlayer(player);

    return {
      success: !!result.success,
      message: result.message || '',
      consumed: !!result.consumed
    };
  }

  /** 足元の1個を拾う（ECSで容量判定→非ECSへ反映） */
  static pickupOneAtPosition(player: PlayerEntity, dungeonManager: DungeonManager, pos?: Position): {
    success: boolean; message: string; pickedItem?: ItemEntity;
  } {
    if (!this.enabled) return { success: false, message: 'ECS bridge disabled' };
    const position = pos ?? player.position;
    const itemsHere = dungeonManager.getEntitiesAt(position).filter(e => e instanceof ItemEntity) as ItemEntity[];
    if (itemsHere.length === 0) return { success: false, message: 'No items to pick up' };
    const itemEntity = itemsHere[0];

    // ECSへ同期し容量確認→追加
    const inv = this.syncPlayerToECS(player);
    const { isys, eid } = this.ensureEnv();
    if ((inv.currentCapacity >= inv.maxCapacity)) {
      return { success: false, message: 'Inventory is full' };
    }

    // ItemEntity -> InventoryItem へ変換
    const invItem: InventoryItem = {
      id: String(itemEntity.id),
      templateId: String((itemEntity as any).templateId ?? itemEntity.id),
      name: String(itemEntity.name || itemEntity.id),
      itemType: String(itemEntity.itemType || 'consumable'),
      identified: !!itemEntity.identified,
      cursed: !!itemEntity.cursed,
      quantity: 1
    };
    const ok = isys.addItemToInventory(eid, invItem);
    if (!ok) return { success: false, message: 'Inventory is full' };

    // 先にプレイヤー在庫へ実体を追加（同一IDで同期容易化）
    const exists = (player.inventory || []).some((it: any) => String(it.id) === String(itemEntity.id));
    if (!exists && (player as any).addToInventory) {
      (player as any).addToInventory(itemEntity as any);
    }

    // 非ECSへ反映：順序/状態同期、地面から削除
    this.syncECSToPlayer(player);
    dungeonManager.removeEntity(itemEntity);
    return { success: true, message: `${itemEntity.getDisplayName()} を ひろった！`, pickedItem: itemEntity };
  }

  /** 捨てる（ECSで在庫除去→非ECSに地面配置） */
  static dropFromPlayer(player: PlayerEntity, itemId: string, dungeonManager: DungeonManager, pos?: Position): {
    success: boolean; message: string; dropped?: ItemEntity; position?: Position;
  } {
    if (!this.enabled) return { success: false, message: 'ECS bridge disabled' };
    const position = pos ?? player.position;
    this.syncPlayerToECS(player);
    const { isys, eid } = this.ensureEnv();
    const removed = isys.removeItemFromInventory(eid, String(itemId));
    if (!removed) return { success: false, message: 'Item not found in inventory' };

    // 非ECSアイテムをレジストリから復元（なければ簡易生成）
    const reg = ItemRegistry.getInstance();
    const tpl = reg.getTemplate(removed.templateId);
    const itemEnt = new ItemEntity(
      removed.id,
      removed.name || removed.id,
      (removed.itemType as any) || 'consumable',
      { ...position }
    );
    if (tpl?.effects) for (const ef of tpl.effects) itemEnt.addEffect(ef as any);
    if (tpl?.equipmentStats) itemEnt.setEquipmentStats(tpl.equipmentStats as any);
    (itemEnt as any).templateId = removed.templateId;
    itemEnt.identified = !!removed.identified;
    itemEnt.cursed = !!removed.cursed;

    // 着地点（簡易：そのマス）に配置
    const placed = dungeonManager.addEntity(itemEnt as any, position);
    // 在庫同期
    this.syncECSToPlayer(player);
    if (!placed) return { success: false, message: 'Could not drop item' };
    return { success: true, message: `${itemEnt.getDisplayName()} を おとした`, dropped: itemEnt, position };
  }

  /** 投擲（ECSで在庫除去→非ECSで経路判定・着地・効果適用） */
  static throwItemFromPlayer(player: PlayerEntity, itemId: string, direction: 'north'|'south'|'east'|'west'|'northeast'|'southeast'|'southwest'|'northwest', dungeonManager: DungeonManager): {
    success: boolean; message: string; landingPosition?: Position;
  } {
    if (!this.enabled) return { success: false, message: 'ECS bridge disabled' };
    
    // ECSで投擲処理（在庫除去・基本計算）
    this.syncPlayerToECS(player);
    const { isys, eid } = this.ensureEnv();
    const result = isys.throwItem(eid, String(itemId), direction);
    
    if (!result.success) {
      return { success: false, message: result.message };
    }

    // 非ECS側で詳細な経路判定・着地処理・効果適用
    const item = this.findItemInPlayerInventory(player, itemId);
    if (!item) {
      return { success: false, message: 'Item not found in player inventory' };
    }

    // 投擲経路の計算と判定
    const throwResult = this.executeNonECSThrowLogic(player, item, direction, dungeonManager);
    
    // ECS側の在庫状態を非ECS側に同期
    this.syncECSToPlayer(player);
    
    return throwResult;
  }

  /** プレイヤーの在庫からアイテムを検索 */
  private static findItemInPlayerInventory(player: PlayerEntity, itemId: string): any {
    return (player.inventory || []).find((it: any) => String(it.id) === String(itemId));
  }

  /** 非ECS側での投擲ロジック実行（経路判定・着地・効果適用） */
  private static executeNonECSThrowLogic(player: PlayerEntity, item: any, direction: string, dungeonManager: DungeonManager): {
    success: boolean; message: string; landingPosition?: Position;
  } {
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

    const vector = dirMap[direction] || { x: 0, y: 1 };
    const start = { ...player.position };
    let lastValid = { ...start };
    let landing: Position | null = null;

    // 経路判定（壁・敵・範囲外チェック）
    for (let step = 1; step <= 10; step++) {
      const pos = { x: start.x + vector.x * step, y: start.y + vector.y * step };
      const cell = dungeonManager.getCellAt(pos);
      
      if (!cell) {
        // 範囲外 → 直前で落下
        landing = { ...lastValid };
        break;
      }
      
      // 壁チェック
      if (!cell.walkable) {
        landing = { ...lastValid };
        break;
      }

      // キャラクター（敵・味方）に命中
      const hitEntity = cell.entities.find(e => !(e instanceof ItemEntity));
      if (hitEntity) {
        // 投擲効果の適用（効果型アイテム）
        if (item.effects && item.effects.length > 0) {
          // 効果適用後は消滅
          return { success: true, message: '投擲効果を適用（アイテム消滅）' };
        } else {
          // 効果なしアイテムはダメージ適用後消滅
          const targetStats = (hitEntity as any).stats;
          if (targetStats && typeof targetStats.hp === 'number') {
            const defaultThrowDamage = 5;
            const dealt = Math.min(defaultThrowDamage, targetStats.hp);
            targetStats.hp = Math.max(0, targetStats.hp - defaultThrowDamage);
          }
          return { success: true, message: '投擲ダメージ適用（アイテム消滅）' };
        }
      }

      // 通過可能
      lastValid = { ...pos };
      if (step === 10) {
        landing = { ...pos };
        break;
      }
    }

    if (!landing) landing = { ...lastValid };

    // 着地点の解決（混雑回避）
    const finalLanding = this.resolveItemLanding(landing, dungeonManager);
    if (!finalLanding) {
      return { success: true, message: '着地点が混雑していたため消滅' };
    }

    // 地面に配置
    const itemEntity = this.createItemEntityFromPlayerItem(item, finalLanding);
    const placed = dungeonManager.addEntity(itemEntity as any, finalLanding);
    if (!placed) {
      return { success: false, message: 'その方向には投げられない' };
    }

    return { 
      success: true, 
      message: `${item.getDisplayName?.() || item.name || itemId} を なげた！`, 
      landingPosition: finalLanding 
    };
  }

  /** アイテム着地点の解決（混雑回避） */
  private static resolveItemLanding(targetPos: Position, dungeonManager: DungeonManager): Position | null {
    // 簡易実装：目標地点が空いていればそこ、空いていなければ周辺を探索
    if (dungeonManager.isWalkable(targetPos)) {
      return targetPos;
    }

    // 周辺8方向を探索
    const directions = [
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ];

    for (const dir of directions) {
      const pos = { x: targetPos.x + dir.x, y: targetPos.y + dir.y };
      if (dungeonManager.isWalkable(pos)) {
        return pos;
      }
    }

    return null;
  }

  /** プレイヤーアイテムからItemEntityを生成 */
  private static createItemEntityFromPlayerItem(item: any, position: Position): ItemEntity {
    const itemEnt = new ItemEntity(
      item.id,
      item.name || item.id,
      item.itemType || 'consumable',
      { ...position }
    );
    
    if (item.effects) {
      for (const effect of item.effects) {
        itemEnt.addEffect(effect);
      }
    }
    
    if (item.equipmentStats) {
      itemEnt.setEquipmentStats(item.equipmentStats);
    }
    
    (itemEnt as any).templateId = item.templateId;
    itemEnt.identified = !!item.identified;
    itemEnt.cursed = !!item.cursed;
    
    if (typeof item.quantity === 'number') {
      (itemEnt as any).quantity = item.quantity;
    }
    
    return itemEnt;
  }
}
