import { execFileSync } from 'child_process';
import { NetworkStats } from '../NetworkMonitor.js';
import { NetworkStatsProvider } from './NetworkStatsProvider.js';

/**
 * Reads cumulative network byte counters on Windows via PowerShell's
 * `Get-NetAdapterStatistics`.
 *
 * Windows exposes no `/proc/net/dev` equivalent, so we query the networking
 * cmdlets and sum `ReceivedBytes`/`SentBytes` across physical adapters that are
 * currently `Up`. Restricting to `-Physical` + `Up` naturally excludes
 * loopback, disconnected, and virtual adapters (VPN/Hyper-V/WSL/bridges) — the
 * Windows analogue of the interface filtering the Linux provider performs.
 *
 * References:
 *  - Get-NetAdapterStatistics:
 *    https://learn.microsoft.com/powershell/module/netadapter/get-netadapterstatistics
 *  - Get-NetAdapter -Physical:
 *    https://learn.microsoft.com/powershell/module/netadapter/get-netadapter
 */
export class WindowsNetworkStatsProvider implements NetworkStatsProvider {
  public readonly platform = 'win32';

  /**
   * Emits one `name|receivedBytes|sentBytes` line per active physical adapter.
   * `-ErrorAction SilentlyContinue` keeps a missing adapter from aborting the
   * whole query.
   */
  private static readonly SCRIPT = [
    "Get-NetAdapter -Physical -ErrorAction SilentlyContinue |",
    "  Where-Object { $_.Status -eq 'Up' } |",
    "  Get-NetAdapterStatistics -ErrorAction SilentlyContinue |",
    "  ForEach-Object { '{0}|{1}|{2}' -f $_.Name, $_.ReceivedBytes, $_.SentBytes }"
  ].join(' ');

  private runScript(): string {
    try {
      return execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          WindowsNetworkStatsProvider.SCRIPT
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 10000 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to query network adapter statistics via PowerShell: ${message}`);
    }
  }

  public read(): NetworkStats {
    const output = this.runScript();

    let totalBytes = 0;
    let totalUploadBytes = 0;

    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parts = trimmed.split('|');
      if (parts.length < 3) continue;

      const rxBytes = parseInt(parts[1], 10);
      const txBytes = parseInt(parts[2], 10);

      if (!isNaN(rxBytes) && !isNaN(txBytes)) {
        totalBytes += rxBytes + txBytes;
        totalUploadBytes += txBytes;
      }
    }

    return {
      totalBytes,
      totalUploadBytes,
      totalDownloadBytes: totalBytes - totalUploadBytes
    };
  }
}
