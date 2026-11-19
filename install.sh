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

apt-get update
apt-get install -y curl ca-certificates

install_node() {
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  if (( NODE_MAJOR < 18)); then
    echo "Node.js $NODE_MAJOR is installed, but Node.js 18+ is required."
    install_node
  fi
else
  echo "Node.js is missing. Installing Node.js 18+..."
  install_node
fi

node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 18) { console.error('Node.js 18+ is required.'); process.exit(1); }"

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
