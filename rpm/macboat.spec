Name:           macboat
Version:        0.1.0
Release:        1%{?dist}
Summary:        Native Python GTK4 application to manage macOS VMs using Docker
License:        MIT
URL:            https://github.com/jaime/macos
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  meson
BuildRequires:  ninja-build
BuildRequires:  python3-devel
BuildRequires:  gtk4-devel
BuildRequires:  libadwaita-devel

Requires:       python3-gobject
Requires:       gtk4
Requires:       libadwaita
Requires:       webkitgtk6.0
Requires:       docker
Requires:       docker-compose

%description
Macboat is a desktop application that simplifies the process of
running macOS in a Docker container on Linux.

%prep
%autosetup

%build
%meson
%meson_build

%install
%meson_install

%files
%{_bindir}/macboat
%{_datadir}/macboat/
%{_datadir}/applications/io.github.jaime.Macboat.desktop
%{_datadir}/icons/hicolor/scalable/apps/io.github.jaime.Macboat.svg

%changelog
* Thu Jun 18 2026 Jaime <jaime@example.com> - 0.1.0-1
- Initial release
