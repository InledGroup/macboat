import { SystemRepository } from '@core/repositories/SystemRepository.js';
import { SystemStatus } from '@core/entities/SystemStatus.js';

export class CheckSystemDependencies {
  constructor(private systemRepository: SystemRepository) {}

  async execute(): Promise<SystemStatus> {
    return await this.systemRepository.getStatus();
  }
}
