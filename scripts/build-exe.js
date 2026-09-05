import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

console.log('🦀 [1/2] Building standalone executable with embedded frontend...');
const runnerPath = path.resolve('scripts', 'tauri-runner.js');
const buildTauri = spawnSync(process.execPath, [runnerPath, 'build', '--no-bundle'], { stdio: 'inherit' });
if (buildTauri.status !== 0) {
  console.error('❌ Tauri build failed.');
  process.exit(buildTauri.status ?? 1);
}

console.log('\n📦 [2/2] Deploying standalone life-inbox.exe to project root...');
const srcExe = path.resolve('src-tauri', 'target', 'release', 'life-inbox.exe');
const destExe = path.resolve('life-inbox.exe');

if (fs.existsSync(srcExe)) {
  fs.copyFileSync(srcExe, destExe);
  console.log(`✅ Success! Standalone executable is ready at:\n   👉 ${destExe}`);
} else {
  console.error('❌ Could not find output binary at:', srcExe);
  process.exit(1);
}
