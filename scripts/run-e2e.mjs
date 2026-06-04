import { spawn } from 'node:child_process';

const port = process.env.E2E_PORT || '5173';
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', port], {
  cwd: process.cwd(),
  env: { ...process.env, NO_HTTPS: '1', BASE_PATH: '/' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

function stopServer() {
  if (!server.killed) server.kill('SIGTERM');
}

process.on('exit', stopServer);
process.on('SIGINT', () => { stopServer(); process.exit(130); });
process.on('SIGTERM', () => { stopServer(); process.exit(143); });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseURL, { method: 'HEAD' });
      if (res.ok || res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite dev server did not start at ${baseURL}\n${serverOutput}`);
}

try {
  await waitForServer();
  const test = spawn('npx', ['playwright', 'test'], {
    cwd: process.cwd(),
    env: { ...process.env, E2E_BASE_URL: baseURL },
    stdio: 'inherit',
  });
  test.on('exit', (code, signal) => {
    stopServer();
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
} catch (err) {
  console.error(err);
  stopServer();
  process.exit(1);
}
