import * as http from 'http';
import * as net from 'net';

interface ServiceStatus {
  name: string;
  ok: boolean;
  message: string;
}

function checkPort(host: string, port: number, timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => { socket.destroy(); resolve(false); };
    socket.setTimeout(timeout);
    socket.on('error', onError);
    socket.on('timeout', onError);
    socket.connect(port, host, () => { socket.destroy(); resolve(true); });
  });
}

function checkHttp(url: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      resolve(res.statusCode! < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

export async function runHealthCheck(): Promise<boolean> {
  console.log('\n🔍 Vérification des services...\n');

  const checks: ServiceStatus[] = [];

  // IntraClaw API
  const apiOk = await checkHttp('http://localhost:3000/health');
  checks.push({ name: 'IntraClaw API', ok: apiOk, message: apiOk ? 'http://localhost:3000' : 'Non disponible' });

  // PostgreSQL
  const dbOk = await checkPort('localhost', 5432);
  checks.push({ name: 'PostgreSQL', ok: dbOk, message: dbOk ? 'Port 5432 ouvert' : 'Non disponible' });

  // Redis
  const redisOk = await checkPort('localhost', 6379);
  checks.push({ name: 'Redis', ok: redisOk, message: redisOk ? 'Port 6379 ouvert' : 'Non disponible' });

  // ChromaDB
  const chromaOk = await checkHttp('http://localhost:8000/api/v1/heartbeat');
  checks.push({ name: 'ChromaDB', ok: chromaOk, message: chromaOk ? 'http://localhost:8000' : 'Non disponible' });

  // Affichage
  for (const check of checks) {
    const icon = check.ok ? '✅' : '⚠️ ';
    console.log(`  ${icon} ${check.name.padEnd(20)} ${check.message}`);
  }

  const allOk = checks.every(c => c.ok);

  if (!allOk) {
    const failed = checks.filter(c => !c.ok).map(c => c.name);
    console.log(`\n⚠️  Services non disponibles : ${failed.join(', ')}`);
    console.log('   Essaie : docker compose up -d\n');
  }

  return allOk;
}

export async function waitForService(
  url: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const ok = await checkHttp(url);
    if (ok) return true;
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}
