#!/usr/bin/env bash

echo "🛑 Deteniendo Mac Remote Server y liberando procesos..."

# Buscar y matar procesos de node server.js en el puerto 4567
PID=$(lsof -ti :4567 2>/dev/null)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null
  echo "✔ Servidor web detenido (PID: $PID)"
else
  echo "ℹ El servidor no estaba en ejecución en el puerto 4567."
fi

# Detener cualquier proceso caffeinate huérfano si existiese
pkill -f "caffeinate -d -i -m -u" 2>/dev/null
pkill -f "caffeinate -i -m -u" 2>/dev/null

echo "✔ Procesos anti-suspensión verificados y restablecidos."
echo "🎉 Listo."
