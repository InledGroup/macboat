import fs from 'fs/promises';
import path from 'path';

export class CheckExistingImage {
  async execute(projectPath: string): Promise<boolean> {
    const storagePath = path.join(projectPath, 'storage', 'base.dmg');
    try {
      await fs.access(storagePath);
      return true;
    } catch {
      return false;
    }
  }
}
