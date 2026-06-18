desktop_file = i18n.merge_file(
  input: 'io.github.jaime.Macboat.desktop.in',
  output: 'io.github.jaime.Macboat.desktop',
  type: 'desktop',
  po_dir: '../po',
  install: true,
  install_dir: join_paths(get_option('datadir'), 'applications')
)

install_data('io.github.jaime.Macboat.svg',
  install_dir: join_paths(get_option('datadir'), 'icons/hicolor/scalable/apps')
)
