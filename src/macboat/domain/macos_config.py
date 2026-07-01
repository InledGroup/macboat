#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Entidad que representa la configuración de la máquina virtual de macOS.
Entity representing the macOS virtual machine configuration.
"""
from dataclasses import dataclass, field
from typing import Optional, List

@dataclass
class MacOSConfig:
    version: str
    ram_gb: int
    cpu_cores: int
    storage_gb: int
    custom_mac_address: Optional[str] = None
    headless: bool = False
    web_port: int = 8006
    vnc_port: int = 5900
    # List of host disk paths to pass through (e.g., ["/dev/sdb", "/dev/sdc1"])
    # Lista de rutas de disco del host a pasar (ej. ["/dev/sdb", "/dev/sdc1"])
    disk_devices: List[str] = field(default_factory=list)
    # List of USB device IDs to pass through in vendor:product format (e.g., ["0x1234:0x5678"])
    # Lista de IDs de dispositivos USB a pasar en formato vendor:product (ej. ["0x1234:0x5678"])
    usb_devices: List[str] = field(default_factory=list)
    # Flag to enable DHCP mode
    # Bandera para habilitar el modo DHCP
    dhcp_enabled: bool = False
    # Custom macvlan network name for DHCP mode
    # Nombre de red macvlan personalizado para el modo DHCP
    dhcp_network: Optional[str] = None
