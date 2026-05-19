export interface MacOSConfig {
  version: string;
  ramSize: string;
  cpuCores: number;
  diskSize: string;
  sharedFolders: { hostPath: string; containerPath: string }[];
  usbDevices: { vendorId: string; productId: string }[];
}
