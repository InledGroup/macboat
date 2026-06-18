#!/usr/bin/env python3

import os
import subprocess

def run():
    # Update desktop database
    if not os.environ.get('DESTDIR'):
        print('Updating desktop database...')
        subprocess.call(['update-desktop-database', '-q', os.path.join(os.sep, 'usr', 'share', 'applications')])
        print('Updating icon cache...')
        subprocess.call(['gtk4-update-icon-cache', '-q', '-t', os.path.join(os.sep, 'usr', 'share', 'icons', 'hicolor')])

if __name__ == '__main__':
    run()
