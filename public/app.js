// ==========================================
// CLIENTE JAVASCRIPT - MAC REMOTE CONTROL
// ==========================================

let currentStatus = null;
let selectedSeconds = 0; // 0 = infinito
let keepDisplay = true;
let countdownInterval = null;
let isConnected = false;
let confirmCallback = null;

// ELEMENTOS DOM
const antiSleepCard = document.getElementById('antiSleepCard');
const antiSleepStatusTag = document.getElementById('antiSleepStatusTag');
const btnToggleAntiSleep = document.getElementById('btnToggleAntiSleep');
const btnAntiSleepLabel = document.getElementById('btnAntiSleepLabel');
const countdownBox = document.getElementById('countdownBox');
const countdownDigits = document.getElementById('countdownDigits');
const countdownProgress = document.getElementById('countdownProgress');

const timerChips = document.getElementById('timerChips');
const optDisplayOn = document.getElementById('optDisplayOn');
const optDisplayOff = document.getElementById('optDisplayOff');
const displayModeHint = document.getElementById('displayModeHint');

const connectionBadge = document.getElementById('connectionBadge');
const connectionText = document.getElementById('connectionText');

const batteryPercent = document.getElementById('batteryPercent');
const batteryStatus = document.getElementById('batteryStatus');
const cpuPercent = document.getElementById('cpuPercent');
const ramPercent = document.getElementById('ramPercent');
const ramUsage = document.getElementById('ramUsage');
const metaHostname = document.getElementById('metaHostname');
const metaUptime = document.getElementById('metaUptime');
const ipFooter = document.getElementById('ipFooter');

const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const btnMuteToggle = document.getElementById('btnMuteToggle');
const iconVolumeHigh = document.getElementById('iconVolumeHigh');
const iconVolumeMuted = document.getElementById('iconVolumeMuted');

const btnVolDown = document.getElementById('btnVolDown');
const btnVol30 = document.getElementById('btnVol30');
const btnVol60 = document.getElementById('btnVol60');
const btnVol100 = document.getElementById('btnVol100');
const btnVolUp = document.getElementById('btnVolUp');

const btnMediaPrev = document.getElementById('btnMediaPrev');
const btnMediaPlayPause = document.getElementById('btnMediaPlayPause');
const btnMediaNext = document.getElementById('btnMediaNext');

const btnLockScreen = document.getElementById('btnLockScreen');
const btnSleepDisplay = document.getElementById('btnSleepDisplay');
const btnJiggle = document.getElementById('btnJiggle');
const btnSleepMac = document.getElementById('btnSleepMac');
const btnRestartMac = document.getElementById('btnRestartMac');
const btnShutdownMac = document.getElementById('btnShutdownMac');

const btnRefreshScreenshot = document.getElementById('btnRefreshScreenshot');
const screenshotBox = document.getElementById('screenshotBox');
const screenshotPlaceholder = document.getElementById('screenshotPlaceholder');
const screenshotImg = document.getElementById('screenshotImg');
const screenshotTime = document.getElementById('screenshotTime');

const clipboardInput = document.getElementById('clipboardInput');
const btnSendClipboard = document.getElementById('btnSendClipboard');
const urlInput = document.getElementById('urlInput');
const btnOpenUrl = document.getElementById('btnOpenUrl');
const notifyInput = document.getElementById('notifyInput');
const btnSendNotify = document.getElementById('btnSendNotify');

const btnShowQr = document.getElementById('btnShowQr');
const qrModal = document.getElementById('qrModal');
const btnCloseQr = document.getElementById('btnCloseQr');
const qrImage = document.getElementById('qrImage');
const qrUrlText = document.getElementById('qrUrlText');

const confirmModal = document.getElementById('confirmModal');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const btnCancelConfirm = document.getElementById('btnCancelConfirm');
const btnCancelModal = document.getElementById('btnCancelModal');
const btnExecuteModal = document.getElementById('btnExecuteModal');
const toast = document.getElementById('toast');

// VIBRACIÓN HÁPTICA
function vibrate(ms = 12) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

// TOAST FLOTANTE
let toastTimeout = null;
function showToast(message) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
}

