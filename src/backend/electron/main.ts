import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

// Hexagonal Architecture Imports
import { SystemAdapter } from '../infrastructure/system/SystemAdapter.js';
import { CheckSystemDependencies } from '../use-cases/CheckSystemDependencies.js';
import { DockerComposeAdapter } from '../infrastructure/docker/DockerComposeAdapter.js';
import { GenerateComposeFile } from '../use-cases/GenerateComposeFile.js';
import { USBAdapter } from '../infrastructure/usb/USBAdapter.js';
import { MonitorUSBDevices } from '../use-cases/MonitorUSBDevices.js';
import { MacOSConfig } from '../core/entities/MacOSConfig.js';
import { CheckExistingImage } from '../use-cases/CheckExistingImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let currentConfig: MacOSConfig = {
  version: '15',
  ramSize: '6G',
  cpuCores: 4,
  diskSize: '128G',
  sharedFolders: [],
  usbDevices: []
};

// Initialize Infrastructure
const systemAdapter = new SystemAdapter();
const dockerAdapter = new DockerComposeAdapter(systemAdapter);
const usbAdapter = new USBAdapter();

// Initialize Use Cases
const checkSystem = new CheckSystemDependencies(systemAdapter);
const generateCompose = new GenerateComposeFile(dockerAdapter);
const monitorUSB = new MonitorUSBDevices(usbAdapter);
const checkExistingImage = new CheckExistingImage();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MacBoat',
    icon: path.join(__dirname, '../../../assets/macboat.png'),
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#ffffff',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Setup USB Monitoring with Auto-Restart
monitorUSB.onDeviceChange(async (device, type) => {
  console.log(`USB Device ${type}:`, device);
  
  if (type === 'attached') {
    // Add to config if not present
    const exists = currentConfig.usbDevices.some(d => d.vendorId === device.vendorId && d.productId === device.productId);
    if (!exists) {
      currentConfig.usbDevices.push(device);
      await applyConfig();
    }
  } else {
    // Remove from config
    currentConfig.usbDevices = currentConfig.usbDevices.filter(d => d.vendorId !== device.vendorId || d.productId !== device.productId);
    await applyConfig();
  }
});

async function applyConfig() {
  try {
    const projectPath = process.cwd();
    const composePath = await generateCompose.execute(currentConfig, projectPath);
    await dockerAdapter.start(composePath);
    mainWindow?.webContents.send('status-update', { message: 'Configuración aplicada y contenedor reiniciado' });
  } catch (error: any) {
    console.error('Error applying config:', error);
    mainWindow?.webContents.send('status-update', { message: 'Error al aplicar configuración: ' + error.message });
  }
}

app.whenReady().then(async () => {
  // Asegurar que los puertos necesarios están libres al arrancar la app
  try {
    await systemAdapter.killPortProcess(8006);
    await systemAdapter.killPortProcess(5900);
  } catch (e) {
    console.error('Error al intentar liberar los puertos al inicio:', e);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('check-system', async () => {
  try {
    console.log('Backend: Ejecutando check-system...');
    const result = await checkSystem.execute();
    console.log('Backend: Resultado check-system:', result);
    return result;
  } catch (error) {
    console.error('Backend: Error en check-system:', error);
    throw error;
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Disk Images', extensions: ['dmg', 'img', 'iso', 'qcow2'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('start-macos', async (event, config: Partial<MacOSConfig>) => {
  try {
    currentConfig = { ...currentConfig, ...config };
    const projectPath = process.cwd();
    const composePath = await generateCompose.execute(currentConfig, projectPath);
    
    // Start container - not awaiting to avoid blocking the transition
    dockerAdapter.start(composePath).catch(err => {
      console.error('Error starting container in background:', err);
      mainWindow?.webContents.send('status-update', { message: 'Error al iniciar Docker: ' + err.message });
    });
    
    // Listen to logs
    dockerAdapter.getLogs(composePath, (log) => {
      mainWindow?.webContents.send('docker-logs', log);
    });

    return { ok: true };
  } catch (error: any) {
    console.error('Error starting macOS:', error);
    throw error;
  }
});

ipcMain.handle('stop-macos', async () => {
  try {
    const projectPath = process.cwd();
    const composePath = path.join(projectPath, 'compose.yml');
    await dockerAdapter.stop(composePath);
    return { ok: true };
  } catch (error: any) {
    console.error('Error stopping macOS:', error);
    throw error;
  }
});

ipcMain.handle('check-existing-image', async () => {
  const projectPath = process.cwd();
  return await checkExistingImage.execute(projectPath);
});

ipcMain.handle('get-config', () => currentConfig);
