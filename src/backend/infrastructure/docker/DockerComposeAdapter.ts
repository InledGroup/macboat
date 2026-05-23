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

  private async getDockerPath(): Promise<string> {
    if (this.systemRepository && (this.systemRepository as any).getDockerExecutable) {
      return await (this.systemRepository as any).getDockerExecutable();
    }
    return 'docker';
  }

  private async getComposeCommand(): Promise<string> {
    const dockerPath = await this.getDockerPath();
    try {
      await execAsync(`${dockerPath} compose version`);
      return `${dockerPath} compose`;
    } catch (e1: any) {
      console.log(`DockerComposeAdapter: "${dockerPath} compose" no disponible, probando con comando standalone...`);
      
      // Si el dockerPath es un ejecutable específico, intentamos buscar docker-compose en la misma carpeta
      let standaloneCmd = 'docker-compose';
      if (dockerPath.includes('/')) {
        const binDir = path.dirname(dockerPath);
        standaloneCmd = path.join(binDir, 'docker-compose');
      }

      try {
        await execAsync(`${standaloneCmd} version`);
        return standaloneCmd;
      } catch (e2: any) {
        const errorMsg = 'No se encontró "docker compose" ni "docker-compose" en el sistema. Por favor, asegúrate de que Docker está instalado o especifica su ruta en la configuración.';
        console.error('DockerComposeAdapter:', errorMsg, { e1: e1.message, e2: e2.message });
        throw new Error(errorMsg);
      }
    }
  }

  async start(composePath: string): Promise<void> {
    const composeCmd = await this.getComposeCommand();
    console.log(`DockerComposeAdapter: Iniciando con comando "${composeCmd}" y archivo "${composePath}"`);
    try {
      // Intentar matar procesos que ocupen los puertos configurados antes de arrancar
      if (this.systemRepository) {
        console.log('DockerComposeAdapter: Intentando liberar puertos...');
        await this.systemRepository.killPortProcess(8006);
        await this.systemRepository.killPortProcess(5900);
      }
      
      // Intentar detener cualquier instancia previa que pueda estar bloqueando puertos
      console.log('DockerComposeAdapter: Bajando instancias previas...');
      await execAsync(`${composeCmd} -p macboat -f ${composePath} down --remove-orphans`);
    } catch (e) {
      console.log('DockerComposeAdapter: Aviso - No se pudo bajar el contenedor previo o matar proceso:', e);
    }
    
    try {
      console.log('DockerComposeAdapter: Ejecutando up -d...');
      await execAsync(`${composeCmd} -p macboat -f ${composePath} up -d`);
      console.log('DockerComposeAdapter: Comando up ejecutado con éxito');
    } catch (e: any) {
      console.error('DockerComposeAdapter: Error fatal al ejecutar docker compose up:', e);
      throw new Error(`Error al iniciar Docker: ${e.message}`);
    }
  }

  async stop(composePath: string): Promise<void> {
    const composeCmd = await this.getComposeCommand();
    await execAsync(`${composeCmd} -p macboat -f ${composePath} stop`);
  }

  async getLogs(composePath: string, callback: (log: string) => void): Promise<void> {
    const composeCmd = await this.getComposeCommand();
    const args = composeCmd === 'docker compose' 
      ? ['compose', '-p', 'macboat', '-f', composePath, 'logs', '-f']
      : ['-p', 'macboat', '-f', composePath, 'logs', '-f'];
    
    const cmd = composeCmd === 'docker compose' ? 'docker' : 'docker-compose';
    const child = spawn(cmd, args);
    
    child.stdout.on('data', (data) => callback(data.toString()));
    child.stderr.on('data', (data) => callback(data.toString()));
  }
}
