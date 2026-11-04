# Publicar en AUR (`remote-controllers-bin`)

AUR es el "repositorio" oficial de paquetes de la comunidad. No permite
`pacman -S` directo: hace falta un helper (`yay`, `paru`…) o compilar el
PKGBUILD a mano. Para que `pacman -S` funcione sin helper hay que añadir tu
propio repositorio (ver [`../archlinux/README.md`](../archlinux/README.md)).

## Cómo lo instala el usuario

```bash
yay -S remote-controllers-bin
# o
paru -S remote-controllers-bin
```

## Cómo publicarlo (mantenedor)

Requisitos: cuenta en <https://aur.archlinux.org> con tu clave SSH pública
registrada, `base-devel` y `git`.

```bash
# 1) Prepara PKGBUILD + .SRCINFO (y calcula las sumas descargando el AppImage)
bash distros/aur/publish-aur.sh

# 2) Revisa el diff y publica
bash distros/aur/publish-aur.sh --push
```

El script:

1. Copia `remotecontrollers.desktop` y `remotecontrollers.sh` desde
   `distros/common/`, y `remotecontrollers.install` desde `distros/archlinux/`
   (fuente única).
2. Sincroniza `pkgver` con `package.json`.
3. Ejecuta `updpkgsums` para que `sha256sums` sea real (AUR no admite `SKIP`).
4. Genera `.SRCINFO` con `makepkg --printsrcinfo`.
5. Con `--push`, clona `ssh://aur@aur.archlinux.org/remote-controllers-bin.git`,
   copia los archivos y hace commit + push.

## Notas

- El paquete descarga el AppImage de la **última release** de GitHub y lo
  desempaqueta (igual que el paquete de `distros/archlinux`, sin FUSE).
- `provides=('remotecontrollers' 'remote-controller')` permite que también
  funcione `yay -S remote-controller`.
- Las dependencias de runtime van en `depends`, así que el helper de AUR las
  instala automáticamente.
- Si cambias de versión, vuelve a ejecutar `publish-aur.sh` (actualiza `pkgver`,
  sumas y `.SRCINFO`).
