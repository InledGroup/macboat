import { USBAdapter } from '../infrastructure/usb/USBAdapter.js';

export class MonitorUSBDevices {
  constructor(private usbAdapter: USBAdapter) {}

  onDeviceChange(callback: (device: any, type: 'attached' | 'detached') => void) {
    this.usbAdapter.on('device-attached', (device) => callback(device, 'attached'));
    this.usbAdapter.on('device-detached', (device) => callback(device, 'detached'));
  }

  getConnectedDevices() {
    return this.usbAdapter.getConnectedDevices();
  }
}
