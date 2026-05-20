import fs from 'fs/promises';
import path from 'path';
import { YAMLMap, Document } from 'yaml';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { DockerRepository } from '@core/repositories/DockerRepository.js';
import { SystemRepository } from '@core/repositories/SystemRepository.js';
import { MacOSConfig } from '@core/entities/MacOSConfig.js';

const execAsync = promisify(exec);

export class DockerComposeAdapter implements DockerRepository {
  constructor(private systemRepository?: SystemRepository) {}

  async generateComposeFile(config: MacOSConfig, outputPath: string): Promise<void> {
    const usbArgs = config.usbDevices
      .map(dev => `-device usb-host,vendorid=${dev.vendorId},productid=${dev.productId}`)
      .join(' ');

    const devices = ['/dev/bus/usb'];
    
    try {
      await fs.access('/dev/kvm');
      devices.push('/dev/kvm');
    } catch {}

    try {
      await fs.access('/dev/net/tun');
      devices.push('/dev/net/tun');
    } catch {}

    // Ensure storage directory exists
    const storagePath = path.join(path.dirname(outputPath), 'storage');
    try {
      await fs.mkdir(storagePath, { recursive: true });
    } catch (e) {
      console.error('Error creating storage directory:', e);
    }

    const compose: any = {
      services: {
        macos: {
          image: 'dockurr/macos',
          container_name: 'macos',
          privileged: true,
          environment: {
            VERSION: config.version,
            RAM_SIZE: config.ramSize,
            CPU_CORES: config.cpuCores.toString(),
            DISK_SIZE: config.diskSize,
            DISK_TYPE: 'blk',
            ALLOCATE: 'N',
            ARGUMENTS: usbArgs
          },
          devices: [...devices],
          cap_add: ['NET_ADMIN'],
          ports: [
            '8006:8006',
            '5900:5900/tcp',
            '5900:5900/udp'
          ],
          volumes: [
            './storage:/storage'
          ],
          restart: 'always',
          stop_grace_period: '2m'
        }
      }
    };

    if (config.installDisk) {
      // Si es un dispositivo físico
      if (config.installDisk.startsWith('/dev/')) {
        compose.services.macos.devices.push(`${config.installDisk}:/disk1`);
      } else {
        // Si es un archivo de imagen
        compose.services.macos.volumes.push(`${config.installDisk}:/disk1`);
      }
    }

    // Add shared folders
    config.sharedFolders.forEach((folder, index) => {
      compose.services.macos.volumes.push(`${folder.hostPath}:${folder.containerPath}`);
    });

    const doc = new Document(compose);
    await fs.writeFile(outputPath, doc.toString());
  }

  async start(composePath: string): Promise<void> {
    try {
      // Intentar matar procesos que ocupen los puertos configurados antes de arrancar
      if (this.systemRepository) {
        await this.systemRepository.killPortProcess(8006);
        await this.systemRepository.killPortProcess(5900);
      }
      
      // Intentar detener cualquier instancia previa que pueda estar bloqueando puertos
      await execAsync(`docker compose -f ${composePath} down --remove-orphans`);
    } catch (e) {
      console.log('DockerComposeAdapter: No se pudo bajar el contenedor previo o matar proceso:', e);
    }
    await execAsync(`docker compose -f ${composePath} up -d`);
  }

  async stop(composePath: string): Promise<void> {
    await execAsync(`docker compose -f ${composePath} stop`);
  }

  getLogs(composePath: string, callback: (log: string) => void): void {
    const child = spawn('docker', ['compose', '-f', composePath, 'logs', '-f']);
    child.stdout.on('data', (data) => callback(data.toString()));
    child.stderr.on('data', (data) => callback(data.toString()));
  }
}
