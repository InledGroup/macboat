#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Caso de uso para comprobar las dependencias del sistema.
Use case to check system dependencies.
"""
from macboat.domain.system_status import SystemStatus
from macboat.ports.system_repository import SystemRepository

class CheckSystemDependencies:
    def __init__(self, system_repo: SystemRepository):
        self.system_repo = system_repo

    def execute(self) -> SystemStatus:
        """
        Ejecuta la comprobación. / Executes the check.
        """
        return self.system_repo.get_system_status()
