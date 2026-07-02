# Arch Linux — Remote Controllers

Guía rápida. Documentación completa en el [README principal](../../README.md).

## Instalar

```bash
sudo tee -a /etc/pacman.conf < distros/archlinux/bjrsoftware.repo
sudo pacman -Sy
sudo pacman -S remotecontrollers-bin
```

## Publicar (mantenedor)

```bash
npm run dist:arch:release
```

Esto compila el `.pkg.tar.zst`, genera el índice pacman y sube todo al lago de datos en `public/remote-controller/releases/arch/x86_64/`.
