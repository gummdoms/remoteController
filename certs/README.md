# Certificados HTTPS locales

Coloca aquí los certificados para habilitar HTTPS en el servidor Express.

Archivos esperados por defecto:

- `server.key`
- `server.crt`

También puedes usar variables de entorno:

- `HTTPS_KEY_PATH`
- `HTTPS_CERT_PATH`
- `HTTP_PORT` (default `4800`)
- `HTTPS_PORT` (default `5443`)

## Ejemplo con mkcert (recomendado)

1. Instala `mkcert`.
2. En la raíz del proyecto ejecuta:

```powershell
mkcert -install
mkcert -key-file certs/server.key -cert-file certs/server.crt localhost 127.0.0.1 ::1 192.168.1.100
```

Cambia `192.168.1.100` por la IP local real del PC.

1. Inicia la app (`npm start`).
1. Abre desde el móvil: `https://TU_IP:5443`.

Si tu móvil no confía el certificado, instala la CA local de `mkcert` en el dispositivo para evitar bloqueo de micrófono.
