#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Puerto (Interfaz) para interactuar con el sistema operativo host.
Port (Interface) to interact with the host operating system.
"""
from abc import ABC, abstractmethod
from macboat.domain.system_status import SystemStatus

class SystemRepository(ABC):
    @abstractmethod
    def get_system_status(self) -> SystemStatus:
        """Obtiene el estado de las dependencias. / Gets the status of dependencies."""
        pass

    @abstractmethod
    def get_block_devices(self) -> list:
        """Lists available block devices on the system.
        Lista los dispositivos de bloque disponibles en el sistema."""
        pass

    @abstractmethod
    def get_usb_devices(self) -> list:
        """Lists available USB devices on the system.
        Lista los dispositivos USB disponibles en el sistema."""
        pass

    @abstractmethod
    def docker_network_exists(self, network_name: str) -> bool:
        """Checks if a Docker network exists.
        Comprueba si existe una red de Docker."""
        pass

    @abstractmethod
    def create_macvlan_network(self, network_name: str) -> bool:
        """Attempts to automatically detect network info and create a macvlan network.
        Intenta detectar automáticamente la información de red y crear una red macvlan."""
        pass
