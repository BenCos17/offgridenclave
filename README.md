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

## Apache reverse proxy

The installer enables `proxy`, `proxy_http`, `proxy_wstunnel`, `rewrite`, and writes a virtual host from `apache-offgridenclave.conf.template`.

