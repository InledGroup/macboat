#!/bin/bash

# Script para empaquetar MacBoat localmente
echo "🚀 Iniciando empaquetado de MacBoat..."

# Asegurar dependencias
npm install

# Construir frontend y backend
echo "🔨 Construyendo aplicación..."
npm run build:frontend
npm run build:electron

# Empaquetar para Linux (AppImage, deb, rpm)
echo "📦 Generando paquetes (AppImage, DEB, RPM)..."
npx electron-builder --linux --x64 --arm64

echo "✅ Empaquetado finalizado. Los archivos están en la carpeta 'dist-package'."
