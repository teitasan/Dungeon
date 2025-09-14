/**
 * キャラクター基本情報定義
 */

export interface CharacterInfo {
  name: string;                    // キャラクター名
  epithet?: string;                // 異名
  gender: 'male' | 'female' | 'other';  // 性別（男性、女性、その他）
  age: number;                     // 年齢（歳）
  height: number;                  // 身長（cm）
  weight: number;                  // 体重（kg）
  race: 'human' | 'half-orc' | 'halfling' | 'elf';  // 種族
  class: 'unemployed' | string;    // 職業（無職 + その他）
  stats: {                         // 能力値
    STR: number;                   // 筋力
    DEX: number;                   // 器用
    INT: number;                   // 知力
    CON: number;                   // 耐久
    POW: number;                   // 精神
    APP: number;                   // 魅力
    LUK: number;                   // 幸運
  };
  features: string[];              // 特徴
}

/**
 * キャラクター動的ステータス定義
 */

export interface CharacterStats {
  level: number;                   // レベル
  experience: {                    // 経験値
    total: number;                 // 累計経験値
    required: number;              // 次のレベルアップに必要な経験値
    current: number;               // 現在のレベルで稼いだ経験値
  };
  hp: {                           // HP
    current: number;               // 現在HP
    max: number;                   // 最大HP
  };
  mp: {                           // MP
    current: number;               // 現在MP
    max: number;                   // 最大MP
  };
  combat: {                       // 戦闘ステータス
    hitRate: {                    // 命中率
      melee: number;              // 近接命中率
      range: number;             // 遠距離命中率
      magic: number;              // 魔法命中率
    };
    damageBonus: {                // ダメージ補正
      melee: number;              // 近接ダメージ補正
      range: number;             // 遠距離ダメージ補正
      magic: number;              // 魔法ダメージ補正
    };
    resistance: {                 // 耐性
      physical: number;           // 物理耐性
      magic: number;              // 魔法耐性
    };
    evasionRate: number;          // 回避率
    criticalRate: number;         // クリティカル率
  };
}
