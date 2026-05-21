#!/usr/bin/env bash

# MacBoat VM Import Script
# Este script mueve tu VM desde la carpeta del repo a la ubicación de la app instalada.

REPO_STORAGE="./storage"
DEFAULT_TARGET="$HOME/storage"

echo "🚢 MacBoat - Importador de Máquinas Virtuales"
echo "--------------------------------------------"

if [ ! -d "$REPO_STORAGE" ]; then
    echo "❌ Error: No se encontró la carpeta 'storage' en este directorio."
    exit 1
fi

echo "Se han detectado las siguientes VMs en este repositorio:"
ls -1 "$REPO_STORAGE"

echo ""
echo "Recuerda: Si usas la app instalada desde el menú de aplicaciones,"
echo "la carpeta de destino suele ser: $DEFAULT_TARGET"
echo ""
read -p "Introduce la ruta de destino (pulsa Enter para usar $DEFAULT_TARGET): " TARGET_PATH
TARGET_PATH=${TARGET_PATH:-$DEFAULT_TARGET}

# Crear la carpeta de destino si no existe
mkdir -p "$TARGET_PATH"

echo "🚀 Iniciando copia de seguridad y migración..."
echo "Esto puede tardar varios minutos (tu VM ocupa unos 18GB)..."

# Usamos rsync para ver el progreso y permitir reanudar si falla
rsync -avh --progress "$REPO_STORAGE/" "$TARGET_PATH/"

echo ""
echo "✅ ¡Migración completada!"
echo "Ahora, al abrir tu app MacBoat instalada, debería aparecer tu macOS en la lista."
echo "--------------------------------------------"
