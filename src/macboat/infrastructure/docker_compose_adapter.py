#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Docker adapter using subprocess to manage containers.
"""
import yaml
import subprocess
import socket
from typing import Optional
from macboat.ports.docker_repository import DockerRepository
from macboat.domain.macos_config import MacOSConfig

class DockerComposeAdapter(DockerRepository):
    def _is_port_free(self, port: int) -> bool:
        """Checks if a TCP port is free on localhost."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) != 0

    def _find_free_port(self, start_port: int) -> int:
        """Finds the first available port starting from start_port."""
        port = start_port
        while not self._is_port_free(port):
            port += 1
        return port

    def generate_compose_file(self, config: MacOSConfig, output_path: str) -> bool:
        # Automatically find free ports if they are not already set or conflicted
        config.web_port = self._find_free_port(config.web_port)
        config.vnc_port = self._find_free_port(config.vnc_port)

        # Map version names to dockurr/macos supported values
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
                'macboat-storage': None
            }
        }
        
        try:
            with open(output_path, 'w') as f:
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
        """Checks if the VM is installed by looking for the docker-compose.yml file."""
        import os
        return os.path.exists("docker-compose.yml")

    def get_existing_config(self) -> Optional[MacOSConfig]:
        """Reads the existing docker-compose.yml to extract config."""
        import os
        if not os.path.exists("docker-compose.yml"):
            return None
        
        try:
            with open("docker-compose.yml", 'r') as f:
                data = yaml.safe_load(f)
                env = data['services']['macos']['environment']
                ports = data['services']['macos']['ports']
                
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
        """Stops the VM using docker compose down."""
        try:
            subprocess.run(['docker', 'compose', 'down'], check=True)
            return True
        except:
            try:
                subprocess.run(['docker-compose', 'down'], check=True)
                return True
            except:
                return False

    def restart_vm(self) -> bool:
        """Restarts the VM using docker compose restart."""
        try:
            subprocess.run(['docker', 'compose', 'restart'], check=True)
            return True
        except:
            try:
                subprocess.run(['docker-compose', 'restart'], check=True)
                return True
            except:
                return False

    def run_compose(self, compose_path: str) -> subprocess.Popen:
        """Runs docker compose up and returns the process handle."""
        commands_to_try = [
            ['docker', 'compose', '-f', compose_path, 'up'],
            ['docker-compose', '-f', compose_path, 'up']
        ]
        
        for cmd in commands_to_try:
            try:
                process = subprocess.Popen(
                    cmd,
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
