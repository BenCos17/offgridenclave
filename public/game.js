const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const keys={};let socket=null,myId=null,myPlayer=null,world={zone:{x:500,y:500,radius:430},resources:[],players:[],aiEvent:null};
addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

function draw(){
  ctx.clearRect(0,0,1000,1000);
  ctx.fillStyle='#30362a';ctx.fillRect(0,0,1000,1000);

  ctx.strokeStyle='#454d3d';ctx.lineWidth=2;
  for(let i=0;i<1000;i+=50){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,1000);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(1000,i);ctx.stroke();
  }

  ctx.fillStyle='#21251d';ctx.beginPath();ctx.arc(world.zone.x,world.zone.y,world.zone.radius,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#d4ff34';ctx.lineWidth=5;ctx.stroke();

  for(const r of world.resources||[]){
    ctx.fillStyle=r.kind==='medkit'?'#e7efdd':r.kind==='water'?'#83b9b5':'#c5c8b5';
    ctx.save();ctx.translate(r.x,r.y);ctx.rotate(.785);ctx.fillRect(-7,-7,14,14);ctx.restore();
  }

  for(const p of world.players||[]){
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle=p.id===myId?'#d4ff34':'#aeb6a4';
    ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(12,12);ctx.lineTo(-12,12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f2f4e9';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText(p.name,0,-22);
    ctx.fillStyle='#111';ctx.fillRect(-15,-34,30,3);ctx.fillStyle=p.health>35?'#d4ff34':'#ff6040';ctx.fillRect(-15,-34,30*Math.max(0,p.health)/100,3);
    ctx.restore();
  }

  myPlayer=(world.players||[]).find(p=>p.id===myId);
  if(myPlayer){
    document.getElementById('health').style.width=myPlayer.health+'%';
    document.getElementById('energy').style.width=(myPlayer.energy||100)+'%';
  }

  if(world.aiEvent){
    ctx.fillStyle='#d4ff34';ctx.textAlign='center';ctx.font='700 28px Oswald';
    ctx.fillText('NEXUS // '+world.aiEvent.objective,500,70);
  }
  requestAnimationFrame(draw);
}
draw();

function connect(){
  socket=io();socket.on('joined',data=>{myId=data.id;world=data.world;document.getElementById('join').classList.add('hidden');document.getElementById('status').textContent='SIGNAL ACTIVE'});
  socket.on('world',w=>world=w);socket.on('leaderboard',s=>renderScores(s));socket.on('event',e=>logEvent(e.text));
  const name=document.getElementById('name').value.trim();if(name)socket.emit('setName',name);
}
function renderScores(scores){document.getElementById('scores').innerHTML=(scores||[]).slice(0,8).map(s=>`<li>${escapeHtml(s.name)}<span>${s.score}</span></li>`).join('')||'<li>NO RECORDS</li>'}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function logEvent(text){const el=document.createElement('div');el.className='event';el.textContent=text;document.getElementById('eventLog').prepend(el);setTimeout(()=>el.remove(),9000)}
fetch('/api/leaderboard').then(r=>r.json()).then(renderScores);
document.getElementById('enter').onclick=()=>{const n=document.getElementById('name').value.trim();if(!n)return document.getElementById('name').focus();connect();};
addEventListener('keydown',e=>{if(!socket)return;const k=e.key.toLowerCase();if(k==='e')for(const r of world.resources||[]){if(Math.hypot(r.x-(myPlayer?.x||500),r.y-(myPlayer?.y||500))<70)socket.emit('collect',r.id)}if(k==='f')socket.emit('attack')});
setInterval(()=>{if(!socket)return;let dx=(keys.d?1:0)-(keys.a?1:0),dy=(keys.s?1:0)-(keys.w?1:0);if(dx||dy)socket.emit('move',{dx,dy,sprint:keys.shift})},30);
