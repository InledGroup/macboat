#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Entidad que representa el estado actual del sistema y dependencias.
Entity representing the current system state and dependencies.
"""
from dataclasses import dataclass

@dataclass
class SystemStatus:
    docker_installed: bool
    docker_running: bool
    compose_installed: bool
    kvm_enabled: bool
    qemu_installed: bool

    @property
    def is_ready(self) -> bool:
        """Devuelve True si el sistema está listo para ejecutar la VM. / Returns True if the system is ready to run the VM."""
        return self.docker_installed and self.docker_running and self.compose_installed and self.kvm_enabled and self.qemu_installed
