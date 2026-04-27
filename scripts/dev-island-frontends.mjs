import { spawn } from 'node:child_process';

const children = [];

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options
  });

  children.push(child);

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });

  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

startProcess('npm', ['--prefix', 'web', 'run', 'dev']);
startProcess('npx', ['vite', '--host', '127.0.0.1', '--port', '5174', '--strictPort']);

setInterval(() => {}, 1 << 30);
