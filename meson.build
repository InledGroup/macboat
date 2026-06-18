project('macboat',
  version: '2.0.1',
  meson_version: '>= 0.59.0',
  default_options: [ 'warning_level=2' ],
)

i18n = import('i18n')
python = import('python')

py_installation = python.find_installation('python3')

conf = configuration_data()
conf.set('PYTHON', py_installation.path())
conf.set('VERSION', meson.project_version())
conf.set('localedir', join_paths(get_option('prefix'), get_option('localedir')))
conf.set('pkgdatadir', join_paths(get_option('prefix'), get_option('datadir'), meson.project_name()))

subdir('data')
subdir('src')

meson.add_install_script('build-aux/meson_post_install.py')
