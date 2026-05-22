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

  private customDockerPath: string | null = null;

  setCustomDockerPath(path: string) {
    this.customDockerPath = path;
  }

  async getDockerExecutable(): Promise<string> {
    if (this.customDockerPath) return this.customDockerPath;

    const commonPaths = [
      'docker', // Try default PATH first
      '/usr/local/bin/docker',
      '/usr/bin/docker',
      '/bin/docker',
      '/snap/bin/docker',
      '/opt/homebrew/bin/docker', // macOS Homebrew
      '/usr/local/lib/docker'
    ];

    for (const p of commonPaths) {
      try {
        await execAsync(`${p} --version`);
        return p;
      } catch {}
    }

    throw new Error('Docker executable not found');
  }

  private async checkIsDockerDesktop(): Promise<boolean> {
    try {
      const docker = await this.getDockerExecutable();
      const { stdout } = await execAsync(`${docker} context show`);
      return stdout.includes('desktop-linux');
    } catch {
      return false;
    }
  }

  async killPortProcess(port: number): Promise<void> {
    const platform = os.platform();
    if (platform === 'linux') {
      try {
        const { stdout } = await execAsync(`lsof -t -i:${port}`);
        if (stdout.trim()) {
          console.log(`SystemAdapter: Matando procesos en el puerto ${port}...`);
          await execAsync(`pkexec kill -9 ${stdout.trim().split('\n').join(' ')}`);
        }
      } catch (e) {
        console.log(`SystemAdapter: No se encontraron procesos en el puerto ${port} o error al matar:`, e);
      }
    }
  }

  private async isDockerInstalled(): Promise<boolean> {
    try {
      await this.getDockerExecutable();
      return true;
    } catch {
      return false;
    }
  }

  private async isDockerRunning(): Promise<boolean> {
    try {
      const docker = await this.getDockerExecutable();
      await execAsync(`${docker} info`);
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
    if (os.platform() !== 'linux') return true;
    try {
      const { stdout } = await execAsync('kvm-ok');
      return stdout.includes('KVM acceleration can be used');
    } catch {
      try {
        const docker = await this.getDockerExecutable();
        // Sometimes users might have docker but not kvm-ok, check /dev/kvm
        await execAsync('test -e /dev/kvm');
        return true;
      } catch {
        return false;
      }
    }
  }
}
