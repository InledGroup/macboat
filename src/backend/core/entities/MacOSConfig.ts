export interface MacOSConfig {
  version: string;
  ramSize: string;
  cpuCores: number;
  diskSize: string;
  installDisk?: string;
  sharedFolders: { hostPath: string; containerPath: string }[];
  usbDevices: { vendorId: string; productId: string }[];
}
