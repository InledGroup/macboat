#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Entidad que representa la configuración de la máquina virtual de macOS.
Entity representing the macOS virtual machine configuration.
"""
from dataclasses import dataclass
from typing import Optional

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
