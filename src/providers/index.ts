import { NetworkStatsProvider } from './NetworkStatsProvider.js';
import { LinuxNetworkStatsProvider } from './LinuxNetworkStatsProvider.js';

export { NetworkStatsProvider } from './NetworkStatsProvider.js';
export { LinuxNetworkStatsProvider } from './LinuxNetworkStatsProvider.js';

/**
 * Create the {@link NetworkStatsProvider} appropriate for the current operating
 * system.
 *
 * @param platform Override for the detected platform (defaults to
 *   `process.platform`). Primarily useful for testing.
 * @throws Error if the platform has no supported provider.
 */
export function createNetworkStatsProvider(
  platform: NodeJS.Platform = process.platform
): NetworkStatsProvider {
  switch (platform) {
    case 'linux':
      return new LinuxNetworkStatsProvider();
    default:
      throw new Error(
        `Unsupported platform "${platform}": no network stats provider is available.`
      );
  }
}
