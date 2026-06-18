# Install main entry point as a script in /usr/bin
configure_file(
  input: 'macboat/main.py',
  output: 'macboat',
  configuration: conf,
  install_dir: get_option('bindir')
)

# Install python modules to /usr/share/macboat/macboat/...
python_files = [
  'main.py',
  'domain/macos_config.py',
  'domain/system_status.py',
  'ports/system_repository.py',
  'ports/docker_repository.py',
  'application/check_system_dependencies.py',
  'infrastructure/linux_system_adapter.py',
  'infrastructure/docker_compose_adapter.py',
  'presentation/main_window.py',
  'presentation/config_wizard.py',
]

foreach f : python_files
  parts = f.split('/')
  if parts.length() == 1
    install_data('macboat' / f, install_dir: get_option('datadir') / meson.project_name() / 'macboat')
  else
    # Join all parts except the last one (the filename) to get the directory
    dir_parts = []
    foreach p : parts
      if p != parts[-1]
        dir_parts += [p]
      endif
    endforeach
    
    # Construct the installation directory path
    install_path = get_option('datadir') / meson.project_name() / 'macboat'
    foreach d : dir_parts
      install_path = install_path / d
    endforeach
    
    install_data('macboat' / f, install_dir: install_path)
  endif
endforeach
