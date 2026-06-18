macboat_sources = [
  'main.py',
  'domain/macos_config.py',
  'domain/system_status.py',
  'ports/system_repository.py',
  'ports/docker_repository.py',
  'application/check_system_dependencies.py',
  'infrastructure/linux_system_adapter.py',
  'infrastructure/docker_compose_adapter.py',
  'presentation/main_window.py',
]

install_data(macboat_sources, install_dir: join_paths(get_option('datadir'), meson.project_name(), 'macboat'))

configure_file(
  input: 'main.py',
  output: 'macboat',
  configuration: conf,
  install_dir: get_option('bindir')
)
