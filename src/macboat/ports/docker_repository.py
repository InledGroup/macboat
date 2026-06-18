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
