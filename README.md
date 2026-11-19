# OFFGRIDENCLAVE

A compact multiplayer browser survival game. Players gather resources, fight, survive a shrinking storm zone, and race for leaderboard glory.

## Requirements

- Linux server with Node.js 18+ and Apache2
- A modern browser

## Interactive install

```bash
chmod +x install.sh
sudo ./install.sh
```

The installer asks for a port and domain, checks that the port is available, installs dependencies, configures Apache2, and creates a systemd service.

To run manually:

```bash
npm install
PORT=3000 npm start
```

Open `http://localhost:3000`.

## Update the server

Use the installer updater to pull the latest Git commit, reinstall dependencies, and restart the game:

```bash
cd ~/offgridenclave
sudo ./install.sh --update
```

You can also run `sudo ./install.sh` and choose **Y** when prompted to update an existing installation.

If the update refuses because server files were changed locally, commit or discard those changes first:

```bash
git reset --hard HEAD
git clean -fd
sudo ./install.sh --update
```

`git reset --hard` permanently discards local tracked changes. `git clean -fd` removes untracked files.

Leaderboard scores are stored outside the Git repository at `/var/lib/offgridenclave/leaderboard.json`. This prevents leaderboard updates from blocking future installations or updates. To migrate existing scores manually:

```bash
sudo mkdir -p /var/lib/offgridenclave
sudo cp ~/offgridenclave/data/leaderboard.json /var/lib/offgridenclave/leaderboard.json 2>/dev/null || true
sudo chown -R jarvis:jarvis /var/lib/offgridenclave
sudo systemctl restart offgridenclave.service
```

## Apache reverse proxy

The installer enables `proxy`, `proxy_http`, `proxy_wstunnel`, `rewrite`, and writes a virtual host from `apache-offgridenclave.conf.template`.

