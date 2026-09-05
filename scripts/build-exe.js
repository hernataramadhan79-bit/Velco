import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

console.log('🦀 [1/2] Building standalone executable with embedded frontend...');
const runnerPath = path.resolve('scripts', 'tauri-runner.js');
const buildTauri = spawnSync(process.execPath, [runnerPath, 'build', '--no-bundle'], { stdio: 'inherit' });
if (buildTauri.status !== 0) {
  console.error('❌ Tauri build failed.');
  process.exit(buildTauri.status ?? 1);
}

console.log('\n📦 [2/2] Deploying standalone velco.exe to project root...');
const srcExe = path.resolve('src-tauri', 'target', 'release', 'velco.exe');
const destExe = path.resolve('velco.exe');

if (fs.existsSync(srcExe)) {
  fs.copyFileSync(srcExe, destExe);
  console.log(`✅ Success! Standalone executable is ready at:\n   👉 ${destExe}`);
} else {
  console.error('❌ Could not find output binary at:', srcExe);
  process.exit(1);
}
