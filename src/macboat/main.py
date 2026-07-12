#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Punto de entrada de la aplicación.
Application entry point.
"""
import sys
import os

# Fix WebKitGTK rendering/loading issues on modern Linux systems (especially Arch Linux with NVIDIA/Wayland)
# Corregir problemas de renderizado/carga de WebKitGTK en sistemas Linux modernos (especialmente Arch Linux con NVIDIA/Wayland)
os.environ['WEBKIT_DISABLE_DMABUF_RENDERER'] = '1'

# Add the package directory to sys.path if installed
pkg_dir = os.path.join(os.path.dirname(__file__), '..', 'share', 'macboat')
if os.path.exists(pkg_dir):
    sys.path.insert(0, pkg_dir)

import gi
gi.require_version('Gtk', '4.0')
gi.require_version('Adw', '1')
from gi.repository import Gtk, Adw, Gio

from macboat.presentation.main_window import MainWindow

class MacboatApp(Adw.Application):
    def __init__(self):
        super().__init__(application_id='es.inled.Macboat',
                         flags=Gio.ApplicationFlags.FLAGS_NONE)

    def do_activate(self):
        win = self.props.active_window
        if not win:
            win = MainWindow(application=self)
        win.present()

def main():
    app = MacboatApp()
    return app.run(sys.argv)

if __name__ == '__main__':
    sys.exit(main())
