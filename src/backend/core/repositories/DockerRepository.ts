import { MacOSConfig } from '../entities/MacOSConfig.js';

export interface DockerRepository {
  generateComposeFile(config: MacOSConfig, projectPath: string): Promise<string>;
  start(composePath: string): Promise<void>;
  stop(composePath: string): Promise<void>;
  getLogs(composePath: string, callback: (log: string) => void): void;
}