// FORMATO DE TIEMPO HH:MM:SS
function formatTime(totalSeconds) {
  if (totalSeconds == null || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ACTUALIZACIÓN DE INTERFAZ
function renderStatus(data) {
  if (!data) return;
  currentStatus = data;

  // Header & Red
  setConnectionState(true);
  metaHostname.textContent = data.hostname || 'Mac';
  metaUptime.textContent = formatUptime(data.uptimeSeconds || 0);
  ipFooter.textContent = `http://${data.localIp}:${data.port}`;

  // Batería
  if (data.battery && data.battery.available) {
    batteryPercent.textContent = `${data.battery.percentage}%`;
    batteryStatus.textContent = data.battery.isAC ? '⚡ Enchufado' : '🔋 En batería';
  } else {
    batteryPercent.textContent = '100%';
    batteryStatus.textContent = '⚡ Corriente AC';
  }

  // CPU & RAM
  if (data.system) {
    cpuPercent.textContent = `${data.system.cpuUsagePercent}%`;
    if (data.system.memory) {
      ramPercent.textContent = `${data.system.memory.percent}%`;
      ramUsage.textContent = `${data.system.memory.usedGB} / ${data.system.memory.totalGB} GB`;
    }
  }

  // Volumen (no pisar mientras el usuario lo arrastra)
  if (!isDraggingVolume && data.volume) {
    volumeSlider.value = data.volume.volume;
    volumeValue.textContent = `${data.volume.volume}%`;
    updateMuteIcons(data.volume.muted);
  }

  // Anti-Sleep / Caffeinate
  const isCaffActive = data.caffeinate && data.caffeinate.active;
  if (isCaffActive) {
    antiSleepCard.classList.add('active');
    antiSleepStatusTag.textContent = 'Activo';
    btnAntiSleepLabel.textContent = 'DESACTIVAR';

    // Cuenta regresiva
    if (data.caffeinate.remainingSeconds != null && data.caffeinate.durationSeconds) {
      countdownBox.style.display = 'block';
      countdownDigits.textContent = formatTime(data.caffeinate.remainingSeconds);
      const ratio = Math.max(0, Math.min(100, (data.caffeinate.remainingSeconds / data.caffeinate.durationSeconds) * 100));
      countdownProgress.style.width = `${ratio}%`;
    } else {
      countdownBox.style.display = 'none';
    }
  } else {
    antiSleepCard.classList.remove('active');
    antiSleepStatusTag.textContent = 'Inactivo';
    btnAntiSleepLabel.textContent = 'ACTIVAR';
    countdownBox.style.display = 'none';
  }
}

function setConnectionState(connected) {
  isConnected = connected;
  if (connected) {
    connectionBadge.className = 'status-pill connected';
    connectionText.textContent = 'Conectado';
  } else {
    connectionBadge.className = 'status-pill disconnected';
    connectionText.textContent = 'Reconectando';
  }
}

function updateMuteIcons(muted) {
  if (muted) {
    iconVolumeHigh.classList.add('hidden');
    iconVolumeMuted.classList.remove('hidden');
  } else {
    iconVolumeHigh.classList.remove('hidden');
    iconVolumeMuted.classList.add('hidden');
  }
}

// COUNTDOWN TICKER LOCAL
setInterval(() => {
  if (currentStatus && currentStatus.caffeinate && currentStatus.caffeinate.active && currentStatus.caffeinate.endsAt) {
    const remaining = Math.max(0, Math.round((currentStatus.caffeinate.endsAt - Date.now()) / 1000));
    currentStatus.caffeinate.remainingSeconds = remaining;
    countdownDigits.textContent = formatTime(remaining);
    if (currentStatus.caffeinate.durationSeconds) {
      const ratio = Math.max(0, Math.min(100, (remaining / currentStatus.caffeinate.durationSeconds) * 100));
      countdownProgress.style.width = `${ratio}%`;
    }
    if (remaining === 0) {
      fetchStatus();
    }
  }
}, 1000);

// COMUNICACIÓN CON SERVIDOR (SSE + POLLING)
function initSSE() {
  const evtSource = new EventSource('/api/events');
  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      renderStatus(data);
    } catch (e) {
      console.error(e);
    }
  };
  evtSource.onerror = () => {
    setConnectionState(false);
  };
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      renderStatus(data);
    }
  } catch (e) {
    setConnectionState(false);
  }
}

