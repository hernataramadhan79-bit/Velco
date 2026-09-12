import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
const env = { ...process.env };

const currentPath = env.PATH || env.Path || '';
if (!currentPath.includes(cargoBin) && !currentPath.includes('.cargo')) {
  env.PATH = `${cargoBin}${path.delimiter}${currentPath}`;
  if (isWin) {
    env.Path = env.PATH;
  }
}

const args = process.argv.slice(2);
const isWin = process.platform === 'win32';
const tauriBin = isWin
  ? path.resolve('node_modules', '.bin', 'tauri.cmd')
  : path.resolve('node_modules', '.bin', 'tauri');

const child = isWin
  ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${tauriBin}"`, ...args], {
      stdio: 'inherit',
      env,
      windowsVerbatimArguments: true,
    })
  : spawn(tauriBin, args, {
      stdio: 'inherit',
      env,
    });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
