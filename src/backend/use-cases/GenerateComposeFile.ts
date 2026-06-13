import { DockerRepository } from '@core/repositories/DockerRepository.js';
import { MacOSConfig } from '@core/entities/MacOSConfig.js';
import path from 'path';

export class GenerateComposeFile {
  constructor(private dockerRepository: DockerRepository) {}

  async execute(config: MacOSConfig, storagePath: string, appPath: string): Promise<string> {
    return await this.dockerRepository.generateComposeFile(config, storagePath, appPath);
  }
}