// Polling de respaldo cada 3 segundos
setInterval(fetchStatus, 3000);

// ==========================================
// EVENT HANDLERS
// ==========================================

// Toggle Anti-Sleep
btnToggleAntiSleep.addEventListener('click', async () => {
  vibrate(20);
  const isActive = currentStatus && currentStatus.caffeinate && currentStatus.caffeinate.active;

  if (isActive) {
    // Desactivar
    showToast('Modo normal restaurado');
    await fetch('/api/caffeinate/stop', { method: 'POST' });
  } else {
    // Activar
    showToast(selectedSeconds > 0 ? `Anti-sleep activado por ${formatTime(selectedSeconds)}` : 'Anti-sleep activado sin límite');
    await fetch('/api/caffeinate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: selectedSeconds > 0 ? selectedSeconds : null,
        keepDisplay
      })
    });
  }
  fetchStatus();
});

// Selección de duración
timerChips.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  vibrate(10);

  if (btn.dataset.custom) {
    const minutes = prompt('Ingresa los minutos que deseas mantener despierto el equipo:', '45');
    if (minutes && !isNaN(minutes) && parseInt(minutes, 10) > 0) {
      selectedSeconds = parseInt(minutes, 10) * 60;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.textContent = `${minutes}m*`;
      btn.classList.add('active');
    }
    return;
  }

  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  selectedSeconds = parseInt(btn.dataset.seconds, 10);

  // Si ya estaba activo, reiniciar con el nuevo timer
  if (currentStatus && currentStatus.caffeinate && currentStatus.caffeinate.active) {
    btnToggleAntiSleep.click();
    setTimeout(() => btnToggleAntiSleep.click(), 250);
  }
});

// Modo de pantalla
optDisplayOn.addEventListener('click', () => {
  vibrate(10);
  keepDisplay = true;
  optDisplayOn.classList.add('active');
  optDisplayOff.classList.remove('active');
  displayModeHint.textContent = 'Mantiene la pantalla despierta sin apagarse.';
});

optDisplayOff.addEventListener('click', () => {
  vibrate(10);
  keepDisplay = false;
  optDisplayOff.classList.add('active');
  optDisplayOn.classList.remove('active');
  displayModeHint.textContent = 'Permite apagar la pantalla para ahorrar batería, pero el Mac sigue procesando.';
});

// Volumen Slider
let isDraggingVolume = false;
let volDebounce = null;

volumeSlider.addEventListener('input', (e) => {
  isDraggingVolume = true;
  const val = parseInt(e.target.value, 10);
  volumeValue.textContent = `${val}%`;

  if (volDebounce) clearTimeout(volDebounce);
  volDebounce = setTimeout(async () => {
    await fetch('/api/volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volume: val })
    });
    isDraggingVolume = false;
  }, 120);
});

volumeSlider.addEventListener('change', () => {
  isDraggingVolume = false;
});

// Botones rápidos de volumen
async function setVolumeDirect(val) {
  vibrate(10);
  volumeSlider.value = val;
  volumeValue.textContent = `${val}%`;
  await fetch('/api/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ volume: val })
  });
}

btnVolDown.addEventListener('click', () => {
  const current = currentStatus?.volume?.volume || 50;
  setVolumeDirect(Math.max(0, current - 10));
});
btnVolUp.addEventListener('click', () => {
  const current = currentStatus?.volume?.volume || 50;
  setVolumeDirect(Math.min(100, current + 10));
});
btnVol30.addEventListener('click', () => setVolumeDirect(30));
btnVol60.addEventListener('click', () => setVolumeDirect(60));
btnVol100.addEventListener('click', () => setVolumeDirect(100));

// Mute toggle
btnMuteToggle.addEventListener('click', async () => {
  vibrate(15);
  const isMuted = currentStatus?.volume?.muted || false;
  await fetch('/api/volume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ muted: !isMuted })
  });
  fetchStatus();
});

// Multimedia
async function sendMedia(action) {
  vibrate(12);
  await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
}

