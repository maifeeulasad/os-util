#!/usr/bin/env node
import { TrayApp } from './TrayApp.js';

const app = new TrayApp();
app.start().catch((error) => {
  console.error('Failed to start OS Util tray:', error instanceof Error ? error.message : error);
  process.exit(1);
});
