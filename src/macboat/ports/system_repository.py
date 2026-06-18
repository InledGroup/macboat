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
