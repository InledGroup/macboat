import fs from 'fs/promises';
import path from 'path';

export interface DetectedVM {
  id: string;
  version: string;
  path: string;
  name: string;
  hasData: boolean;
  config?: any;
}

export class CheckExistingImage {
  async execute(projectPath: string): Promise<DetectedVM[]> {
    const storagePath = path.join(projectPath, 'storage');
    const vms: DetectedVM[] = [];

    try {
      const entries = await fs.readdir(storagePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const versionPath = path.join(storagePath, entry.name);
          const dataImg = path.join(versionPath, 'data.img');
          const baseImg = path.join(versionPath, 'base.dmg');
          const configJson = path.join(versionPath, 'macboat.json');
          
          let vmName = `macOS ${entry.name}`;
          let vmConfig: any = null;

          try {
            const configData = await fs.readFile(configJson, 'utf-8');
            vmConfig = JSON.parse(configData);
            if (vmConfig.name) vmName = vmConfig.name;
          } catch {}

          try {
            const stats = await fs.stat(dataImg);
            // Si el disco de datos existe y tiene tamaño real (más de 1GB por ejemplo)
            const hasData = stats.size > 1024 * 1024 * 1024;
            
            vms.push({
              id: entry.name,
              version: vmConfig?.version || entry.name,
              path: versionPath,
              name: vmName,
              hasData: hasData,
              config: vmConfig
            });
          } catch {
            // Si no hay data.img pero hay base.dmg, es una instalación a medias o preparada
            try {
              await fs.access(baseImg);
              vms.push({
                id: entry.name,
                version: vmConfig?.version || entry.name,
                path: versionPath,
                name: `${vmName} (Incompleto)`,
                hasData: false,
                config: vmConfig
              });
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error('Error scanning storage:', e);
    }

    return vms;
  }
}
