#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Main application view.
"""
import gi
import threading

# Try to find a compatible WebKit version
WEBKIT_AVAILABLE = False
for version in ['6.0', '5.0', '4.1']:
    try:
        gi.require_version('WebKit', version)
        from gi.repository import WebKit
        WEBKIT_AVAILABLE = True
        break
    except (ValueError, ImportError):
        try:
            gi.require_version('WebKit2', version)
            from gi.repository import WebKit2 as WebKit
            WEBKIT_AVAILABLE = True
            break
        except (ValueError, ImportError):
            continue

gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Gtk, Adw, GLib, Gio

from macboat.application.check_system_dependencies import CheckSystemDependencies
from macboat.infrastructure.linux_system_adapter import LinuxSystemAdapter
from macboat.infrastructure.docker_compose_adapter import DockerComposeAdapter
from macboat.domain.macos_config import MacOSConfig
from macboat.presentation.config_wizard import ConfigWizard

class MainWindow(Adw.ApplicationWindow):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_title("Macboat")
        self.set_default_size(1024, 768)
        self.set_icon_name("es.inled.Macboat")
        
        # Track previous page for instructions back button
        self.previous_page = "status"

        # Setup repositories and use cases
        self.system_adapter = LinuxSystemAdapter()
        self.docker_adapter = DockerComposeAdapter()
        self.check_deps_uc = CheckSystemDependencies(self.system_adapter)

        # Build UI
        self.build_ui()
        
        # Start checking
        self.check_dependencies()

    def build_ui(self):
        # Toast overlay for notifications
        self.overlay = Adw.ToastOverlay()
        self.set_content(self.overlay)

        # Main stack for different screens
        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)
        self.stack.set_vexpand(True)
        self.stack.set_hexpand(True)
        self.overlay.set_child(self.stack)

        # 1. Status Page
        self.status_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        header_bar = Adw.HeaderBar()
        
        # Help button in main screen
        help_btn = Gtk.Button.new_from_icon_name("help-about-symbolic")
        help_btn.set_tooltip_text("Legal & Instructions")
        help_btn.connect("clicked", self.on_show_instructions, "status")
        header_bar.pack_end(help_btn)
        
        self.status_box.append(header_bar)
        
        self.status_page = Adw.StatusPage()
        self.status_page.set_title("Macboat")
        self.status_page.set_description("Checking system dependencies...")
        self.status_page.set_icon_name("system-search-symbolic")
        self.status_page.set_vexpand(True)
        
        self.status_content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.status_page.set_child(self.status_content)
        
        self.spinner = Gtk.Spinner()
        self.spinner.start()
        self.spinner.set_halign(Gtk.Align.CENTER)
        self.status_content.append(self.spinner)

        self.vm_list_box = Gtk.ListBox()
        self.vm_list_box.add_css_class("boxed-list")
        self.vm_list_box.set_selection_mode(Gtk.SelectionMode.NONE)
        
        self.vm_list_group = Adw.PreferencesGroup(title="Select a VM to run / Selecciona una VM a ejecutar")
        self.vm_list_group.add(self.vm_list_box)
        self.vm_list_group.set_visible(False)
        self.status_content.append(self.vm_list_group)

        # Horizontal box for VM action buttons
        # Caja horizontal para los botones de acción de las VMs
        self.action_button_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        self.action_button_box.set_halign(Gtk.Align.CENTER)
        self.action_button_box.set_visible(False)
        self.status_content.append(self.action_button_box)

        # Button to setup a new VM
        # Botón para configurar una nueva VM
        self.setup_new_button = Gtk.Button(label="Setup New VM / Configurar Nueva VM")
        self.setup_new_button.add_css_class("pill")
        self.setup_new_button.add_css_class("suggested-action")
        self.setup_new_button.connect("clicked", self.on_setup_new_clicked)
        self.action_button_box.append(self.setup_new_button)

        # Button to reconfigure an existing VM
        # Botón para reconfigurar una VM existente
        self.reconfigure_button = Gtk.Button(label="Reconfigure VM / Reconfigurar VM")
        self.reconfigure_button.add_css_class("pill")
        self.reconfigure_button.connect("clicked", self.on_reconfigure_clicked)
        self.action_button_box.append(self.reconfigure_button)

        self.instructions_button = Gtk.Button(label="Read Instructions & EULA")
        self.instructions_button.set_halign(Gtk.Align.CENTER)
        self.instructions_button.set_visible(False)
        self.instructions_button.add_css_class("pill")
        self.instructions_button.connect("clicked", self.on_show_instructions, "status")
        self.status_content.append(self.instructions_button)
        
        self.status_box.append(self.status_page)
        self.stack.add_named(self.status_box, "status")

        # 2. Config Wizard
        self.wizard_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        wizard_header = Adw.HeaderBar()
        wizard_back = Gtk.Button.new_from_icon_name("go-previous-symbolic")
        wizard_back.connect("clicked", lambda x: self.stack.set_visible_child_name("status"))
        wizard_header.pack_start(wizard_back)
        self.wizard_box.append(wizard_header)
        
        self.wizard = ConfigWizard()
        self.wizard.set_margin_top(24)
        self.wizard.set_margin_bottom(24)
        self.wizard.set_margin_start(24)
        self.wizard.set_margin_end(24)
        self.wizard.set_vexpand(True)
        self.wizard.launch_button.connect("clicked", self.on_launch_clicked)
        self.wizard_box.append(self.wizard)
        self.stack.add_named(self.wizard_box, "wizard")

        # 3. VM View (WebView + Logs)
        self.vm_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.vm_box.set_vexpand(True)
        self.vm_box.set_hexpand(True)
        
        self.vm_header = Adw.HeaderBar()
        vm_back = Gtk.Button.new_from_icon_name("go-previous-symbolic")
        vm_back.connect("clicked", lambda x: self.stack.set_visible_child_name("status"))
        self.vm_header.pack_start(vm_back)

        self.view_stack = Adw.ViewStack()
        self.view_stack.set_vexpand(True)
        self.view_stack.set_hexpand(True)
        
        view_switcher = Adw.ViewSwitcherTitle()
        view_switcher.set_stack(self.view_stack)
        self.vm_header.set_title_widget(view_switcher)

        # Power Controls
        self.restart_btn = Gtk.Button.new_from_icon_name("system-reboot-symbolic")
        self.restart_btn.set_tooltip_text("Restart VM")
        self.restart_btn.connect("clicked", self.on_restart_clicked)
        self.vm_header.pack_end(self.restart_btn)

        self.power_btn = Gtk.Button.new_from_icon_name("system-shutdown-symbolic")
        self.power_btn.set_tooltip_text("Power Off VM")
        self.power_btn.add_css_class("destructive-action")
        self.power_btn.connect("clicked", self.on_power_off_clicked)
        self.vm_header.pack_end(self.power_btn)

        self.reload_btn = Gtk.Button.new_from_icon_name("view-refresh-symbolic")
        self.reload_btn.set_tooltip_text("Reload Display")
        self.reload_btn.connect("clicked", self.on_reload_clicked)
        self.vm_header.pack_end(self.reload_btn)
        
        # Help button in VM screen
        vm_help_btn = Gtk.Button.new_from_icon_name("help-about-symbolic")
        vm_help_btn.set_tooltip_text("Instructions")
        vm_help_btn.connect("clicked", self.on_show_instructions, "vm")
        self.vm_header.pack_end(vm_help_btn)

        self.vm_box.append(self.vm_header)

        if WEBKIT_AVAILABLE:
            self.web_view = WebKit.WebView()
            self.web_view.set_vexpand(True)
            self.web_view.set_hexpand(True)
            page = self.view_stack.add_titled(self.web_view, "video", "Display")
            page.set_icon_name("video-display-symbolic")
        else:
            self.fallback_label = Gtk.Label(label="WebKit not available. Please install gir1.2-webkit-6.0.")
            self.fallback_label.set_vexpand(True)
            page = self.view_stack.add_titled(self.fallback_label, "video", "Display")
            page.set_icon_name("video-display-symbolic")

        scrolled = Gtk.ScrolledWindow()
        scrolled.set_vexpand(True)
        scrolled.set_hexpand(True)
        self.logs_view = Gtk.TextView()
        self.logs_view.set_editable(False)
        self.logs_view.set_cursor_visible(False)
        self.logs_view.set_margin_top(12)
        self.logs_view.set_margin_bottom(12)
        self.logs_view.set_margin_start(12)
        self.logs_view.set_margin_end(12)
        self.logs_view.add_css_class("monospace")
        scrolled.set_child(self.logs_view)
        page = self.view_stack.add_titled(scrolled, "logs", "Logs")
        page.set_icon_name("utilities-terminal-symbolic")

        self.vm_box.append(self.view_stack)
        self.stack.add_named(self.vm_box, "vm")

        # 4. Instructions & Legal Page
        self.instr_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.instr_box.set_vexpand(True)
        
        instr_header = Adw.HeaderBar()
        instr_back = Gtk.Button.new_from_icon_name("go-previous-symbolic")
        instr_back.connect("clicked", self.on_instructions_back)
        instr_header.pack_start(instr_back)
        self.instr_box.append(instr_header)

        instr_scrolled = Gtk.ScrolledWindow()
        instr_scrolled.set_vexpand(True)
        
        instr_content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=24)
        instr_content.set_margin_top(32)
        instr_content.set_margin_bottom(32)
        instr_content.set_margin_start(32)
        instr_content.set_margin_end(32)
        instr_scrolled.set_child(instr_content)

        # Legal Warning
        legal_group = Adw.PreferencesGroup(title="Legal Warning")
        legal_row = Adw.ActionRow(subtitle="The macOS EULA states that you should not run macOS on non-Apple hardware. By using this application, you acknowledge that you are doing so at your own risk and responsibility.")
        legal_row.add_css_class("warning")
        legal_group.add(legal_row)
        instr_content.append(legal_group)

        # Instructions
        steps_group = Adw.PreferencesGroup(title="Crucial: How to install macOS")
        steps = [
            "1. Start the VM and wait for the recovery screen.",
            "2. Choose 'Disk Utility' and select the 'Apple Inc. VirtIO Block Media' disk.",
            "3. Click 'Erase', choose 'APFS' format, and give it any name.",
            "4. Close Disk Utility and select 'Reinstall macOS'.",
            "5. Select the disk you just formatted to proceed.",
            "6. During setup, skip Apple ID and Migration Assistant to finish quickly."
        ]
        for step in steps:
            steps_group.add(Adw.ActionRow(title=step))
        instr_content.append(steps_group)

        self.instr_box.append(instr_scrolled)
        self.stack.add_named(self.instr_box, "instructions")

    def on_show_instructions(self, button, from_page):
        self.previous_page = from_page
        self.stack.set_visible_child_name("instructions")

    def on_instructions_back(self, button):
        self.stack.set_visible_child_name(self.previous_page)

    def check_dependencies(self):
        def check_task():
            status = self.check_deps_uc.execute()
            GLib.idle_add(self.update_ui_with_status, status)
        threading.Thread(target=check_task, daemon=True).start()

    def update_ui_with_status(self, status):
        self.spinner.stop()
        self.spinner.set_visible(False)
        if status.is_ready:
            self.instructions_button.set_visible(True)
            self.action_button_box.set_visible(True)
            
            # Obtener y listar VMs existentes (nuevas y legacy)
            # Retrieve and list existing VMs (both new and legacy)
            vms = self.docker_adapter.list_existing_vms()
            
            # Limpiar filas anteriores de la lista
            # Clear previous rows from the list box
            while True:
                row = self.vm_list_box.get_first_child()
                if not row:
                    break
                self.vm_list_box.remove(row)
                
            if vms:
                self.status_page.set_title("Select Virtual Machine / Selecciona Máquina Virtual")
                self.status_page.set_description("An existing macOS instance was detected. PLEASE check instructions if this is your first time.")
                self.status_page.set_icon_name("drive-harddisk-symbolic")
                
                # Rellenar lista con las VMs detectadas
                # Populate the list with detected VMs
                for vm in vms:
                    action_row = Adw.ActionRow(title=vm['name'])
                    action_row.set_subtitle(f"Image: {vm['image']} | {vm['status']}")
                    
                    # Icono del botón según si está corriendo o no
                    # Button icon based on whether it is running
                    is_running = vm['state'] == "running"
                    icon_name = "media-playback-stop-symbolic" if is_running else "media-playback-start-symbolic"
                    icon = Gtk.Image.new_from_icon_name(icon_name)
                    
                    btn = Gtk.Button()
                    btn.set_child(icon)
                    btn.set_valign(Gtk.Align.CENTER)
                    btn.add_css_class("flat")
                    
                    if is_running:
                        btn.add_css_class("destructive-action")
                        btn.set_tooltip_text("Stop VM / Detener VM")
                        btn.connect("clicked", self.on_stop_vm_clicked, vm)
                    else:
                        btn.add_css_class("suggested-action")
                        btn.set_tooltip_text("Start VM / Arrancar VM")
                        btn.connect("clicked", self.on_start_vm_clicked, vm)
                        
                    action_row.add_suffix(btn)
                    
                    # Botón para eliminar la VM
                    # Button to delete the VM
                    delete_icon = Gtk.Image.new_from_icon_name("user-trash-symbolic")
                    delete_btn = Gtk.Button()
                    delete_btn.set_child(delete_icon)
                    delete_btn.set_valign(Gtk.Align.CENTER)
                    delete_btn.add_css_class("flat")
                    delete_btn.add_css_class("destructive-action")
                    delete_btn.set_tooltip_text("Delete VM / Eliminar VM")
                    delete_btn.connect("clicked", self.on_delete_vm_clicked, vm)
                    action_row.add_suffix(delete_btn)
                    
                    self.vm_list_box.append(action_row)
                
                self.vm_list_group.set_visible(True)
                
                # Habilitar Reconfiguración si tenemos archivo compose local
                # Enable Reconfiguration if we have a local compose file
                installed = self.docker_adapter.is_vm_installed()
                self.setup_new_button.set_visible(True)
                if installed:
                    self.reconfigure_button.set_visible(True)
                else:
                    self.reconfigure_button.set_visible(False)
            else:
                self.status_page.set_title("System Ready")
                self.status_page.set_description("All dependencies are met. You MUST read the instructions before starting.")
                self.status_page.set_icon_name("object-select-symbolic")
                
                self.vm_list_group.set_visible(False)
                self.setup_new_button.set_visible(True)
                self.reconfigure_button.set_visible(False)
        else:
            self.status_page.set_title("Missing Dependencies")
            self.status_page.set_icon_name("dialog-error-symbolic")
            self.vm_list_group.set_visible(False)
            self.instructions_button.set_visible(False)
            self.action_button_box.set_visible(False)
            
            missing = []
            if not status.docker_installed: missing.append("Docker Engine")
            if not status.compose_installed: missing.append("Docker Compose")
            if not status.docker_running: missing.append("Docker Service (daemon)")
            if not status.kvm_enabled: missing.append("KVM Support (/dev/kvm access)")
            if not status.qemu_installed: missing.append("QEMU Emulator")
            
            desc = "Please install or fix: " + ", ".join(missing)
            self.status_page.set_description(desc)
        return False

    def on_setup_new_clicked(self, button):
        # Reset wizard fields to recommended defaults
        # Restablecer los campos del asistente a los valores recomendados por defecto
        self.wizard.version_row.set_selected(0)
        self.wizard.ram_spin.set_value(8)
        self.wizard.cpu_spin.set_value(4)
        self.wizard.disk_spin.set_value(128)
        self.stack.set_visible_child_name("wizard")

    def on_reconfigure_clicked(self, button):
        # Load the configuration of the existing compose VM
        # Cargar la configuración de la VM de compose existente
        existing_config = self.docker_adapter.get_existing_config()
        if existing_config:
            version_list = ["sequoia", "sonoma", "ventura", "monterey", "big-sur", "catalina"]
            if existing_config.version in version_list:
                self.wizard.version_row.set_selected(version_list.index(existing_config.version))
            self.wizard.ram_spin.set_value(existing_config.ram_gb)
            self.wizard.cpu_spin.set_value(existing_config.cpu_cores)
            self.wizard.disk_spin.set_value(existing_config.storage_gb)
        self.stack.set_visible_child_name("wizard")

    def on_delete_vm_clicked(self, button, vm):
        # Show native Libadwaita message dialog for VM deletion confirmation
        # Mostrar diálogo de mensaje nativo de Libadwaita para confirmación de eliminación de VM
        dialog = Adw.MessageDialog(
            transient_for=self,
            heading="Delete VM / Eliminar VM",
            body=f"Are you sure you want to delete {vm['name']}? This action is irreversible.\n¿Estás seguro de que deseas eliminar {vm['name']}? Esta acción es irreversible."
        )
        dialog.add_response("cancel", "Cancel / Cancelar")
        dialog.add_response("delete", "Delete / Eliminar")
        dialog.set_response_appearance("delete", Adw.ResponseAppearance.DESTRUCTIVE)
        dialog.set_default_response("cancel")
        dialog.set_close_response("cancel")
        
        def on_response(dialog, response):
            if response == "delete":
                self.perform_delete_vm(vm)
                
        dialog.connect("response", on_response)
        dialog.present()

    def perform_delete_vm(self, vm):
        # Detener primero si está corriendo
        # Stop first if running
        if vm['state'] == "running":
            if vm['is_legacy']:
                self.docker_adapter.stop_legacy_vm(vm['name'])
            else:
                self.docker_adapter.stop_vm()
                
        # Eliminar VM
        # Delete VM
        success = self.docker_adapter.delete_vm(vm['name'], vm['is_legacy'])
        if success:
            self.overlay.add_toast(Adw.Toast(title=f"VM {vm['name']} Deleted / Eliminada"))
            self.check_dependencies() # Refresh list
        else:
            self.overlay.add_toast(Adw.Toast(title=f"Error deleting VM / Error al eliminar VM"))

    def on_start_vm_clicked(self, button, vm):
        self.current_vm_name = vm['name']
        self.current_vm_is_legacy = vm['is_legacy']
        
        if vm['name'] == "macboat-macos":
            # Si es la VM del compose nuevo, leemos su configuración
            # If it's the new compose VM, we read its configuration
            config = self.docker_adapter.get_existing_config()
            if config:
                self.launch_vm_by_config(config)
                return
                
        # Para legacy VMs, buscamos el puerto web mapeado al puerto 8006 dinámicamente
        # For legacy VMs, we dynamically inspect the host port mapped to 8006
        web_port = self.docker_adapter.get_container_web_port(vm['name'])
        self.launch_legacy_vm(vm['name'], web_port)

    def on_stop_vm_clicked(self, button, vm):
        # Parar la VM desde la fila de la lista
        # Stop the VM from the list row
        success = False
        if vm['is_legacy']:
            success = self.docker_adapter.stop_legacy_vm(vm['name'])
        else:
            success = self.docker_adapter.stop_vm()
            
        if success:
            self.overlay.add_toast(Adw.Toast(title=f"VM {vm['name']} Stopped / Detenida"))
            self.check_dependencies() # Refrescar lista

    def on_launch_clicked(self, button):
        version_list = ["sequoia", "sonoma", "ventura", "monterey", "big-sur", "catalina"]
        version = version_list[self.wizard.version_row.get_selected()]
        config = MacOSConfig(version=version, ram_gb=int(self.wizard.ram_spin.get_value()), 
                             cpu_cores=int(self.wizard.cpu_spin.get_value()), 
                             storage_gb=int(self.wizard.disk_spin.get_value()))
        if self.docker_adapter.generate_compose_file(config, "docker-compose.yml"):
            self.current_vm_name = "macboat-macos"
            self.current_vm_is_legacy = False
            self.launch_vm_by_config(config)

    def launch_vm_by_config(self, config):
        process = self.docker_adapter.run_compose("docker-compose.yml")
        if process:
            self.stack.set_visible_child_name("vm")
            if WEBKIT_AVAILABLE:
                self.web_view.load_uri(f"http://localhost:{config.web_port}")
            self.stream_logs(process)
            toast = Adw.Toast(title=f"Starting macOS... Access via http://localhost:{config.web_port}")
            toast.set_timeout(10)
            self.overlay.add_toast(toast)

    def launch_legacy_vm(self, container_name, web_port):
        process = self.docker_adapter.start_legacy_vm(container_name)
        if process:
            self.stack.set_visible_child_name("vm")
            if WEBKIT_AVAILABLE:
                self.web_view.load_uri(f"http://localhost:{web_port}")
            self.stream_logs(process)
            toast = Adw.Toast(title=f"Starting VM {container_name}... Access via http://localhost:{web_port}")
            toast.set_timeout(10)
            self.overlay.add_toast(toast)

    def on_power_off_clicked(self, button):
        success = False
        if hasattr(self, 'current_vm_is_legacy') and self.current_vm_is_legacy:
            success = self.docker_adapter.stop_legacy_vm(self.current_vm_name)
        else:
            success = self.docker_adapter.stop_vm()
            
        if success:
            self.stack.set_visible_child_name("status")
            self.overlay.add_toast(Adw.Toast(title="VM Stopped / Detenida"))
            self.check_dependencies()

    def on_restart_clicked(self, button):
        success = False
        if hasattr(self, 'current_vm_is_legacy') and self.current_vm_is_legacy:
            success = self.docker_adapter.restart_legacy_vm(self.current_vm_name)
        else:
            success = self.docker_adapter.restart_vm()
            
        if success:
            self.overlay.add_toast(Adw.Toast(title="VM Restarting... / Reiniciando VM..."))

    def on_reload_clicked(self, button):
        if WEBKIT_AVAILABLE:
            self.web_view.reload()
            self.overlay.add_toast(Adw.Toast(title="Reloading display..."))

    def stream_logs(self, process):
        def log_reader():
            while True:
                line = process.stdout.readline()
                if not line: break
                GLib.idle_add(self.append_log, line)
            process.stdout.close()
        threading.Thread(target=log_reader, daemon=True).start()

    def append_log(self, text):
        buffer = self.logs_view.get_buffer()
        buffer.insert(buffer.get_end_iter(), text)
        adj = self.logs_view.get_vadjustment()
        GLib.idle_add(lambda: adj.set_value(adj.get_upper() - adj.get_page_size()))
        return False

