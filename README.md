# ☕ Mac Remote Controller & Anti-Sleep

Una aplicación web móvil ultraligera y moderna para **controlar tu Mac remotamente desde el navegador de tu celular** y **evitar que se apague o entre en modo de suspensión** mientras realizas tareas largas (descargas, renders, backups, compilaciones o streaming).

---

## 🌟 Características Principales

### 1. ⚡ Anti-Suspensión / Modo Insomnio (`caffeinate`)
- **Evita el modo reposo**: Tu Mac nunca se apagará ni suspenderá mientras esté activo.
- **Temporizadores configurables**:
  - Infinito (hasta que tú decidas apagarlo).
  - 15 min, 30 min, 1 hora, 2 horas, 4 horas o minutos personalizados.
- **Cuenta regresiva en vivo**: Observa en la pantalla de tu móvil el tiempo exacto restante en formato `HH:MM:SS`.
- **Modos de Pantalla Inteligentes**:
  - *Pantalla Encendida*: Mantiene el monitor activo y brillante.
  - *Solo Procesador (Ahorro)*: Permite que la pantalla del Mac se apague para ahorrar energía o no iluminar la habitación de noche, mientras el procesador, las descargas y tareas siguen activas al 100%.

### 2. 📱 Control Remoto Total desde el Celular
- **Audio y Volumen**:
  - Control deslizante táctil (0% - 100%) con respuesta en tiempo real.
  - Botones de paso rápido (+10%, -10%, 30%, 60%, 100%).
  - Silenciar / Desmutear con un toque.
  - Controles multimedia (Anterior, Play/Pausa, Siguiente).
- **Pantalla y Energía**:
  - 🔒 **Bloquear Pantalla**: Bloquea el Mac inmediatamente.
  - 🖥️ **Apagar Pantalla**: Apaga la pantalla sin suspender los procesos.
  - 🖱️ **Despertar (Jiggle)**: Simula actividad de usuario para reanimar pantallas.
  - 💤 **Suspender Mac**: Pone el Mac en reposo con modal de confirmación.
  - 🔄 **Reiniciar** y 🛑 **Apagar**: Con confirmaciones de seguridad para evitar toques accidentales.
- **📸 Vista Remota de Pantalla (Screenshot)**:
  - Mira una captura instantánea optimizada de lo que se ve en la pantalla de tu Mac para comprobar si terminó una descarga o render sin levantarte de la cama o el sillón.
- **🚀 Herramientas Rápidas**:
  - 📋 **Portapapeles**: Escribe en tu móvil y cópialo directamente al portapapeles de la Mac (`pbcopy`).
  - 🌐 **Abrir Enlaces**: Pega cualquier enlace en el celular y se abrirá en el navegador de tu Mac (`open`).
  - 🔔 **Enviar Notificaciones**: Envía avisos sonoros a la pantalla del Mac.
- **📊 Monitor de Salud del Mac**:
  - Nivel de batería y si está conectado al cargador.
  - Uso de CPU (%) y Memoria RAM usada / total en GB.
  - Uptime (tiempo que lleva encendido el equipo).

---

## 🚀 Cómo Iniciar el Servidor

Abre tu terminal y ejecuta:

```bash
cd /Users/alejandro/Documents/controlpc
./start.sh
```

*(O también puedes usar `npm start`)*

### 📲 ¿Cómo Conectarte desde tu Celular?
1. Asegúrate de que tu celular esté conectado a la **misma red Wi-Fi** que tu Mac.
2. Al ejecutar `./start.sh`, verás un **código QR en la terminal**.
3. **Escanea el código QR con la cámara de tu celular** (iPhone o Android) y pulsa en el enlace.
4. También puedes abrir Safari / Chrome en tu móvil y escribir la dirección IP mostrada (ejemplo: `http://192.168.10.20:4567`).

---

## 📲 Instalar como App en tu Celular (PWA)

Puedes usarla en pantalla completa sin barras de navegador como si fuera una aplicación nativa:

- **En iPhone (Safari)**:
  1. Abre la página en Safari.
  2. Pulsa el botón **Compartir** (el cuadro con una flecha hacia arriba en la parte inferior).
  3. Selecciona **"Añadir a pantalla de inicio"** (Add to Home Screen).
  4. Pulsa **Añadir**. ¡Listo! Tendrás el icono de la taza de café en tu pantalla de inicio.

- **En Android (Chrome)**:
  1. Abre la página en Chrome.
  2. Pulsa los tres puntos del menú superior.
  3. Selecciona **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**.

---

## 🛑 Cómo Detener el Servidor

En la terminal donde corre el servidor presiona `Ctrl + C`, o ejecuta en cualquier otra terminal:

```bash
cd /Users/alejandro/Documents/controlpc
./stop.sh
```

---

## 🛡️ Seguridad y Permisos
- El servidor solo escucha en tu red local WiFi privada.
- Utiliza la herramienta oficial y nativa de macOS `/usr/bin/caffeinate`, sin requerir permisos de `sudo` ni alterar configuraciones permanentes del sistema.
- Las acciones de Apagar, Reiniciar y Suspender cuentan con diálogo de doble confirmación para prevenir toques accidentales.
