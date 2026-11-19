#!/usr/bin/env bash
set -e

if [[ $EUID -ne 0 ]]; then
  echo "Run this installer with sudo: sudo ./install.sh"
  exit 1
fi

read -rp "Server domain or hostname [neclave.local]: " DOMAIN
DOMAIN=${DOMAIN:-neclave.local}

while true; do
  read -rp "Application port [3000]: " PORT
  PORT=${PORT:-3000}
  if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
    echo "Choose a port between 1024 and 65535."
  elif ss -ltn "sport = :$PORT" | grep -q LISTEN; then
    echo "Port $PORT is already in use. Choose another port."
  else
    break
  fi
done

if ! command -v node >/dev/null; then
  echo "Node.js is missing. Install Node.js 18+ before continuing."
  exit 1
fi

apt-get update
apt-get install -y apache2
npm install

sed "s/__DOMAIN__/$DOMAIN/g; s/__PORT__/$PORT/g" apache-offgridneclave.conf.template > "/etc/apache2/sites-available/offgridneclave.conf"

a2enmod proxy proxy_http proxy_wstunnel rewrite
apache2ctl configtest

a2ensite offgridneclave.conf
systemctl reload apache2

cat > /etc/systemd/system/offgridneclave.service <<EOF
[Unit]
Description=OFFGRID NECLAVE multiplayer game
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/env node server.js $PORT
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now offgridneclave.service

echo "Installed OFFGRID NECLAVE on port $PORT behind Apache2 for $DOMAIN"
echo "Open http://$DOMAIN/"
