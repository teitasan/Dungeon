/**
 * キャラクターステータス計算ロジック
 */

import type { CharacterInfo, CharacterStats } from '../types/character-info.js';

export class CharacterCalculator {
  static maxHP(str: number, con: number, pow: number, hpBonus: number = 0): number {
    return Math.round((str * 3 + con * 6 + pow * 1) / 10) + hpBonus;
  }

  static hpRegen(str: number, con: number, maxHp: number): number {
    return Math.max(1, Math.min(
      Math.floor(maxHp * (0.08 * ((str + con) / ((str + con) + 400)))),
      Math.floor(maxHp * 0.10)
    ));
  }

  static maxMP(int: number, con: number, pow: number, mpBonus: number = 0): number {
    return Math.round((int * 6 + con * 1 + pow * 3) / 10) + mpBonus;
  }

  static mpRegen(int: number, pow: number, maxMp: number): number {
    return Math.max(1, Math.min(
      Math.floor(maxMp * (0.08 * ((int + pow) / ((int + pow) + 400)))),
      Math.floor(maxMp * 0.10)
    ));
  }

  static meleeHitRate(str: number, dex: number, luk: number): number {
    return (str * 6 + dex * 3 + luk * 1) / 10;
  }

  static rangeHitRate(str: number, dex: number, pow: number, luk: number): number {
    return (str * 1 + dex * 6 + pow * 2 + luk * 1) / 10;
  }

  static magicHitRate(int: number, pow: number, luk: number): number {
    return (int * 6 + pow * 3 + luk * 1) / 10;
  }

  static evasionRate(dex: number, int: number, luk: number): number {
    return (dex * 6 + int * 1 + luk * 3) / 10;
  }

  static physicalResistance(str: number, dex: number, con: number): number {
    return (str * 3 + dex * 2 + con * 5) / 10;
  }

  static magicResistance(int: number, con: number, pow: number): number {
    return (int * 2 + con * 1 + pow * 7) / 10;
  }

  static criticalRate(dex: number, int: number, luk: number): number {
    const weightedAverage = (dex * 1 + int * 1 + luk * 8) / 10;
    return (5 + (90 * weightedAverage) / (weightedAverage + 400)) / 100;
  }

  static unarmedAttackPower(str: number, dex: number): number {
    return (str * 7 + dex * 3) / 10;
  }

  static calculateAllStats(basicInfo: CharacterInfo, level: number): CharacterStats {
    const { stats } = basicInfo;
    
    const maxHp = this.maxHP(stats.STR, stats.CON, stats.POW);
    
    return {
      level,
      experience: {
        total: 0,
        required: level * 100,
        current: 0
      },
      hp: {
        current: maxHp,
        max: maxHp
      },
      mp: {
        current: this.maxMP(stats.INT, stats.CON, stats.POW),
        max: this.maxMP(stats.INT, stats.CON, stats.POW)
      },
      combat: {
        hitRate: {
          melee: this.meleeHitRate(stats.STR, stats.DEX, stats.LUK),
          range: this.rangeHitRate(stats.STR, stats.DEX, stats.POW, stats.LUK),
          magic: this.magicHitRate(stats.INT, stats.POW, stats.LUK)
        },
        damageBonus: {
          melee: 0, // ダメージ補正は装備で決定
          range: 0,
          magic: 0
        },
        resistance: {
          physical: this.physicalResistance(stats.STR, stats.DEX, stats.CON),
          magic: this.magicResistance(stats.INT, stats.CON, stats.POW)
        },
        evasionRate: this.evasionRate(stats.DEX, stats.INT, stats.LUK),
        criticalRate: this.criticalRate(stats.DEX, stats.INT, stats.LUK)
      }
    };
  }
}
