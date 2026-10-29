const express = require('express');
const { spawn, exec, execSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 4567;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ==========================================
// ESTADO GLOBAL DE CAFFEINATE (ANTI-SLEEP)
// ==========================================
let caffeinateState = {
  active: false,
  keepDisplay: true,
  mode: 'infinite', // 'infinite' | 'timed'
  durationSeconds: null,
  startedAt: null,
  endsAt: null,
  process: null,
  timerHandle: null
};

// ==========================================
// SSE (SERVER-SENT EVENTS) PARA CLIENTES
// ==========================================
const sseClients = new Set();

function broadcastState() {
  const state = getFullStatus();
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ==========================================
// UTILIDADES DEL SISTEMA OPERATIVO
// ==========================================

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  // Priorizar en0 (WiFi / Ethernet principal en macOS)
  if (interfaces.en0) {
    for (const iface of interfaces.en0) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  // Fallback: cualquier interfaz no interna
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function getBatteryInfo() {
  try {
    const raw = execSync('pmset -g batt', { timeout: 1500 }).toString();
    const isAC = raw.includes('AC Power');
    const percentMatch = raw.match(/(\d+)%/);
    const chargingMatch = raw.match(/;\s*(charging|finishing charge|charged|discharging)/i);
    const remainingMatch = raw.match(/;\s*(\d+:\d+)\s*remaining/);

    return {
      available: !!percentMatch,
      percentage: percentMatch ? parseInt(percentMatch[1], 10) : null,
      isAC,
      status: chargingMatch ? chargingMatch[1] : (isAC ? 'Enchufado' : 'Batería'),
      remaining: remainingMatch ? remainingMatch[1] : null
    };
  } catch (err) {
    return {
      available: false,
      percentage: null,
      isAC: true,
      status: 'No disponible',
      remaining: null
    };
  }
}

function getVolumeInfo() {
  try {
    const raw = execSync("osascript -e 'get volume settings'", { timeout: 1500 }).toString();
    const volMatch = raw.match(/output volume:(\d+)/);
    const mutedMatch = raw.match(/output muted:(true|false)/);
    return {
      volume: volMatch ? parseInt(volMatch[1], 10) : 50,
      muted: mutedMatch ? mutedMatch[1] === 'true' : false
    };
  } catch (err) {
    return { volume: 50, muted: false };
  }
}

let lastCpuUsage = 0;
function measureCpu() {
  const cpus = os.cpus();
  let totalUser = 0;
  let totalSys = 0;
  let totalIdle = 0;
  for (const cpu of cpus) {
    totalUser += cpu.times.user;
    totalSys += cpu.times.sys;
    totalIdle += cpu.times.idle;
  }
  const total = totalUser + totalSys + totalIdle;
  const active = totalUser + totalSys;
  if (total > 0) {
    lastCpuUsage = Math.round((active / total) * 100);
  }
  return lastCpuUsage;
}

function getFullStatus() {
  const now = Date.now();
  let remainingSeconds = null;
  if (caffeinateState.active && caffeinateState.endsAt) {
    remainingSeconds = Math.max(0, Math.round((caffeinateState.endsAt - now) / 1000));
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    timestamp: now,
    hostname: os.hostname(),
    localIp: getLocalIp(),
    port: PORT,
    uptimeSeconds: Math.round(os.uptime()),
    battery: getBatteryInfo(),
    volume: getVolumeInfo(),
    system: {
      cpuUsagePercent: measureCpu(),
      loadAvg: os.loadavg()[0].toFixed(2),
      memory: {
        totalGB: (totalMem / 1073741824).toFixed(1),
        usedGB: (usedMem / 1073741824).toFixed(1),
        freeGB: (freeMem / 1073741824).toFixed(1),
        percent: Math.round((usedMem / totalMem) * 100)
      }
    },
    caffeinate: {
      active: caffeinateState.active,
      keepDisplay: caffeinateState.keepDisplay,
      mode: caffeinateState.mode,
      durationSeconds: caffeinateState.durationSeconds,
      remainingSeconds,
      startedAt: caffeinateState.startedAt,
      endsAt: caffeinateState.endsAt
    }
  };
}

// ==========================================
// CONTROL DE CAFFEINATE (ANTI-SLEEP)
// ==========================================

function stopCaffeinate() {
  if (caffeinateState.timerHandle) {
    clearTimeout(caffeinateState.timerHandle);
    caffeinateState.timerHandle = null;
  }

  if (caffeinateState.process) {
    try {
      caffeinateState.process.kill('SIGTERM');
    } catch (e) {
      // Ignorar error si ya terminó
    }
    caffeinateState.process = null;
  }

  caffeinateState.active = false;
  caffeinateState.durationSeconds = null;
  caffeinateState.startedAt = null;
  caffeinateState.endsAt = null;
  caffeinateState.mode = 'infinite';

  broadcastState();
}

function startCaffeinate({ durationSeconds = null, keepDisplay = true }) {
  // Detener previo si existe
  stopCaffeinate();

  const args = [];
  if (keepDisplay) {
    // -d: pantalla activa, -i: idle sleep off, -m: disk sleep off, -u: user active
    args.push('-d', '-i', '-m', '-u');
  } else {
    // solo mantener procesador y sistema despiertos, permitiendo apagar pantalla
    args.push('-i', '-m', '-u');
  }

  const isTimed = typeof durationSeconds === 'number' && durationSeconds > 0;
  if (isTimed) {
    args.push('-t', String(durationSeconds));
  }

  const proc = spawn('caffeinate', args);
  caffeinateState.process = proc;
  caffeinateState.active = true;
  caffeinateState.keepDisplay = keepDisplay;
  caffeinateState.mode = isTimed ? 'timed' : 'infinite';
  caffeinateState.durationSeconds = isTimed ? durationSeconds : null;
  caffeinateState.startedAt = Date.now();
  caffeinateState.endsAt = isTimed ? Date.now() + (durationSeconds * 1000) : null;

  proc.on('exit', () => {
    // Si terminó el proceso naturalmente
    if (caffeinateState.process === proc) {
      caffeinateState.active = false;
      caffeinateState.process = null;
      caffeinateState.durationSeconds = null;
      caffeinateState.startedAt = null;
      caffeinateState.endsAt = null;
      broadcastState();
    }
  });

  proc.on('error', (err) => {
    console.error('Error al iniciar caffeinate:', err);
    stopCaffeinate();
  });

  if (isTimed) {
    caffeinateState.timerHandle = setTimeout(() => {
      stopCaffeinate();
    }, durationSeconds * 1000);
  }

  broadcastState();
}

// ==========================================
// RUTAS DE LA API
// ==========================================

// SSE Stream para actualización automática
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Enviar estado inicial
  res.write(`data: ${JSON.stringify(getFullStatus())}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Estado general
app.get('/api/status', (req, res) => {
  res.json(getFullStatus());
});

// Activar Anti-Sleep
app.post('/api/caffeinate/start', (req, res) => {
  const { durationSeconds, keepDisplay = true } = req.body;
  startCaffeinate({
    durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : null,
    keepDisplay: !!keepDisplay
  });
  res.json({ success: true, status: getFullStatus().caffeinate });
});

// Desactivar Anti-Sleep
app.post('/api/caffeinate/stop', (req, res) => {
  stopCaffeinate();
  res.json({ success: true, status: getFullStatus().caffeinate });
});

// Control de Volumen
app.post('/api/volume', (req, res) => {
  const { volume, muted } = req.body;
  try {
    if (typeof volume === 'number') {
      const safeVol = Math.max(0, Math.min(100, Math.round(volume)));
      execSync(`osascript -e "set volume output volume ${safeVol}"`);
    }
    if (typeof muted === 'boolean') {
      execSync(`osascript -e "set volume output muted ${muted ? 'true' : 'false'}"`);
    }
    const current = getVolumeInfo();
    broadcastState();
    res.json({ success: true, volume: current });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Control Multimedia
app.post('/api/media', (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'playpause') {
      execSync(`osascript -e '
        try
          tell application "Music" to playpause
        on error
          try
            tell application "Spotify" to playpause
          on error
            tell application "System Events" to key code 49
          end try
        end try
      '`);
    } else if (action === 'next') {
      execSync(`osascript -e '
        try
          tell application "Music" to next track
        on error
          try
            tell application "Spotify" to next track
          end try
        end try
      '`);
    } else if (action === 'prev') {
      execSync(`osascript -e '
        try
          tell application "Music" to previous track
        on error
          try
            tell application "Spotify" to previous track
          end try
        end try
      '`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Control de Energía y Pantalla
app.post('/api/power', (req, res) => {
  const { action } = req.body;
  try {
    switch (action) {
      case 'lock':
        // Bloquear pantalla
        execSync('pmset displaysleepnow');
        break;
      case 'displaysleep':
        // Apagar solo pantallas
        execSync('pmset displaysleepnow');
        break;
      case 'sleep':
        // Poner Mac en reposo
        exec("osascript -e 'tell application \"System Events\" to sleep'");
        break;
      case 'restart':
        // Reiniciar Mac
        exec("osascript -e 'tell application \"System Events\" to restart'");
        break;
      case 'shutdown':
        // Apagar Mac
        exec("osascript -e 'tell application \"System Events\" to shut down'");
        break;
      default:
        return res.status(400).json({ success: false, error: 'Acción no válida' });
    }
    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Portapapeles (Enviar texto al Mac)
app.post('/api/clipboard', (req, res) => {
  const { text } = req.body;
  if (typeof text !== 'string') {
    return res.status(400).json({ success: false, error: 'Texto requerido' });
  }
  try {
    const pbcopy = spawn('pbcopy');
    pbcopy.stdin.write(text);
    pbcopy.stdin.end();
    pbcopy.on('close', () => {
      res.json({ success: true, characters: text.length });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Abrir enlace web en el navegador del Mac
app.post('/api/open-url', (req, res) => {
  let { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL requerida' });
  }
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  try {
    execFileOpen(url);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function execFileOpen(targetUrl) {
  const openProc = spawn('open', [targetUrl]);
  openProc.unref();
}

// Enviar notificación a la pantalla del Mac
app.post('/api/notify', (req, res) => {
  const { title = 'Control Remoto', message = 'Aviso desde tu móvil' } = req.body;
  try {
    const cleanTitle = title.replace(/["'\\]/g, '');
    const cleanMsg = message.replace(/["'\\]/g, '');
    exec(`osascript -e 'display notification "${cleanMsg}" with title "${cleanTitle}" sound name "Glass"'`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Captura de pantalla para vista remota
app.get('/api/screenshot', (req, res) => {
  const tmpPath = path.join('/tmp', `controlpc_shot_${Date.now()}.jpg`);
  exec(`screencapture -x -t jpg -T 0 "${tmpPath}" && sips -Z 800 "${tmpPath}" > /dev/null 2>&1`, (err) => {
    if (err || !fs.existsSync(tmpPath)) {
      return res.status(500).send('Error al capturar pantalla');
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const readStream = fs.createReadStream(tmpPath);
    readStream.pipe(res);
    readStream.on('close', () => {
      try {
        fs.unlinkSync(tmpPath);
      } catch (e) {}
    });
  });
});

// Generar QR en base64 para mostrar en la interfaz web
app.get('/api/qr', async (req, res) => {
  const localIp = getLocalIp();
  const url = `http://${localIp}:${PORT}`;
  try {
    const dataUrl = await qrcode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: {
        dark: '#00f2fe',
        light: '#0a0f1d'
      }
    });
    res.json({ success: true, url, dataUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulación de actividad (Jiggle)
app.post('/api/jiggle', (req, res) => {
  try {
    // caffeinate -u declara actividad de usuario durante 1 segundo
    exec('caffeinate -u -t 1');
    res.json({ success: true, message: 'Actividad de usuario simulada' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Intervalo de broadcast para actualizar clientes periódicamente
setInterval(() => {
  if (sseClients.size > 0) {
    broadcastState();
  }
}, 3000);

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
app.listen(PORT, '0.0.0.0', async () => {
  const localIp = getLocalIp();
  const webUrl = `http://${localIp}:${PORT}`;
  const localUrl = `http://localhost:${PORT}`;

  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               ☕ MAC CONTROL PC & ANTI-SLEEP               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 Acceso desde este Mac:    ${localUrl}`);
  console.log(`  📱 Acceso desde tu Celular:  \x1b[32m\x1b[1m${webUrl}\x1b[0m`);
  console.log('');
  console.log('  Escanea este código QR con la cámara de tu celular:');
  console.log('');

  try {
    const qrTerminal = await qrcode.toString(webUrl, { type: 'terminal', small: true });
    console.log(qrTerminal);
  } catch (e) {
    console.log('  (Abre en tu navegador móvil:', webUrl, ')');
  }

  console.log('------------------------------------------------------------');
  console.log('  Consejo: Asegúrate de que el celular esté en la misma WiFi.');
  console.log('  Presiona Ctrl + C para detener el servidor.');
  console.log('════════════════════════════════════════════════════════════');
});

// Limpieza al cerrar proceso
process.on('SIGINT', () => {
  stopCaffeinate();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopCaffeinate();
  process.exit(0);
});
