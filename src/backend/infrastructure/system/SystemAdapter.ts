import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { SystemRepository } from '@core/repositories/SystemRepository.js';
import { SystemStatus } from '@core/entities/SystemStatus.js';

const execAsync = promisify(exec);

export class SystemAdapter implements SystemRepository {
  async getStatus(): Promise<SystemStatus> {
    console.log('SystemAdapter: Obteniendo estado del sistema...');
    const platform = os.platform() as 'linux' | 'win32' | 'darwin';
    
    const [dockerInstalled, dockerRunning, isDockerDesktop, userInDockerGroup, kvmSupported] = await Promise.all([
      this.isDockerInstalled().then(v => { console.log('SystemAdapter: Docker instalado:', v); return v; }),
      this.isDockerRunning().then(v => { console.log('SystemAdapter: Docker ejecutándose:', v); return v; }),
      this.checkIsDockerDesktop().then(v => { console.log('SystemAdapter: ¿Es Docker Desktop?:', v); return v; }),
      this.checkDockerGroup().then(v => { console.log('SystemAdapter: Usuario en grupo docker:', v); return v; }),
      this.checkKVM().then(v => { console.log('SystemAdapter: KVM soportado:', v); return v; })
    ]);

    if (!kvmSupported && platform === 'linux') {
      console.warn('SystemAdapter: KVM no detectado. El rendimiento será muy bajo.');
    }

    return {
      dockerInstalled,
      dockerRunning,
      isDockerDesktop,
      userInDockerGroup,
      kvmSupported,
      platform,
      totalMemory: Math.floor(os.totalmem() / (1024 * 1024 * 1024)),
      totalCores: os.cpus().length
    };
  }

  private async checkIsDockerDesktop(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('docker context show');
      return stdout.includes('desktop-linux');
    } catch {
      return false;
    }
  }

  async killPortProcess(port: number): Promise<void> {
    const platform = os.platform();
    if (platform === 'linux') {
      try {
        // Buscamos si hay procesos en el puerto
        const { stdout } = await execAsync(`lsof -t -i:${port}`);
        if (stdout.trim()) {
          console.log(`SystemAdapter: Matando procesos en el puerto ${port}...`);
          // Usamos pkexec para elevar privilegios si es necesario
          await execAsync(`pkexec kill -9 ${stdout.trim().split('\n').join(' ')}`);
        }
      } catch (e) {
        // lsof devuelve error si no hay procesos, así que lo ignoramos si es el caso
        console.log(`SystemAdapter: No se encontraron procesos en el puerto ${port} o error al matar:`, e);
      }
    }
  }

  private async isDockerInstalled(): Promise<boolean> {
    try {
      await execAsync('docker --version');
      return true;
    } catch {
      return false;
    }
  }

  private async isDockerRunning(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }

  async checkDockerGroup(): Promise<boolean> {
    if (os.platform() !== 'linux') return true;
    try {
      const { stdout } = await execAsync('groups');
      return stdout.includes('docker');
    } catch {
      return false;
    }
  }

  async checkKVM(): Promise<boolean> {
    if (os.platform() !== 'linux') return true; // Windows has WSL2/Hyper-V usually
    try {
      const { stdout } = await execAsync('kvm-ok');
      return stdout.includes('KVM acceleration can be used');
    } catch {
      try {
        await execAsync('test -e /dev/kvm');
        return true;
      } catch {
        return false;
      }
    }
  }
}
