import fs from 'fs/promises';
import path from 'path';

export interface DetectedVM {
  version: string;
  path: string;
  name: string;
  hasData: boolean;
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
          
          try {
            const stats = await fs.stat(dataImg);
            // Si el disco de datos existe y tiene tamaño real (más de 1GB por ejemplo)
            const hasData = stats.size > 1024 * 1024 * 1024;
            
            vms.push({
              version: entry.name,
              path: versionPath,
              name: `macOS ${entry.name}`,
              hasData: hasData
            });
          } catch {
            // Si no hay data.img pero hay base.dmg, es una instalación a medias o preparada
            try {
              await fs.access(baseImg);
              vms.push({
                version: entry.name,
                path: versionPath,
                name: `macOS ${entry.name} (Incompleto)`,
                hasData: false
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