btnMediaPrev.addEventListener('click', () => sendMedia('prev'));
btnMediaPlayPause.addEventListener('click', () => sendMedia('playpause'));
btnMediaNext.addEventListener('click', () => sendMedia('next'));

// Acciones de Pantalla y Energía
btnLockScreen.addEventListener('click', async () => {
  vibrate(20);
  await fetch('/api/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'lock' })
  });
  showToast('Pantalla bloqueada');
});

btnSleepDisplay.addEventListener('click', async () => {
  vibrate(20);
  await fetch('/api/power', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'displaysleep' })
  });
  showToast('Pantalla apagada');
});

btnJiggle.addEventListener('click', async () => {
  vibrate(15);
  await fetch('/api/jiggle', { method: 'POST' });
  showToast('Simulada actividad de usuario');
});

// Acciones con confirmación
function openConfirm(title, message, callback) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = callback;
  confirmModal.classList.remove('hidden');
}

function closeConfirm() {
  confirmModal.classList.add('hidden');
  confirmCallback = null;
}

btnCancelConfirm.addEventListener('click', closeConfirm);
btnCancelModal.addEventListener('click', closeConfirm);
btnExecuteModal.addEventListener('click', () => {
  vibrate(30);
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

btnSleepMac.addEventListener('click', () => {
  openConfirm('Suspender Mac', '¿Deseas poner el equipo en reposo ahora?', async () => {
    await fetch('/api/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sleep' })
    });
    showToast('Poniendo en reposo...');
  });
});

btnRestartMac.addEventListener('click', () => {
  openConfirm('Reiniciar Mac', '¿Seguro que deseas reiniciar el equipo?', async () => {
    await fetch('/api/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restart' })
    });
    showToast('Reiniciando equipo...');
  });
});

btnShutdownMac.addEventListener('click', () => {
  openConfirm('Apagar Mac', '¿Seguro que deseas apagar completamente el equipo?', async () => {
    await fetch('/api/power', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'shutdown' })
    });
    showToast('Apagando equipo...');
  });
});

// Captura de Pantalla
async function loadScreenshot() {
  vibrate(10);
  btnRefreshScreenshot.textContent = 'Cargando...';
  const imgUrl = `/api/screenshot?t=${Date.now()}`;
  const img = new Image();
  img.onload = () => {
    screenshotImg.src = imgUrl;
    screenshotImg.classList.remove('hidden');
    screenshotPlaceholder.classList.add('hidden');
    screenshotTime.textContent = `Actualizado a las ${new Date().toLocaleTimeString()}`;
    btnRefreshScreenshot.textContent = 'Actualizar';
  };
  img.onerror = () => {
    showToast('No se pudo obtener la captura');
    btnRefreshScreenshot.textContent = 'Actualizar';
  };
  img.src = imgUrl;
}

btnRefreshScreenshot.addEventListener('click', loadScreenshot);

// Portapapeles
btnSendClipboard.addEventListener('click', async () => {
  const text = clipboardInput.value.trim();
  if (!text) return;
  vibrate(15);
  const res = await fetch('/api/clipboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (res.ok) {
    showToast('¡Texto copiado al portapapeles del Mac!');
    clipboardInput.value = '';
  }
});

// Abrir URL
btnOpenUrl.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  vibrate(15);
  const res = await fetch('/api/open-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (res.ok) {
    showToast('Enlace abierto en el Mac');
    urlInput.value = '';
  }
});

// Enviar Notificación
btnSendNotify.addEventListener('click', async () => {
  const message = notifyInput.value.trim();
  if (!message) return;
  vibrate(15);
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, title: 'Aviso desde Móvil' })
  });
  if (res.ok) {
    showToast('Notificación mostrada en pantalla');
    notifyInput.value = '';
  }
});

// Código QR Modal
btnShowQr.addEventListener('click', async () => {
  vibrate(10);
  try {
    const res = await fetch('/api/qr');
    const data = await res.json();
    if (data.success) {
      qrImage.src = data.dataUrl;
      qrUrlText.textContent = data.url;
      qrModal.classList.remove('hidden');
    }
  } catch (e) {
    showToast('Error al generar QR');
  }
});

btnCloseQr.addEventListener('click', () => {
  qrModal.classList.add('hidden');
});

// INICIAR
initSSE();
fetchStatus();
