#!/usr/bin/env bash
echo "AVISO: upload-r2.sh está obsoleto. Usa upload-datalake.sh"
exec "$(dirname "$0")/upload-datalake.sh" "$@"
