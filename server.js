const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { transports: ['websocket', 'polling'] });
const PORT = Number(process.env.PORT || process.argv[2] || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.OFFGRIDENCLAVE_DATA_DIR || path.join(__dirname, '..', 'offgridenclave-data');
const DATA_FILE = process.env.LEADERBOARD_FILE || path.join(DATA_DIR, 'leaderboard.json');

app.use(express.static(path.join(__dirname, 'public')));

function loadScores() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveScores(scores) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2));
}

let leaderboard = loadScores();
const players = new Map();
const world = {
  zone: { x: 500, y: 500, radius: 430, targetRadius: 430 },
  resources: [],
  weather: 'Clear',
  aiEvent: null
};

for (let i = 0; i < 55; i++) {
  world.resources.push({ id: `r${i}`, x: 90 + Math.random() * 820, y: 90 + Math.random() * 820, kind: ['scrap', 'medkit', 'water'][i % 3], taken: false });
}

function publicWorld() {
  return {
    zone: world.zone,
    resources: world.resources.filter(r => !r.taken),
    weather: world.weather,
    aiEvent: world.aiEvent,
    players: [...players.values()].map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y, health: p.health, kills: p.kills, score: p.score, ai: p.ai }))
  };
}

function recordScore(player) {
  const previous = leaderboard.find(s => s.name === player.name);
  if (previous) {
    previous.score = Math.max(previous.score, player.score);
    previous.bestKills = Math.max(previous.bestKills || 0, player.kills);
  } else {
    leaderboard.push({ name: player.name, score: player.score, bestKills: player.kills });
  }
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 100);
  saveScores(leaderboard);
}

io.on('connection', socket => {
  const player = {
    id: socket.id,
    name: `Drifter-${socket.id.slice(-4).toUpperCase()}`,
    x: 500,
    y: 500,
    health: 100,
    kills: 0,
    score: 0,
    ai: false,
    energy: 100,
    alive: true
  };
  players.set(socket.id, player);
  socket.emit('joined', { id: socket.id, player, leaderboard, world: publicWorld() });
  socket.broadcast.emit('event', { text: `${player.name} entered the enclave.` });
  io.emit('world', publicWorld());

  socket.on('setName', name => {
    const clean = String(name || '').trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 16);
    if (clean) player.name = clean;
  });

  socket.on('move', move => {
    if (!player.alive) return;
    const dx = Number(move.dx) || 0;
    const dy = Number(move.dy) || 0;
    const speed = move.sprint && player.energy > 0 ? 7 : 4.2;
    const nextX = Math.max(20, Math.min(980, player.x + dx * speed));
    const nextY = Math.max(20, Math.min(980, player.y + dy * speed));
    player.x = nextX;
    player.y = nextY;
    if (move.sprint) player.energy = Math.max(0, player.energy - 0.8);
    else player.energy = Math.min(100, player.energy + 0.35);
  });

  socket.on('collect', resourceId => {
    const resource = world.resources.find(r => r.id === resourceId && !r.taken);
    if (!resource) return;
    const distance = Math.hypot(resource.x - player.x, resource.y - player.y);
    if (distance > 70) return;
    resource.taken = true;
    if (resource.kind === 'medkit') player.health = Math.min(100, player.health + 25);
    if (resource.kind === 'water') player.energy = Math.min(100, player.energy + 30);
    player.score += resource.kind === 'scrap' ? 75 : 50;
    io.emit('world', publicWorld());
  });

  socket.on('attack', () => {
    if (!player.alive) return;
    let target = null;
    let nearest = 58;
    for (const p of players.values()) {
      if (p.id === player.id || !p.alive) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < nearest) { nearest = d; target = p; }
    }
    if (target) {
      target.health -= 18;
      if (target.health <= 0) {
        target.alive = false;
        target.health = 0;
        player.kills++;
        player.score += 500;
        recordScore(target);
        io.emit('event', { text: `${player.name} eliminated ${target.name}.` });
        setTimeout(() => {
          target.alive = true;
          target.health = 100;
          target.x = 500 + (Math.random() - 0.5) * 300;
          target.y = 500 + (Math.random() - 0.5) * 300;
        }, 5000);
      }
      io.emit('world', publicWorld());
    }
  });

  socket.on('disconnect', () => {
    if (player.score > 0) recordScore(player);
    players.delete(socket.id);
    io.emit('world', publicWorld());
  });
});

setInterval(() => {
  // Respawn collected resources and shrink the storm zone.
  for (const resource of world.resources) {
    if (resource.taken && Math.random() < 0.02) {
      resource.taken = false;
      resource.x = 90 + Math.random() * 820;
      resource.y = 90 + Math.random() * 820;
    }
  }
  world.zone.radius = Math.max(120, world.zone.radius - 0.09);
  if (Math.random() < 0.002) {
    const weather = ['Clear', 'Ashfall', 'Heavy Rain', 'Ion Storm'][Math.floor(Math.random() * 4)];
    world.weather = weather;
    io.emit('event', { text: `Weather shifted: ${weather}.` });
  }
  for (const player of players.values()) {
    if (!player.alive) continue;
    const outside = Math.hypot(player.x - world.zone.x, player.y - world.zone.y) > world.zone.radius;
    if (outside) player.health = Math.max(0, player.health - 0.35);
  }
  io.emit('world', publicWorld());
}, 100);

// Safe in-game AI enclave event: it becomes a game character, never controls hardware or processes.
setInterval(() => {
  if (world.aiEvent || players.size < 2) return;
  if (Math.random() > 0.025) return;
  world.aiEvent = { name: 'NEXUS', objective: 'Phase out', expires: Date.now() + 30000, defeated: false };
  io.emit('event', { text: 'NEXUS has awakened: first AI to dominate the enclave wins the rare "Phase Out" badge.' });
  setTimeout(() => {
    if (world.aiEvent) world.aiEvent = null;
  }, 30000);
}, 5000);

app.get('/api/leaderboard', (req, res) => res.json(loadScores()));
app.get('/health', (req, res) => res.json({ ok: true, players: players.size, uptime: process.uptime() }));

server.listen(PORT, HOST, () => {
  console.log(`OFFGRIDENCLAVE listening on http://${HOST}:${PORT}`);
});
