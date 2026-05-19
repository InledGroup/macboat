export interface SystemStatus {
  dockerInstalled: boolean;
  dockerRunning: boolean;
  isDockerDesktop: boolean;
  userInDockerGroup: boolean;
  kvmSupported: boolean;
  platform: 'linux' | 'win32' | 'darwin';
  totalMemory: number; // in GB
  totalCores: number;
}
