/**
 * フォント管理システム
 * ゲーム全体で使用するフォントを一元管理
 */

export interface FontConfig {
  primary: string;
  secondary: string;
  fallback: string;
}

export interface FontSize {
  small: number;
  medium: number;
  large: number;
  xlarge: number;
}

export interface FontWeight {
  normal: string;
  bold: string;
}

/**
 * フォント定数
 */
export const FONTS = {
  // フォントファミリー
  FAMILIES: {
    PIXEL_MPLUS: 'PixelMplus',
    PIXEL_MPLUS_12: 'PixelMplus12',
    FALLBACK: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  },
  
  // フォントサイズ
  SIZES: {
    SMALL: 10,
    MEDIUM: 12,
    LARGE: 16,
    XLARGE: 20,
    XXLARGE: 24
  },
  
  // フォントウェイト
  WEIGHTS: {
    NORMAL: 'normal',
    BOLD: 'bold'
  }
} as const;

/**
 * フォント管理クラス
 */
export class FontManager {
  private static instance: FontManager;
  private config: FontConfig;

  private constructor(config: FontConfig) {
    this.config = config;
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(config?: FontConfig): FontManager {
    if (!FontManager.instance) {
      if (!config) {
        throw new Error('FontManager must be initialized with config');
      }
      FontManager.instance = new FontManager(config);
    }
    return FontManager.instance;
  }

  /**
   * 設定を更新
   */
  public updateConfig(config: FontConfig): void {
    this.config = config;
  }

  /**
   * プライマリフォントファミリーを取得
   */
  public getPrimaryFont(): string {
    return this.config.primary;
  }

  /**
   * セカンダリフォントファミリーを取得
   */
  public getSecondaryFont(): string {
    return this.config.secondary;
  }

  /**
   * フォールバックフォントファミリーを取得
   */
  public getFallbackFont(): string {
    return this.config.fallback;
  }

  /**
   * 完全なフォントスタックを取得
   */
  public getFontStack(primary: boolean = true): string {
    const mainFont = primary ? this.config.primary : this.config.secondary;
    return `'${mainFont}', ${this.config.fallback}`;
  }

  /**
   * CSS用のフォントファミリー文字列を生成
   */
  public getCSSFontFamily(primary: boolean = true): string {
    return this.getFontStack(primary);
  }

  /**
   * Canvas用のフォント文字列を生成
   */
  public getCanvasFont(size: number, weight: string = FONTS.WEIGHTS.NORMAL, primary: boolean = true): string {
    const fontFamily = this.getFontStack(primary);
    return `${weight} ${size}px ${fontFamily}`;
  }

  /**
   * 設定からFontManagerを作成
   */
  public static fromConfig(config: FontConfig): FontManager {
    return new FontManager(config);
  }

  /**
   * デフォルト設定でFontManagerを作成
   */
  public static createDefault(): FontManager {
    return new FontManager({
      primary: FONTS.FAMILIES.PIXEL_MPLUS_12,
      secondary: FONTS.FAMILIES.PIXEL_MPLUS_12,
      fallback: FONTS.FAMILIES.FALLBACK
    });
  }
}

/**
 * 便利な関数群
 */
export const FontUtils = {
  /**
   * フォントファミリー文字列を生成
   */
  createFontFamily: (primary: boolean = true, config?: FontConfig): string => {
    const manager = config ? FontManager.fromConfig(config) : FontManager.createDefault();
    return manager.getCSSFontFamily(primary);
  },

  /**
   * Canvas用フォント文字列を生成
   */
  createCanvasFont: (size: number, weight: string = FONTS.WEIGHTS.NORMAL, primary: boolean = true, config?: FontConfig): string => {
    const manager = config ? FontManager.fromConfig(config) : FontManager.createDefault();
    return manager.getCanvasFont(size, weight, primary);
  },

  /**
   * 設定からフォントスタックを生成
   */
  createFontStack: (config: FontConfig, primary: boolean = true): string => {
    const manager = FontManager.fromConfig(config);
    return manager.getFontStack(primary);
  }
};
