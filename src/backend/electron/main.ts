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

// Fix PATH for packaged apps on Linux/macOS
if (app.isPackaged && process.platform !== 'win32') {
  const commonPaths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  const currentPath = process.env.PATH || '';
  const missingPaths = commonPaths.filter(p => !currentPath.includes(p));
  if (missingPaths.length > 0) {
    process.env.PATH = [...missingPaths, ...currentPath.split(':')].join(':');
    console.log('Main: PATH updated with:', missingPaths);
  }
}

let mainWindow: BrowserWindow | null = null;
let helpWindow: BrowserWindow | null = null;
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
    icon: path.join(app.getAppPath(), 'dist/frontend/macboat.png'),
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(app.getAppPath(), 'dist/backend/electron/preload.cjs'),
    },
    backgroundColor: '#ffffff',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist/frontend/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function createHelpWindow(lang: 'es' | 'en' = 'es') {
  if (helpWindow) {
    helpWindow.focus();
    return;
  }

  helpWindow = new BrowserWindow({
    width: 600,
    height: 750,
    title: lang === 'es' ? 'Instrucciones de Instalación' : 'Installation Instructions',
    parent: mainWindow || undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#f5f5f7',
  });

  const content = {
    es: {
      title: '¿Cómo instalar macOS?',
      intro: 'Sigue estos pasos para completar la instalación:',
      integrity: '<strong>Nota técnica:</strong> Realizamos este proceso de forma manual para garantizar la <strong>integridad total de la imagen original</strong> de macOS. Al no automatizar el formateo, evitamos modificar la estructura de datos que Apple espera encontrar, asegurando un sistema más estable y fiel al hardware real.',
      step1: 'Elige <strong>Utilidad de Discos</strong> (Disk Utility) y selecciona el disco <strong>Apple Inc. VirtIO Block Media</strong> más grande.',
      step2: 'Pulsa el botón <strong>Borrar</strong> (Erase) para formatear el disco como <strong>APFS</strong> y ponle el nombre que quieras.',
      step3: 'Cierra la ventana actual y procede con la instalación pulsando en <strong>Reinstalar macOS</strong>.',
      step4: 'Cuando te pregunte dónde instalarlo, selecciona el disco que acabas de crear.',
      step5: 'Tras copiar los archivos, selecciona tu región, idioma y configuración de teclado.',
      step6: 'Cuando el <strong>Asistente de Migración</strong> quiera transferir datos, selecciona <strong>Ahora no</strong> (abajo a la izquierda).',
      step7: 'En la pantalla de <strong>Apple ID</strong>, elige <strong>Configurar más tarde</strong> (abajo a la izquierda) y pulsa en <strong>Omitir</strong>.',
      step8: 'En la pantalla de <strong>Crear cuenta</strong>, rellena tu usuario y contraseña y pulsa en Continuar.',
      footer: 'Disfruta de tu nueva máquina virtual. ¡No olvides darle una estrella al repositorio!'
    },
    en: {
      title: 'How to install macOS?',
      intro: 'Follow these steps to complete the installation:',
      integrity: '<strong>Technical note:</strong> We perform this process manually to guarantee the <strong>total integrity of the original macOS image</strong>. By not automating the formatting, we avoid modifying the data structure that Apple expects to find, ensuring a more stable system that is faithful to real hardware.',
      step1: 'Choose <strong>Disk Utility</strong> and then select the largest <strong>Apple Inc. VirtIO Block Media</strong> disk.',
      step2: 'Click the <strong>Erase</strong> button to format the disk to APFS, and give it any name you like.',
      step3: 'Close the current window and proceed the installation by clicking <strong>Reinstall macOS</strong>.',
      step4: 'When prompted where you want to install it, select the disk you created previously.',
      step5: 'After all files are copied, select your region, language, and keyboard settings.',
      step6: 'When the <strong>Migration Assistant</strong> wants to transfer data, select <strong>Not now</strong> (bottom left).',
      step7: 'On the <strong>Apple ID</strong> screen, select <strong>Set Up Later</strong> (bottom left) and then proceed using <strong>Skip</strong>.',
      step8: 'On the <strong>Create a Computer Account</strong> screen, fill in a username and password and <strong>Continue</strong>.',
      footer: 'Enjoy your brand new machine, and don\'t forget to star this repo!'
    }
  };

  const t = content[lang];

  const html = `
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1d1d1f; background: #f5f5f7; }
          h1 { font-size: 24px; font-weight: 600; margin-bottom: 10px; }
          .integrity-box { background: #ffffff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          ol { padding-left: 20px; }
          li { margin-bottom: 15px; }
          strong { font-weight: 600; }
          .footer { margin-top: 40px; font-size: 14px; opacity: 0.7; border-top: 1px solid #d2d2d7; padding-top: 20px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>${t.title}</h1>
        <div class="integrity-box">${t.integrity}</div>
        <p>${t.intro}</p>
        <ol>
          <li>${t.step1}</li>
          <li>${t.step2}</li>
          <li>${t.step3}</li>
          <li>${t.step4}</li>
          <li>${t.step5}</li>
          <li>${t.step6}</li>
          <li>${t.step7}</li>
          <li>${t.step8}</li>
        </ol>
        <div class="footer">
          ${t.footer}
        </div>
      </body>
    </html>
  `;

  helpWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  helpWindow.on('closed', () => {
    helpWindow = null;
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

// Función para obtener la ruta base de datos (Home del usuario en prod, cwd en dev)
function getBasePath() {
  return app.isPackaged ? app.getPath('home') : process.cwd();
}

async function applyConfig() {
  try {
    const basePath = getBasePath();
    const composePath = await generateCompose.execute(currentConfig, basePath);
    await dockerAdapter.start(composePath);
    mainWindow?.webContents.send('status-update', { message: 'Configuración aplicada y contenedor reiniciado' });
  } catch (error: any) {
    console.error('Error applying config:', error);
    mainWindow?.webContents.send('status-update', { message: 'Error al aplicar configuración: ' + error.message });
  }
}

app.whenReady().then(async () => {
  createWindow();

  // Asegurar que los puertos necesarios están libres al arrancar la app (después de abrir ventana)
  try {
    systemAdapter.killPortProcess(8006).catch(e => console.error('Error kill 8006:', e));
    systemAdapter.killPortProcess(5900).catch(e => console.error('Error kill 5900:', e));
  } catch (e) {
    console.error('Error al intentar liberar los puertos al inicio:', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('set-docker-path', async (event, path: string) => {
  systemAdapter.setCustomDockerPath(path);
  return await checkSystem.execute();
});

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
    const basePath = getBasePath();
    const composePath = await generateCompose.execute(currentConfig, basePath);
    
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
    const basePath = getBasePath();
    const composePath = path.join(basePath, 'compose.yml');
    await dockerAdapter.stop(composePath);
    return { ok: true };
  } catch (error: any) {
    console.error('Error stopping macOS:', error);
    throw error;
  }
});

ipcMain.handle('check-existing-image', async () => {
  const basePath = getBasePath();
  return await checkExistingImage.execute(basePath);
});

ipcMain.handle('delete-vm', async (event, version: string) => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancelar', 'Eliminar permanentemente'],
    defaultId: 0,
    title: 'Confirmar eliminación',
    message: `¿Estás seguro de que quieres eliminar macOS ${version}?`,
    detail: 'Esta acción borrará todos los datos instalados y no se puede deshacer.',
    cancelId: 0
  });

  if (result.response === 1) {
    try {
      const basePath = getBasePath();
      const vmPath = path.join(basePath, 'storage', version);
      
      // Intentar detener el contenedor primero por si acaso
      const composePath = path.join(basePath, 'compose.yml');
      try {
        await dockerAdapter.stop(composePath);
      } catch {}

      await fs.rm(vmPath, { recursive: true, force: true });
      return { ok: true };
    } catch (error: any) {
      console.error('Error deleting VM:', error);
      throw error;
    }
  }
  return { ok: false };
});

ipcMain.handle('open-help', async (event, lang: 'es' | 'en') => {
  await createHelpWindow(lang);
});

ipcMain.handle('get-config', () => currentConfig);
