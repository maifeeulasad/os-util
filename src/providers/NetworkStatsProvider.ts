import { NetworkStats } from '../NetworkMonitor.js';

/**
 * Strategy interface for reading raw, cumulative network byte counters from the
 * host operating system.
 *
 * The rest of the application (speed calculation, formatting, configuration) is
 * platform-agnostic; only the acquisition of raw RX/TX byte totals differs
 * between operating systems. Concrete providers encapsulate that difference so
 * {@link NetworkMonitor} can depend on this abstraction rather than on any
 * particular OS facility (Dependency Inversion Principle).
 */
export interface NetworkStatsProvider {
  /** Human-readable platform identifier, e.g. `"linux"` or `"win32"`. */
  readonly platform: string;

  /**
   * Read the current cumulative byte counters, summed across all relevant
   * (non-virtual, non-loopback) network interfaces.
   *
   * @throws Error if the counters cannot be read on the current platform.
   */
  read(): NetworkStats;
}
