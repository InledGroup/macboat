#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Docker adapter using subprocess to manage containers.
"""
import os
import yaml
import subprocess
import socket
from typing import Optional
from macboat.ports.docker_repository import DockerRepository
from macboat.domain.macos_config import MacOSConfig

class DockerComposeAdapter(DockerRepository):
    def __init__(self):
        import os
        # Directorio de configuración fijo de la aplicación (especificación XDG)
        # Fixed application configuration directory (XDG specification)
        self.config_dir = os.path.expanduser("~/.config/macboat")
        self.compose_path = os.path.join(self.config_dir, "docker-compose.yml")
        
        # Asegurar que el directorio de configuración exista
        # Ensure that the configuration directory exists
        os.makedirs(self.config_dir, exist_ok=True)

    def _is_port_free(self, port: int) -> bool:
        """Checks if a TCP port is free on localhost.
        Comprueba si un puerto TCP está libre en localhost."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) != 0

    def _find_free_port(self, start_port: int) -> int:
        """Finds the first available port starting from start_port.
        Encuentra el primer puerto disponible a partir de start_port."""
        port = start_port
        while not self._is_port_free(port):
            port += 1
        return port

    def _detect_existing_volume(self) -> str:
        """Detects if a legacy volume exists to preserve user data.
        Detecta si existe un volumen legado para preservar los datos del usuario."""
        try:
            result = subprocess.run(
                ['docker', 'volume', 'ls', '--format', '{{.Name}}'],
                capture_output=True, text=True, check=True
            )
            volumes = result.stdout.strip().split('\n')
            
            # Preferimos jaime_macboat-storage (el del home), luego macos_macboat-storage (el de desarrollo)
            # We prefer jaime_macboat-storage (home one), then macos_macboat-storage (dev one)
            for v in ['jaime_macboat-storage', 'macos_macboat-storage']:
                if v in volumes:
                    return v
            return 'macboat-storage'
        except:
            return 'macboat-storage'

    def generate_compose_file(self, config: MacOSConfig, output_path: str) -> bool:
        # Usamos la ruta del directorio de configuración unificado en lugar de la ruta relativa local.
        # We use the unified configuration directory path instead of the local relative path.
        target_path = self.compose_path

        # Buscar puertos libres automáticamente si es necesario
        # Automatically find free ports if necessary
        config.web_port = self._find_free_port(config.web_port)
        config.vnc_port = self._find_free_port(config.vnc_port)

        # Detectar si hay un volumen previo para no perder los datos instalados
        # Detect if a previous volume exists to avoid losing installed data
        volume_name = self._detect_existing_volume()

        # Mapa de nombres de versiones admitidas por dockurr/macos
        # Map of version names supported by dockurr/macos
        version_map = {
            "sequoia": "15",
            "sonoma": "14",
            "ventura": "13",
            "monterey": "12",
            "big-sur": "11",
            "catalina": "10.15"
        }
        ver = version_map.get(config.version, "15")

        compose_data = {
            'services': {
                'macos': {
                    'image': 'dockurr/macos',
                    'container_name': 'macboat-macos',
                    # privileged: true es crucial para dar permisos de red y KVM completos dentro del contenedor.
                    # privileged: true is crucial to grant full network and KVM permissions inside the container.
                    'privileged': True,
                    'environment': {
                        'VERSION': ver,
                        'RAM_SIZE': f'{config.ram_gb}G',
                        'CPU_CORES': f'{config.cpu_cores}',
                        'DISK_SIZE': f'{config.storage_gb}G',
                    },
                    'devices': [
                        '/dev/kvm',
                        '/dev/net/tun'
                    ],
                    'cap_add': ['NET_ADMIN'],
                    'dns': [
                        '8.8.8.8',
                        '1.1.1.1'
                    ],
                    'ports': [
                        f'{config.web_port}:8006',
                        f'{config.vnc_port}:5900',
                    ],
                    'volumes': [
                        'macboat-storage:/storage'
                    ],
                    'stop_grace_period': '2m'
                }
            },
            'volumes': {
                'macboat-storage': {
                    # Forzamos que apunte al volumen real existente para reutilizar sus datos.
                    # We force it to point to the actual existing volume to reuse its data.
                    'name': volume_name
                }
            }
        }
        
        try:
            with open(target_path, 'w') as f:
                yaml.dump(compose_data, f)
            return True
        except Exception as e:
            print(f"Error generating compose file: {e}")
            return False

    def check_image_exists(self, image_name: str) -> bool:
        try:
            result = subprocess.run(['docker', 'images', '-q', image_name], capture_output=True, text=True)
            return len(result.stdout.strip()) > 0
        except:
            return False

    def is_vm_installed(self) -> bool:
        """Checks if the VM is installed by looking for the docker-compose.yml file.
        Comprueba si la VM está instalada buscando el archivo docker-compose.yml."""
        return os.path.exists(self.compose_path)

    def get_existing_config(self) -> Optional[MacOSConfig]:
        """Reads the existing docker-compose.yml to extract config.
        Lee el docker-compose.yml existente para extraer la configuración."""
        if not os.path.exists(self.compose_path):
            return None
        
        try:
            with open(self.compose_path, 'r') as f:
                data = yaml.safe_load(f)
                env = data['services']['macos']['environment']
                ports = data['services']['macos']['ports']
                
                # Extraer puertos del mapeo
                # Extract ports from mapping
                web_port = int(ports[0].split(':')[0])
                vnc_port = int(ports[1].split(':')[0])
                
                ver_inv_map = {"15": "sequoia", "14": "sonoma", "13": "ventura", "12": "monterey", "11": "big-sur", "10.15": "catalina"}
                version = ver_inv_map.get(env.get('VERSION'), "sequoia")
                ram = int(env.get('RAM_SIZE', '4G').replace('G', ''))
                cores = int(env.get('CPU_CORES', '1'))
                disk = int(env.get('DISK_SIZE', '64G').replace('G', ''))
                
                return MacOSConfig(
                    version=version, 
                    ram_gb=ram, 
                    cpu_cores=cores, 
                    storage_gb=disk,
                    web_port=web_port,
                    vnc_port=vnc_port
                )
        except:
            return None

    def stop_vm(self) -> bool:
        """Stops the VM using docker compose down.
        Detiene la VM usando docker compose down."""
        try:
            subprocess.run(['docker', 'compose', 'down'], cwd=self.config_dir, check=True)
            return True
        except:
            try:
                subprocess.run(['docker-compose', 'down'], cwd=self.config_dir, check=True)
                return True
            except:
                return False

    def restart_vm(self) -> bool:
        """Restarts the VM using docker compose restart.
        Reinicia la VM usando docker compose restart."""
        try:
            subprocess.run(['docker', 'compose', 'restart'], cwd=self.config_dir, check=True)
            return True
        except:
            try:
                subprocess.run(['docker-compose', 'restart'], cwd=self.config_dir, check=True)
                return True
            except:
                return False

    def run_compose(self, compose_path: str) -> subprocess.Popen:
        """Runs docker compose up and returns the process handle.
        Ejecuta docker compose up y devuelve el gestor del proceso."""
        # Eliminar contenedor en conflicto si existe para aplicar la nueva configuración sin fallos de colisión
        # Remove conflicting container if it exists to apply new configuration without collision failures
        try:
            check_result = subprocess.run(
                ['docker', 'inspect', 'macboat-macos'],
                capture_output=True, text=True
            )
            if check_result.returncode == 0:
                print("Conflicting container 'macboat-macos' found. Removing it to apply configuration...")
                subprocess.run(['docker', 'rm', '-f', 'macboat-macos'], check=True)
        except Exception as e:
            print(f"Error resolving conflicting container: {e}")

        commands_to_try = [
            ['docker', 'compose', 'up'],
            ['docker-compose', 'up']
        ]
        
        for cmd in commands_to_try:
            try:
                process = subprocess.Popen(
                    cmd,
                    cwd=self.config_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
                return process
            except FileNotFoundError:
                continue
            except Exception as e:
                print(f"Error starting {cmd[0]}: {e}")
                return None
        
        return None

    def list_existing_vms(self) -> list:
        """Lists existing macOS containers on the system (both new and legacy).
        Lista los contenedores macOS existentes en el sistema (nuevos y legados)."""
        try:
            result = subprocess.run(
                ['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}'],
                capture_output=True, text=True, check=True
            )
            vms = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue
                parts = line.split('\t')
                if len(parts) >= 4:
                    name, image, status, state = parts[0], parts[1], parts[2], parts[3]
                    # Filtramos por contenedores que correspondan a macboat o dockurr/macos
                    # Filter by containers that correspond to macboat or dockurr/macos
                    if 'macboat' in name or 'macos' in name or 'dockurr/macos' in image or 'macboat-local' in image:
                        vms.append({
                            'name': name,
                            'image': image,
                            'status': status,
                            'state': state,
                            'is_legacy': name != 'macboat-macos'
                        })
            return vms
        except Exception as e:
            print(f"Error listing VMs: {e}")
            return []

    def start_legacy_vm(self, container_name: str) -> Optional[object]:
        """Starts a legacy VM container and attaches stdout/stderr for logging.
        Arranca un contenedor VM legado y acopla stdout/stderr para captura de logs."""
        try:
            process = subprocess.Popen(
                ['docker', 'start', '-a', container_name],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            return process
        except Exception as e:
            print(f"Error starting legacy VM {container_name}: {e}")
            return None

    def stop_legacy_vm(self, container_name: str) -> bool:
        """Stops a running legacy VM container.
        Detiene un contenedor VM legado en ejecución."""
        try:
            subprocess.run(['docker', 'stop', container_name], check=True)
            return True
        except Exception as e:
            print(f"Error stopping legacy VM {container_name}: {e}")
            return False

    def restart_legacy_vm(self, container_name: str) -> bool:
        """Restarts a legacy VM container.
        Reinicia un contenedor VM legado."""
        try:
            subprocess.run(['docker', 'restart', container_name], check=True)
            return True
        except Exception as e:
            print(f"Error restarting legacy VM {container_name}: {e}")
            return False

    def get_container_web_port(self, container_name: str) -> int:
        """Inspects the container to find the host port mapped to 8006.
        Inspecciona el contenedor para encontrar el puerto del host mapeado al 8006."""
        try:
            result = subprocess.run(
                ['docker', 'inspect', '--format', '{{(index (index .NetworkSettings.Ports "8006/tcp") 0).HostPort}}', container_name],
                capture_output=True, text=True, check=True
            )
            return int(result.stdout.strip())
        except Exception as e:
            print(f"Error reading container port, fallback to 8006: {e}")
            return 8006


