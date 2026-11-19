#!/usr/bin/env bash
set -e

if [[ $EUID -ne 0 ]]; then
  echo "Run this installer with sudo: sudo ./install.sh"
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

update_existing_installation() {
  echo "Updating OFFGRIDENCLAVE..."

  if [[ -d .git ]]; then
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "The server has local tracked or untracked changes."
      echo "Commit or discard them before running the updater."
      echo "To discard server-side changes: git reset --hard HEAD && git clean -fd"
      exit 1
    fi

    git fetch --prune origin
    git pull --ff-only origin main
  else
    echo "This directory is not a Git repository, so it cannot be updated."
    exit 1
  fi

  if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
    if (( NODE_MAJOR < 18)); then
      echo "Node.js $NODE_MAJOR is too old. Run: sudo ./install.sh"
      exit 1
    fi
  else
    echo "Node.js is missing. Run: sudo ./install.sh"
    exit 1
  fi

  npm install
  systemctl daemon-reload
  systemctl restart offgridenclave.service
  systemctl reload apache2 2>/dev/null || true

  echo "OFFGRIDENCLAVE has been updated and restarted."
  echo "Commit: $(git rev-parse --short HEAD)"
}

if [[ "${1:-}" == "--update" ]] || [[ "${1:-}" == "update" ]]; then
  update_existing_installation
  exit 0
fi

if systemctl is-active --quiet offgridenclave.service 2>/dev/null; then
  read -rp "OFFGRIDENCLAVE is already installed. Update it instead? [Y/n]: " UPDATE
  UPDATE=${UPDATE:-Y}
  if [[ "$UPDATE" =~ ^[Yy]$ ]]; then
    update_existing_installation
    exit 0
  fi
fi

read -rp "Server domain or hostname [offgridenclave.local]: " DOMAIN
DOMAIN=${DOMAIN:-offgridenclave.local}

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

sed "s/__DOMAIN__/$DOMAIN/g; s/__PORT__/$PORT/g" apache-offgridenclave.conf.template > "/etc/apache2/sites-available/offgridenclave.conf"

a2enmod proxy proxy_http proxy_wstunnel rewrite
apache2ctl configtest

a2ensite offgridenclave.conf
systemctl reload apache2

cat > /etc/systemd/system/offgridenclave.service <<EOF
[Unit]
Description=OFFGRIDENCLAVE multiplayer game
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
systemctl enable --now offgridenclave.service

echo "Installed OFFGRIDENCLAVE on port $PORT behind Apache2 for $DOMAIN"
echo "Open http://$DOMAIN/"
