#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Docker adapter using subprocess to manage containers.
"""
import os
import yaml
import subprocess
import socket
import re
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

        # 1. Disk Passthrough / Paso de Discos
        # Use /disk1, /disk2, etc. as specified in the README. Filter out disconnected ones.
        # Usar /disk1, /disk2, etc. como se especifica en el README. Filtrar los desconectados.
        valid_disks = []
        for disk in config.disk_devices:
            if disk and os.path.exists(disk):
                valid_disks.append(disk)
            else:
                print(f"Warning: Disk device {disk} is not connected. Omitted.")
                
        for i, disk in enumerate(valid_disks, 1):
            compose_data['services']['macos']['devices'].append(f"{disk}:/disk{i}")

        # 2. USB Passthrough / Paso de USB
        # Format vendorid=0xXXXX,productid=0xXXXX and mount /dev/bus/usb. Filter out disconnected ones.
        # Formato vendorid=0xXXXX,productid=0xXXXX y montar /dev/bus/usb. Filtrar los desconectados.
        connected_usbs = []
        try:
            res_usb = subprocess.run(['lsusb'], capture_output=True, text=True)
            connected_usbs = re.findall(r'ID ([0-9a-fA-F]{4}:[0-9a-fA-F]{4})', res_usb.stdout)
        except Exception as e:
            print(f"Error checking connected USBs: {e}")
            
        usb_args = []
        for usb in config.usb_devices:
            if ":" in usb:
                vid, pid = usb.split(":")
                clean_vid = vid.strip().replace("0x", "").lower().zfill(4)
                clean_pid = pid.strip().replace("0x", "").lower().zfill(4)
                usb_pair = f"{clean_vid}:{clean_pid}"
                
                is_connected = True
                if connected_usbs:
                    is_connected = usb_pair in [u.lower() for u in connected_usbs]
                    
                if is_connected:
                    usb_args.append(f"-device usb-host,vendorid={vid.strip()},productid={pid.strip()}")
                else:
                    print(f"Warning: USB device {usb} is not connected. Omitted.")
                    
        if usb_args:
            compose_data['services']['macos']['devices'].append('/dev/bus/usb')
            compose_data['services']['macos']['environment']['ARGUMENTS'] = " ".join(usb_args)

        # 3. DHCP Mode (IP Acquisition) / Modo DHCP (Adquisición de IP)
        # Enable DHCP: "Y", add /dev/vhost-net device, configure cgroup rules and vlan network if set
        # Habilitar DHCP: "Y", añadir /dev/vhost-net, cgroup rules y red vlan si se indica
        if config.dhcp_enabled:
            compose_data['services']['macos']['environment']['DHCP'] = 'Y'
            compose_data['services']['macos']['devices'].append('/dev/vhost-net')
            compose_data['services']['macos']['device_cgroup_rules'] = ['c *:* rwm']
            
            # If a custom network name is provided, use it
            # Si se proporciona un nombre de red personalizado, usarlo
            if config.dhcp_network:
                net_name = config.dhcp_network.strip()
                compose_data['services']['macos']['networks'] = {net_name: {}}
                compose_data['networks'] = {
                    net_name: {
                        'external': True
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
                
                # Extraer dispositivos de disco passthrough
                # Extract disk passthrough devices
                disk_devices = []
                devices = data['services']['macos'].get('devices', [])
                for dev in devices:
                    if ':/disk' in dev:
                        disk_devices.append(dev.split(':')[0])
                
                # Extraer dispositivos USB
                # Extract USB devices
                usb_devices = []
                arguments = env.get('ARGUMENTS', '')
                usb_matches = re.findall(r'usb-host,vendorid=([^,\s]+),productid=([^,\s]+)', arguments)
                for vid, pid in usb_matches:
                    usb_devices.append(f"{vid}:{pid}")
                
                # Extraer configuración DHCP y red vlan
                # Extract DHCP configuration and vlan network
                dhcp_enabled = env.get('DHCP') == 'Y'
                dhcp_network = None
                if dhcp_enabled:
                    networks = data['services']['macos'].get('networks', {})
                    if networks:
                        if isinstance(networks, dict):
                            dhcp_network = list(networks.keys())[0]
                        elif isinstance(networks, list):
                            dhcp_network = networks[0]

                return MacOSConfig(
                    version=version, 
                    ram_gb=ram, 
                    cpu_cores=cores, 
                    storage_gb=disk,
                    web_port=web_port,
                    vnc_port=vnc_port,
                    disk_devices=disk_devices,
                    usb_devices=usb_devices,
                    dhcp_enabled=dhcp_enabled,
                    dhcp_network=dhcp_network
                )
        except:
            return None

    def stop_vm(self) -> bool:
        """Stops the VM using docker compose stop.
        Detiene la VM usando docker compose stop."""
        try:
            subprocess.run(['docker', 'compose', 'stop'], cwd=self.config_dir, check=True)
            return True
        except:
            try:
                subprocess.run(['docker-compose', 'stop'], cwd=self.config_dir, check=True)
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
            
            # If the compose file exists but no container is created, append it as exited
            # Si el archivo compose existe pero no se ha creado el contenedor, añadirlo como exited
            if self.is_vm_installed():
                has_compose_vm = any(v['name'] == 'macboat-macos' for v in vms)
                if not has_compose_vm:
                    vms.append({
                        'name': 'macboat-macos',
                        'image': 'dockurr/macos',
                        'status': 'Stopped / Detenida',
                        'state': 'exited',
                        'is_legacy': False
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

    def delete_vm(self, container_name: str, is_legacy: bool) -> bool:
        """Deletes/removes a VM container and its associated configuration and volumes if applicable.
        Elimina el contenedor de la VM y su configuración y volúmenes asociados si corresponde."""
        try:
            # Remove/delete container forcefully
            # Eliminar contenedor a la fuerza
            subprocess.run(['docker', 'rm', '-f', container_name], check=True)
            
            if not is_legacy:
                # Remove docker-compose file if it exists
                # Eliminar archivo docker-compose si existe
                if os.path.exists(self.compose_path):
                    os.remove(self.compose_path)
                
                # Retrieve existing storage volume name and delete it
                # Obtener el nombre del volumen de almacenamiento existente y eliminarlo
                volume_name = self._detect_existing_volume()
                subprocess.run(['docker', 'volume', 'rm', volume_name], capture_output=True)
                
            return True
        except Exception as e:
            print(f"Error deleting VM {container_name}: {e}")
            return False

    def get_container_ip(self, container_name: str) -> str:
        """Inspects the container to find its IP address.
        Inspecciona el contenedor para encontrar su dirección IP."""
        try:
            result = subprocess.run(
                ['docker', 'inspect', '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', container_name],
                capture_output=True, text=True, check=True
            )
            ip = result.stdout.strip()
            return ip if ip else "localhost"
        except Exception as e:
            print(f"Error reading container IP: {e}")
            return "localhost"


