#!/usr/bin/env bash
echo "AVISO: publish-r2.sh está obsoleto. Usa publish-datalake.sh"
exec "$(dirname "$0")/publish-datalake.sh" "$@"
