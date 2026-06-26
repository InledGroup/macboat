#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Port for Docker operations.
"""
from abc import ABC, abstractmethod
from macboat.domain.macos_config import MacOSConfig

class DockerRepository(ABC):
    @abstractmethod
    def generate_compose_file(self, config: MacOSConfig, output_path: str) -> bool:
        """Generates a docker-compose.yml file based on config."""
        pass

    @abstractmethod
    def check_image_exists(self, image_name: str) -> bool:
        """Checks if a docker image exists locally."""
        pass

    @abstractmethod
    def is_vm_installed(self) -> bool:
        """Checks if a macOS VM is already initialized/installed."""
        pass

    @abstractmethod
    def stop_vm(self) -> bool:
        """Stops the running macOS VM."""
        pass

    @abstractmethod
    def restart_vm(self) -> bool:
        """Restarts the macOS VM."""
        pass

    @abstractmethod
    def run_compose(self, compose_path: str) -> Optional[object]:
        """Runs docker compose up and returns the process handle."""
        pass

    @abstractmethod
    def list_existing_vms(self) -> list:
        """Lists existing macOS containers on the system (both new and legacy).
        Lista los contenedores macOS existentes en el sistema (nuevos y legados)."""
        pass

    @abstractmethod
    def start_legacy_vm(self, container_name: str) -> Optional[object]:
        """Starts a legacy VM container and attaches stdout/stderr for logging.
        Arranca un contenedor VM legado y acopla stdout/stderr para captura de logs."""
        pass

    @abstractmethod
    def stop_legacy_vm(self, container_name: str) -> bool:
        """Stops a running legacy VM container.
        Detiene un contenedor VM legado en ejecución."""
        pass

    @abstractmethod
    def restart_legacy_vm(self, container_name: str) -> bool:
        """Restarts a legacy VM container.
        Reinicia un contenedor VM legado."""
        pass

    @abstractmethod
    def get_container_web_port(self, container_name: str) -> int:
        """Inspects the container to find the host port mapped to 8006.
        Inspecciona el contenedor para encontrar el puerto del host mapeado al 8006."""
        pass


