#!/usr/bin/env bash

# Obtener ruta absoluta del script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependencias necesarias..."
  npm install --silent
fi

echo "🚀 Iniciando Mac Remote & Anti-Sleep en el puerto 4567..."
node server.js
