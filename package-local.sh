#!/bin/bash

# Script para empaquetar MacBoat localmente
echo "🚀 Iniciando empaquetado de MacBoat..."

# Asegurar dependencias
npm install

# Construir frontend y backend
echo "🔨 Construyendo aplicación..."
npm run build:frontend

# Corregir rutas absolutas en el HTML para compatibilidad con Electron
echo "🛠️ Corrigiendo rutas en dist/frontend/index.html..."
sed -i 's/href=\"\//href=\"/g' dist/frontend/index.html
sed -i 's/src=\"\//src=\"/g' dist/frontend/index.html
sed -i 's/component-url=\"\//component-url=\"/g' dist/frontend/index.html
sed -i 's/renderer-url=\"\//renderer-url=\"/g' dist/frontend/index.html

npm run build:electron

# Empaquetar para Linux (AppImage, deb, rpm)
echo "📦 Generando paquetes (AppImage, DEB, RPM)..."
npx electron-builder --linux --x64 --arm64

echo "✅ Empaquetado finalizado. Los archivos están en la carpeta 'dist-package'."
