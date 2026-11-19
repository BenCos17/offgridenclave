const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const keys={};let socket=null,myId=null,myPlayer=null,world={zone:{x:500,y:500,radius:430},resources:[],players:[],walls:[],structures:[],aiEvent:null};
addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

function drawFloor(){
  ctx.fillStyle='#171c17';ctx.fillRect(0,0,1000,1000);
  ctx.save();ctx.translate(500,500);ctx.rotate(-0.018);ctx.translate(-500,-500);
  ctx.fillStyle='#252d23';ctx.fillRect(40,40,920,920);

  for(let y=50;y<950;y+=40)for(let x=50;x<950;x+=40){
    ctx.fillStyle=((x+y)/40)%2?'#293126':'#252c22';ctx.fillRect(x,y,38,38);
    ctx.strokeStyle='#353e30';ctx.lineWidth=1;ctx.strokeRect(x,y,38,38);
  }

  for(const room of world.structures||[]){
    ctx.fillStyle=room.floor||'#30382b';ctx.fillRect(room.x,room.y,room.w,room.h);
    ctx.fillStyle='rgba(255,255,255,.025)';ctx.fillRect(room.x,room.y,room.w,4);
    ctx.strokeStyle='rgba(180,190,160,.28)';ctx.lineWidth=2;ctx.strokeRect(room.x+6,room.y+6,room.w-12,room.h-12);
    ctx.fillStyle='rgba(210,220,195,.42)';ctx.font='700 12px Oswald';ctx.textAlign='center';ctx.fillText(room.name,room.x+room.w/2,room.y+21);
  }

  ctx.restore();
}

function drawWall(w){
  const height=Math.max(w.w,w.h)>60?24:18;
  ctx.fillStyle='rgba(0,0,0,.48)';ctx.fillRect(w.x+12,w.y+14,w.w,w.h);

  ctx.fillStyle='#4e5947';ctx.fillRect(w.x,w.y-height,w.w,w.h);
  ctx.fillStyle='#707d66';ctx.fillRect(w.x,w.y-height,w.w,Math.min(w.h,7));
  ctx.fillStyle='#89967b';ctx.fillRect(w.x,w.y-height,w.w,4);
  ctx.fillStyle='#394235';ctx.fillRect(w.x,w.y-height+4,w.w,5);
  ctx.strokeStyle='#9aa58d';ctx.lineWidth=1;ctx.strokeRect(w.x,w.y-height,w.w,w.h);

  if(w.w>w.h){
    ctx.fillStyle='#596550';for(let x=w.x+16;x<w.x+w.w;x+=28)ctx.fillRect(x,w.y-height+7,3,w.h);
  }else{
    ctx.fillStyle='#596550';for(let y=w.y-height+16;y<w.y+height;y+=28)ctx.fillRect(w.x,y,w.w,3);
  }
}

function drawProps(){
  const props=[
    [145,145,2],[220,155,1],[125,220,3],[720,155,3],[825,215,2],[150,745,2],[260,790,1],
    [720,745,3],[830,790,2],[470,445,1],[530,545,1],[330,330,2],[610,330,2],[330,650,2],[610,650,2]
  ];
  for(const [x,y,type] of props){
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(x+7,y+12,24,9,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(x,y);
    if(type===1){
      ctx.fillStyle='#20251d';ctx.fillRect(-18,-24,36,38);ctx.fillStyle='#66705a';ctx.fillRect(-18,-30,36,8);ctx.strokeStyle='#a1a98f';ctx.strokeRect(-18,-30,36,44);
    }else if(type===2){
      ctx.fillStyle='#1c2019';ctx.fillRect(-22,-14,44,24);ctx.fillStyle='#687260';ctx.fillRect(-22,-20,44,8);ctx.fillStyle='#252c22';ctx.fillRect(-14,-10,28,12);
    }else{
      ctx.fillStyle='#31382b';ctx.beginPath();ctx.arc(0,-8,20,0,Math.PI*2);ctx.fill();ctx.fillStyle='#78836b';ctx.beginPath();ctx.arc(0,-8,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d4ff34';ctx.fillRect(-3,-11,6,6);
    }
    ctx.restore();
  }
}

function draw(){
  ctx.clearRect(0,0,1000,1000);drawFloor();drawProps();

  for(const r of world.resources||[]){
    ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(r.x+5,r.y+8,12,5,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(r.x,r.y);ctx.fillStyle=r.kind==='medkit'?'#eef4df':r.kind==='water'?'#83b9b5':'#c5c8b5';ctx.shadowBlur=15;ctx.shadowColor=ctx.fillStyle;
    ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(9,-2);ctx.lineTo(6,8);ctx.lineTo(-7,8);ctx.lineTo(-10,-2);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.restore();
  }

  const objects=[...(world.players||[]).map(p=>({kind:'player',p})),...(world.walls||[]).map(w=>({kind:'wall',w}))];
  objects.sort((a,b)=>a.kind==='wall'?a.w.y-b.w.y:a.p.y-b.p.y);
  for(const obj of objects)if(obj.kind==='wall')drawWall(obj.w);

  for(const p of world.players||[]){
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(p.x+8,p.y+20,18,7,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(p.x,p.y);
    ctx.fillStyle=p.id===myId?'#d4ff34':'#aeb6a4';ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(14,-8);ctx.lineTo(11,12);ctx.lineTo(-11,12);ctx.lineTo(-14,-8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f1f4e7';ctx.beginPath();ctx.arc(0,-31,7,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.id===myId?'#efffb5':'#4d5445';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#111';ctx.fillRect(-18,-50,36,4);ctx.fillStyle=p.health>35?'#d4ff34':'#ff6040';ctx.fillRect(-18,-50,36*Math.max(0,p.health)/100,4);
    ctx.fillStyle='#f2f4e9';ctx.font='700 11px monospace';ctx.textAlign='center';ctx.fillText(p.name,0,-58);ctx.restore();
  }

  ctx.save();ctx.globalCompositeOperation='screen';
  const glow=ctx.createRadialGradient(500,500,80,500,500,520);glow.addColorStop(0,'rgba(212,255,52,.08)');glow.addColorStop(.7,'rgba(212,255,52,.015)');glow.addColorStop(1,'rgba(0,0,0,.48)');ctx.fillStyle=glow;ctx.fillRect(0,0,1000,1000);ctx.restore();

  ctx.strokeStyle='#d4ff34';ctx.lineWidth=4;ctx.setLineDash([12,8]);ctx.beginPath();ctx.arc(world.zone.x,world.zone.y,world.zone.radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);

  myPlayer=(world.players||[]).find(p=>p.id===myId);
  if(myPlayer){document.getElementById('health').style.width=myPlayer.health+'%';document.getElementById('energy').style.width=(myPlayer.energy||100)+'%';const location=document.getElementById('location');if(location&&myPlayer.room)location.textContent=myPlayer.room;}
  if(world.aiEvent){ctx.fillStyle='#d4ff34';ctx.textAlign='center';ctx.font='700 28px Oswald';ctx.fillText('NEXUS // '+world.aiEvent.objective,500,70)}
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
