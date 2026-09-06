import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // fallback loop
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

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
  try {
    fs.copyFileSync(srcExe, destExe);
    console.log(`✅ Success! Standalone executable is ready at:\n   👉 ${destExe}`);
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn('⚠️  File velco.exe sedang berjalan/terkunci oleh Windows. Mencoba menutup proses yang sedang aktif...');
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/IM', 'velco.exe'], { stdio: 'ignore' });
      } else {
        spawnSync('pkill', ['-f', 'velco'], { stdio: 'ignore' });
      }

      // Retry up to 5 times with small delay to let Windows release file handle
      let copied = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        sleepSync(400);
        try {
          fs.copyFileSync(srcExe, destExe);
          copied = true;
          console.log(`✅ Success! Standalone executable is ready at:\n   👉 ${destExe}`);
          break;
        } catch {
          // continue retry
        }
      }

      if (!copied) {
        console.error('\n❌ Gagal menimpa velco.exe karena file masih dikunci oleh sistem.');
        console.error('👉 Silakan tutup aplikasi Velco terlebih dahulu, lalu jalankan kembali npm run build:exe.\n');
        process.exit(1);
      }
    } else {
      throw err;
    }
  }
} else {
  console.error('❌ Could not find output binary at:', srcExe);
  process.exit(1);
}
