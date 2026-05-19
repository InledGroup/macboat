import { SystemStatus } from '../entities/SystemStatus.js';

export interface SystemRepository {
  getStatus(): Promise<SystemStatus>;
  checkKVM(): Promise<boolean>;
  checkDockerGroup(): Promise<boolean>;
  killPortProcess(port: number): Promise<void>;
}
