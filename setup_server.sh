#!/bin/bash
# Script de preparación del VPS en Ubuntu/Debian para bot de Trading

echo "================================================="
echo "⚙️  Iniciando configuración de Servidor VPS Google Cloud"
echo "================================================="

# 1. Actualizar el sistema y librerías base
echo "[1/4] Actualizando repositorios y el sistema base..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar pip, entorno virtual y herramientas necesarias
echo "[2/4] Instalando Python 3, pip y herramientas de red..."
sudo apt install -y python3 python3-pip python3-venv git curl

# 3. Crear directorio para el bot y asignar permisos
echo "[3/4] Preparando entorno para maikBotTrade..."
mkdir -p ~/maikBotTrade
cd ~/maikBotTrade

# 4. Crear un Entorno Virtual de Python y activarlo
if [ ! -d "venv" ]; then
    echo "[4/4] Creando Virtual Environment (venv)..."
    python3 -m venv venv
fi

echo "================================================="
echo "✅ Servidor preparado exitosamente."
echo "Próximo paso: Sube tus archivos aquí (~/maikBotTrade/)"
echo "Luego ejecuta: source venv/bin/activate && pip install -r requirements.txt"
echo "================================================="
