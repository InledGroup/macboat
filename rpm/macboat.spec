Name:           macboat
Version:        2.0.7
Release:        1%{?dist}
Summary:        Native Python GTK4 application to manage macOS VMs using Docker
License:        MIT
URL:            https://inled.es
Source0:        %{name}-%{version}.tar.gz

%define debug_package %{nil}

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
%{_datadir}/applications/es.inled.Macboat.desktop
%{_datadir}/icons/hicolor/512x512/apps/es.inled.Macboat.png

%post
if [ ! -f /etc/yum.repos.d/inled.repo ]; then
    cat <<EOF > /etc/yum.repos.d/inled.repo
[inled]
name=Inled Repository
baseurl=https://apt.inled.es/rpm/
enabled=1
gpgcheck=0
EOF
    echo "Added Inled repository to /etc/yum.repos.d/inled.repo"
fi

%changelog
* Thu Jun 18 2026 InledGroup <hi@inled.es> - 0.1.0-1
- Initial release
