#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Wizard for macOS configuration.
"""
import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Gtk, Adw

class ConfigWizard(Adw.Bin):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        self.content_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.set_child(self.content_box)
        
        # Title
        title = Gtk.Label(label="Configure macOS VM")
        title.add_css_class("title-1")
        self.content_box.append(title)
        
        # Settings group
        group = Adw.PreferencesGroup()
        self.content_box.append(group)
        
        # Version
        self.version_row = Adw.ComboRow(title="macOS Version")
        self.version_row.set_model(Gtk.StringList.new(["sequoia", "sonoma", "ventura", "monterey", "big-sur", "catalina"]))
        group.add(self.version_row)
        
        # RAM
        self.ram_row = Adw.ActionRow(title="RAM (GB)")
        self.ram_spin = Gtk.SpinButton.new_with_range(4, 64, 2)
        self.ram_spin.set_value(8)
        self.ram_spin.set_valign(Gtk.Align.CENTER)
        self.ram_row.add_suffix(self.ram_spin)
        group.add(self.ram_row)
        
        # CPU Cores
        self.cpu_row = Adw.ActionRow(title="CPU Cores")
        self.cpu_spin = Gtk.SpinButton.new_with_range(2, 16, 1)
        self.cpu_spin.set_value(4)
        self.cpu_spin.set_valign(Gtk.Align.CENTER)
        self.cpu_row.add_suffix(self.cpu_spin)
        group.add(self.cpu_row)

        # Disk Size
        self.disk_row = Adw.ActionRow(title="Disk Size (GB)")
        self.disk_spin = Gtk.SpinButton.new_with_range(64, 2048, 32)
        self.disk_spin.set_value(128)
        self.disk_spin.set_valign(Gtk.Align.CENTER)
        self.disk_row.add_suffix(self.disk_spin)
        group.add(self.disk_row)

        # Disk Passthrough Row / Fila de Paso de Discos
        self.disk_devices_row = Adw.EntryRow(title="Disk Passthrough / Paso de Discos (e.g. /dev/sdb, /dev/sdc1)")
        self.disk_select_btn = Gtk.Button.new_from_icon_name("view-list-symbolic")
        self.disk_select_btn.set_tooltip_text("Select Disks / Seleccionar Discos")
        self.disk_select_btn.set_valign(Gtk.Align.CENTER)
        self.disk_devices_row.add_suffix(self.disk_select_btn)
        group.add(self.disk_devices_row)

        # USB Passthrough Row / Fila de Paso de USB
        self.usb_devices_row = Adw.EntryRow(title="USB Passthrough / Paso de USB (e.g. 0x1234:0x5678, 0xabcd:0x0012)")
        self.usb_select_btn = Gtk.Button.new_from_icon_name("view-list-symbolic")
        self.usb_select_btn.set_tooltip_text("Select USB Devices / Seleccionar Dispositivos USB")
        self.usb_select_btn.set_valign(Gtk.Align.CENTER)
        self.usb_devices_row.add_suffix(self.usb_select_btn)
        group.add(self.usb_devices_row)

        # DHCP Switch Row / Fila de Switch para DHCP
        self.dhcp_row = Adw.SwitchRow(title="DHCP Mode (IP Acquisition) / Modo DHCP (Adquisición IP)")
        self.dhcp_row.set_active(False)
        group.add(self.dhcp_row)

        # DHCP Network Row / Fila de Nombre de Red VLAN para DHCP
        self.dhcp_network_row = Adw.EntryRow(title="VLAN Network Name / Nombre de Red VLAN")
        self.dhcp_network_row.set_text("vlan")
        self.dhcp_row.bind_property("active", self.dhcp_network_row, "visible", 0)
        group.add(self.dhcp_network_row)
        
        # Launch button
        self.launch_button = Gtk.Button(label="Launch VM")
        self.launch_button.add_css_class("suggested-action")
        self.launch_button.add_css_class("pill")
        self.launch_button.set_halign(Gtk.Align.CENTER)
        self.launch_button.set_margin_top(24)
        self.content_box.append(self.launch_button)
