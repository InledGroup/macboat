#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Adaptador del sistema que interactúa con Linux mediante comandos shell.
System adapter that interacts with Linux via shell commands.
"""
import subprocess
import os
from macboat.domain.system_status import SystemStatus
from macboat.ports.system_repository import SystemRepository

class LinuxSystemAdapter(SystemRepository):
    def get_system_status(self) -> SystemStatus:
        docker_installed = self._command_exists('docker')
        docker_running = self._is_docker_running() if docker_installed else False
        kvm_enabled = self._is_kvm_enabled()
        
        # Check for both modern 'docker compose' (V2) and legacy 'docker-compose' (V1)
        compose_v2 = self._docker_compose_v2_exists() if docker_installed else False
        compose_legacy = self._command_exists('docker-compose')
        
        qemu_installed = self._command_exists('qemu-system-x86_64')

        return SystemStatus(
            docker_installed=docker_installed,
            docker_running=docker_running,
            compose_installed=compose_v2 or compose_legacy,
            kvm_enabled=kvm_enabled,
            qemu_installed=qemu_installed
        )

    def _docker_compose_v2_exists(self) -> bool:
        """Checks if the docker compose plugin (V2) is installed."""
        try:
            subprocess.run(['docker', 'compose', 'version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except:
            return False

    def _command_exists(self, cmd: str) -> bool:
        """Comprueba si un comando existe en el PATH. / Checks if a command exists in PATH."""
        try:
            subprocess.run(['which', cmd], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def _is_docker_running(self) -> bool:
        """Comprueba si el demonio de Docker está corriendo. / Checks if Docker daemon is running."""
        try:
            subprocess.run(['docker', 'info'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return True
        except subprocess.CalledProcessError:
            return False

    def _is_kvm_enabled(self) -> bool:
        """Comprueba si KVM está disponible y el usuario tiene acceso. / Checks if KVM is available and user has access."""
        return os.access('/dev/kvm', os.R_OK | os.W_OK)
