#!/bin/sh
# Gera a configuração S3 do SeaweedFS a partir das variáveis de ambiente,
# para que nenhuma chave fique gravada no repositório.
set -eu
: "${S3_ACCESS_KEY:?defina S3_ACCESS_KEY no .env}"
: "${S3_SECRET_KEY:?defina S3_SECRET_KEY no .env}"
mkdir -p /etc/seaweedfs
cat > /etc/seaweedfs/s3.json <<JSON
{
  "identities": [
    {
      "name": "mogi",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY}", "secretKey": "${S3_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    }
  ]
}
JSON
exec weed server -dir=/data -ip.bind=0.0.0.0 -master.volumeSizeLimitMB=1024 \
  -volume.max=0 -s3 -s3.port=8333 -s3.config=/etc/seaweedfs/s3.json
