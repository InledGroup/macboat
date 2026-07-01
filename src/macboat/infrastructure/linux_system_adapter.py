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

    def get_block_devices(self) -> list:
        """Lists available block devices on the system.
        Lista los dispositivos de bloque disponibles en el sistema."""
        try:
            # Output format: NAME,SIZE,TYPE,MODEL
            # Ensure -p (full path) is used
            result = subprocess.run(
                ['lsblk', '-p', '-n', '-o', 'NAME,SIZE,TYPE,MODEL'],
                capture_output=True, text=True, check=True
            )
            devices = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                # Split by multiple spaces
                parts = [p.strip() for p in line.split(' ') if p.strip()]
                if len(parts) >= 3:
                    path = parts[0]
                    size = parts[1]
                    dev_type = parts[2]
                    # Rest of parts form the model name
                    model = " ".join(parts[3:]) if len(parts) > 3 else ""
                    # We filter for disks and partition types, excluding loop/ram devices
                    if dev_type in ['disk', 'part'] and not path.startswith('/dev/loop'):
                        devices.append({
                            'path': path,
                            'size': size,
                            'type': dev_type,
                            'model': model
                        })
            return devices
        except Exception as e:
            print(f"Error listing block devices: {e}")
            return []

    def get_usb_devices(self) -> list:
        """Lists available USB devices on the system.
        Lista los dispositivos USB disponibles en el sistema."""
        try:
            result = subprocess.run(
                ['lsusb'],
                capture_output=True, text=True, check=True
            )
            devices = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                # Example line: Bus 001 Device 002: ID 046d:c534 Logitech, Inc. Unifying Receiver
                if "ID " in line:
                    parts = line.split("ID ")
                    desc = parts[1] # e.g. "046d:c534 Logitech, Inc. Unifying Receiver"
                    id_parts = desc.split(" ")
                    usb_id = id_parts[0] # e.g. "046d:c534"
                    name = " ".join(id_parts[1:]) # e.g. "Logitech, Inc. Unifying Receiver"
                    # Filter out root hubs as they are system USB controllers
                    # Filtrar hubs raíz ya que son controladores USB del sistema
                    if "root hub" in name.lower():
                        continue
                    devices.append({
                        'id': usb_id,
                        'name': name,
                        'full_line': line
                    })
            return devices
        except Exception as e:
            print(f"Error listing USB devices: {e}")
            return []

    def docker_network_exists(self, network_name: str) -> bool:
        """Checks if a Docker network exists.
        Comprueba si existe una red de Docker."""
        try:
            result = subprocess.run(
                ['docker', 'network', 'inspect', network_name],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            return result.returncode == 0
        except:
            return False

    def create_macvlan_network(self, network_name: str) -> bool:
        """Attempts to automatically detect network info and create a macvlan network.
        Intenta detectar automáticamente la información de red y crear una red macvlan."""
        info = self._detect_default_network_info()
        if not info['interface'] or not info['subnet'] or not info['gateway']:
            print("Could not auto-detect default network parameters / No se pudieron detectar los parámetros de red automáticamente")
            return False
            
        try:
            print(f"Creating macvlan network '{network_name}' on interface {info['interface']}...")
            subprocess.run([
                'docker', 'network', 'create', '-d', 'macvlan',
                f"--subnet={info['subnet']}",
                f"--gateway={info['gateway']}",
                '-o', f"parent={info['interface']}",
                network_name
            ], check=True)
            return True
        except Exception as e:
            print(f"Error creating macvlan network: {e}")
            return False

    def _detect_default_network_info(self) -> dict:
        """Detects default network interface, gateway and subnet on Linux.
        Detecta la interfaz de red, puerta de enlace y subred por defecto en Linux."""
        info = {'interface': None, 'gateway': None, 'subnet': None}
        try:
            # Get default route
            # Obtener ruta por defecto
            result = subprocess.run(
                "ip route show | grep default",
                shell=True, capture_output=True, text=True
            )
            line = result.stdout.strip()
            if line:
                parts = line.split()
                if 'via' in parts and 'dev' in parts:
                    info['gateway'] = parts[parts.index('via') + 1]
                    info['interface'] = parts[parts.index('dev') + 1]
            
            # Get subnet of that interface
            # Obtener subred de esa interfaz
            if info['interface']:
                res_ip = subprocess.run(
                    f"ip route show | grep {info['interface']} | grep -v default",
                    shell=True, capture_output=True, text=True
                )
                ip_lines = res_ip.stdout.strip().split('\n')
                for ip_line in ip_lines:
                    ip_parts = ip_line.split()
                    if ip_parts:
                        # First part should be the subnet e.g. 192.168.1.0/24
                        if '/' in ip_parts[0]:
                            info['subnet'] = ip_parts[0]
                            break
        except Exception as e:
            print(f"Error detecting network info: {e}")
        return info
