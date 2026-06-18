#!/usr/bin/env bash

# Script temporal para probar la aplicación en desarrollo.
# Temporary script to test the application in development.

export PYTHONPATH="$(pwd)/src:$PYTHONPATH"

# Verificar dependencias básicas de sistema para correr el script
if ! command -v python3 &> /dev/null; then
    echo "Python 3 no está instalado. / Python 3 is not installed."
    exit 1
fi

echo "Iniciando Macboat (Modo Desarrollo)... / Starting Macboat (Dev Mode)..."
python3 src/macboat/main.py
