import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { DisplayMode } from './SpeedFormatter.js';

export interface Config {
  mode: DisplayMode;
  fontMode: number;
  refreshInterval: number;
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  private static readonly DEFAULT_CONFIG: Config = {
    mode: DisplayMode.TOTAL_BPS,
    fontMode: 0,
    refreshInterval: 3
  };

  constructor(configPath?: string) {
    this.configPath = configPath || join(homedir(), '.config', 'os-util', 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or create default if not exists
   */
  private loadConfig(): Config {
    try {
      if (existsSync(this.configPath)) {
        const configData = readFileSync(this.configPath, 'utf8');
        const parsedConfig = JSON.parse(configData);

        // Validate and merge with defaults
        return {
          mode: this.validateMode(parsedConfig.mode) ? parsedConfig.mode : ConfigManager.DEFAULT_CONFIG.mode,
          fontMode: this.validateFontMode(parsedConfig.fontMode) ? parsedConfig.fontMode : ConfigManager.DEFAULT_CONFIG.fontMode,
          refreshInterval: this.validateRefreshInterval(parsedConfig.refreshInterval) ? parsedConfig.refreshInterval : ConfigManager.DEFAULT_CONFIG.refreshInterval
        };
      }
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Return default config and save it
    const defaultConfig = { ...ConfigManager.DEFAULT_CONFIG };
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: Config): void {
    try {
      // Ensure config directory exists
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate display mode
   */
  private validateMode(mode: unknown): mode is DisplayMode {
    return typeof mode === 'number' && mode >= 0 && mode <= 4;
  }

  /**
   * Validate font mode
   */
  private validateFontMode(fontMode: unknown): fontMode is number {
    return typeof fontMode === 'number' && fontMode >= 0 && fontMode <= 4;
  }

  /**
   * Validate refresh interval
   */
  private validateRefreshInterval(interval: unknown): interval is number {
    return typeof interval === 'number' && interval > 0 && interval <= 60;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Get display mode
   */
  public getMode(): DisplayMode {
    return this.config.mode;
  }

  /**
   * Set display mode
   */
  public setMode(mode: DisplayMode): void {
    if (this.validateMode(mode)) {
      this.config.mode = mode;
      this.saveConfig(this.config);
    }
  }

  /**
   * Get font mode
   */
  public getFontMode(): number {
    return this.config.fontMode;
  }

  /**
   * Set font mode
   */
  public setFontMode(fontMode: number): void {
    if (this.validateFontMode(fontMode)) {
      this.config.fontMode = fontMode;
      this.saveConfig(this.config);
    }
  }

  /**
   * Get refresh interval
   */
  public getRefreshInterval(): number {
    return this.config.refreshInterval;
  }

  /**
   * Set refresh interval
   */
  public setRefreshInterval(interval: number): void {
    if (this.validateRefreshInterval(interval)) {
      this.config.refreshInterval = interval;
      this.saveConfig(this.config);
    }
  }

  /**
   * Cycle to next display mode
   */
  public cycleMode(): DisplayMode {
    const nextMode = (this.config.mode + 1) % 5 as DisplayMode;
    this.setMode(nextMode);
    return nextMode;
  }

  /**
   * Cycle to next font mode
   */
  public cycleFontMode(): number {
    const nextFontMode = (this.config.fontMode + 1) % 5;
    this.setFontMode(nextFontMode);
    return nextFontMode;
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    this.config = { ...ConfigManager.DEFAULT_CONFIG };
    this.saveConfig(this.config);
  }

  /**
   * Get configuration file path
   */
  public getConfigPath(): string {
    return this.configPath;
  }
}