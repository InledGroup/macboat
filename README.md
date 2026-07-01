
<h1 align="center">MacBoat<br/>

<div align="center">
<a href="https://github.com/InledGroup/macboat"><img src="macboat.png" title="Logo" style="max-width:100%;" width="128" /></a>
</div>
<div align="center">

[![Build]][build_url]
[![Version]][tag_url]
[![Size]][tag_url]
[![Package]][pkg_url]
[![Pulls]][hub_url]

</div></h1>

Use MacOS on Linux and Windows. No commands, full GUI setup.  
Choose your MacOS version and start the installation process with a simple GUI.

>[!WARNING]  
> Due to MacOS EULA, you are responsible and obligated to use MacOS only on official hardware.  

## Features ✨


 - Fully grafical setup
 - Easy configuration 
 - KVM acceleration
 - Web-based viewer
 - Automatic download
 - Disk passthrough
 - USB passthrough
 - Network passthrough

 ## Demo  
 ![Video](macboat-demo-fast.mp4)  
 
 ## Work in progress.  
 We are working on a full app integration like Winboat. For now, only runs MacOS with full desktop, no headless mode.

## FAQ 💬

### How do I use it?

  Very simple! These are the steps:
  
  - Start the container and connect to [port 8006](http://127.0.0.1:8006/) using your web browser.

  - Choose `Disk Utility` and then select the largest `Apple Inc. VirtIO Block Media` disk.

  - Click the `Erase` button to format the disk to APFS, and give it any name you like.

  - Close the current window and proceed the installation by clicking `Reinstall macOS`.
  
  - When prompted where you want to install it, select the disk you created previously.
 
  - After all files are copied, select your region, language, and keyboard settings.

  - When the `Migration Assistant` wants to transfer data, select `Not now` (bottom left).

  - On the `Apple ID` screen, select `Set Up Later` (bottom left) and then proceed using `Skip`.
  
  - On the `Create a Computer Account` screen, fill in a username and password and `Continue`.
 
  Enjoy your brand new machine, and don't forget to star this repo!

### How do I select the version of macOS?

You can select it on the setup process.

  Select from the values below:
  
  |   **Value** | **Version**    | **Name** |
  |-------------|----------------|------------------|
  | `15`        | macOS 15       | Sequoia          |
  | `14`        | macOS 14       | Sonoma           |
  | `13`        | macOS 13       | Ventura          |
  | `12`        | macOS 12       | Monterey         |
  | `11`        | macOS 11       | Big Sur          |



### Is this project legal?

  Yes, this project contains only open-source code and does not distribute any copyrighted material. Neither does it try to circumvent any copyright protection measures. So under all applicable laws, this project will be considered legal.

  However, by installing Apple's macOS, you must accept their end-user license agreement, which does not permit installation on non-official hardware. So only run this container on hardware sold by Apple, as any other use will be a violation of their terms and conditions.

 ## Acknowledgements 🙏

Special thanks to [seitenca](https://github.com/seitenca), this project would not exist without her invaluable work.

## Stars 🌟
[![Stars](https://starchart.cc/dockur/macos.svg?variant=adaptive)](https://starchart.cc/dockur/macos)

## Disclaimer ⚖️

*Only run this container on Apple hardware, any other use is not permitted by their EULA. The product names, logos, brands, and other trademarks referred to within this project are the property of their respective trademark holders. This project is not affiliated, sponsored, or endorsed by Apple Inc.*

[build_url]: https://github.com/dockur/macos/
[hub_url]: https://hub.docker.com/r/dockurr/macos/
[tag_url]: https://hub.docker.com/r/dockurr/macos/tags
[pkg_url]: https://github.com/dockur/macos/pkgs/container/macos

[Build]: https://github.com/dockur/macos/actions/workflows/build.yml/badge.svg
[Size]: https://img.shields.io/docker/image-size/dockurr/macos/latest?color=066da5&label=size
[Pulls]: https://img.shields.io/docker/pulls/dockurr/macos.svg?style=flat&label=pulls&logo=docker
[Version]: https://img.shields.io/docker/v/dockurr/macos/latest?arch=amd64&sort=semver&color=066da5
[Package]: https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fipitio.github.io%2Fbackage%2Fdockur%2Fmacos%2Fmacos.json&query=%24.downloads&logo=github&style=flat&color=066da5&label=pulls
