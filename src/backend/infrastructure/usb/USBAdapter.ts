import { usb, Device } from 'usb';
import { EventEmitter } from 'events';

export class USBAdapter extends EventEmitter {
  constructor() {
    super();
    usb.on('attach', (device: Device) => {
      this.emit('device-attached', this.formatDevice(device));
    });
    usb.on('detach', (device: Device) => {
      this.emit('device-detached', this.formatDevice(device));
    });
  }

  private formatDevice(device: Device) {
    return {
      vendorId: `0x${device.deviceDescriptor.idVendor.toString(16).padStart(4, '0')}`,
      productId: `0x${device.deviceDescriptor.idProduct.toString(16).padStart(4, '0')}`
    };
  }

  getConnectedDevices() {
    return usb.getDeviceList().map(device => this.formatDevice(device));
  }
}
