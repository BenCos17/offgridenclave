const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const keys={};let socket=null,myId=null,myPlayer=null,angle=0;
let world={zone:{x:500,y:500,radius:430},resources:[],players:[],walls:[],structures:[],aiEvent:null};

addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);

canvas.addEventListener('click',()=>canvas.requestPointerLock?.());
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas)angle+=(e.movementX||0)*0.0025;});

function segmentsForWalls(){
  const segments=[];
  for(const w of world.walls||[]){
    segments.push([w.x,w.y,w.x+w.w,w.y],[w.x+w.w,w.y,w.x+w.w,w.y+w.h],[w.x+w.w,w.y+w.h,w.x,w.y+w.h],[w.x,w.y+w.h,w.x,w.y]);
  }
  return segments;
}

function raySegment(px,py,dx,dy,x1,y1,x2,y2){
  const sx=x2-x1,sy=y2-y1;
  const den=dx*sy-dy*sx;if(Math.abs(den)<0.0001)return null;
  const qx=px-x1,qy=py-y1;
  const t=(qx*sy-qy*sx)/den;
  const u=(qx*dy-qy*dx)/den;
  if(t>0&&u>=0&&u<=1)return t;
  return null;
}

function castRay(px,py,rayAngle){
  const dx=Math.cos(rayAngle),dy=Math.sin(rayAngle);let nearest=Infinity;
  for(const s of segmentsForWalls()){
    const t=raySegment(px,py,dx,dy,s[0],s[1],s[2],s[3]);
    if(t!==null&&t<nearest)nearest=t;
  }
  return nearest;
}

function drawScene(){
  const w=canvas.width,h=canvas.height;
  const sky=ctx.createLinearGradient(0,0,0,h/2);sky.addColorStop(0,'#181d20');sky.addColorStop(1,'#39443b');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h/2);
  const floor=ctx.createLinearGradient(0,h/2,0,h);floor.addColorStop(0,'#5c6654');floor.addColorStop(.45,'#30382d');floor.addColorStop(1,'#11140f');ctx.fillStyle=floor;ctx.fillRect(0,h/2,w,h/2);

  ctx.save();ctx.globalAlpha=.28;
  for(let y=h/2;y<h;y+=18){ctx.fillStyle=y%36?'#66705c':'#252b21';ctx.fillRect(0,y,w,2)}
  ctx.restore();

  myPlayer=(world.players||[]).find(p=>p.id===myId)||{x:500,y:500,health:100,energy:100};
  const fov=Math.PI/3,columns=420;
  const depths=new Float32Array(columns);

  for(let i=0;i<columns;i++){
    const rayAngle=angle-fov/2+(i/columns)*fov;
    let distance=castRay(myPlayer.x,myPlayer.y,rayAngle);if(!Number.isFinite(distance))distance=1000;
    distance*=Math.cos(rayAngle-angle);depths[i]=distance;
    const wallHeight=Math.min(h*1.7,(h*340)/Math.max(distance,1));
    const top=(h-wallHeight)/2;
    const shade=Math.max(.18,1-distance/900);
    const wallIndex=Math.floor((rayAngle-angle+fov/2)/(fov)*12)%3;
    const r=Math.floor((95+wallIndex*12)*shade),g=Math.floor((105+wallIndex*10)*shade),b=Math.floor((82+wallIndex*7)*shade);
    ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(i*w/columns,top,w/columns+1,wallHeight);
    ctx.fillStyle=`rgba(220,255,190,${.12*shade})`;ctx.fillRect(i*w/columns,top,w/columns+1,Math.max(2,wallHeight*.025));
  }

  const sprites=[];
  for(const r of world.resources||[])sprites.push({kind:'resource',x:r.x,y:r.y,type:r.kind});
  for(const p of world.players||[])if(p.id!==myId)sprites.push({kind:'player',x:p.x,y:p.y,name:p.name,health:p.health});
  sprites.sort((a,b)=>Math.hypot(a.x-myPlayer.x,a.y-myPlayer.y)-Math.hypot(b.x-myPlayer.x,b.y-myPlayer.y));
  sprites.reverse();

  for(const s of sprites){
    const dx=s.x-myPlayer.x,dy=s.y-myPlayer.y;
    let rel=Math.atan2(dy,dx)-angle;
    while(rel<-Math.PI)rel+=Math.PI*2;while(rel>Math.PI)rel-=Math.PI*2;
    if(Math.abs(rel)>fov/2*.9)continue;
    const dist=Math.hypot(dx,dy);const screenX=(rel/fov+.5)*w;
    if(screenX<0||screenX>w)continue;
    const column=Math.max(0,Math.min(columns-1,Math.floor(screenX/ w*columns)));
    if(dist>depths[column])continue;

    const size=Math.min(w,((h*220)/dist));
    const top=h/2-size*.65;
    ctx.save();ctx.translate(screenX,top);
    if(s.kind==='resource'){
      ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.ellipse(0,size*.72,size*.24,size*.08,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=s.type==='medkit'?'#e7efdd':s.type==='water'?'#83b9b5':'#d4ff34';ctx.beginPath();ctx.moveTo(0,-size*.12);ctx.lineTo(size*.18,size*.18);ctx.lineTo(0,size*.48);ctx.lineTo(-size*.18,size*.18);ctx.closePath();ctx.fill();ctx.strokeStyle='#f1f6d9';ctx.lineWidth=2;ctx.stroke();
    }else{
      ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(0,size*.72,size*.22,size*.07,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#afb7a3';ctx.fillRect(-size*.13,size*.05,size*.26,size*.65);ctx.beginPath();ctx.arc(0,size*.02,size*.12,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d4ff34';ctx.fillRect(-size*.17,-size*.1,size*.34,4);
      ctx.fillStyle='#f2f4e9';ctx.font=`bold ${Math.max(12,size*.08)}px monospace`;ctx.textAlign='center';ctx.fillText(s.name||'DRIFTER',0,-size*.18);
    }
    ctx.restore();
  }

  ctx.fillStyle='rgba(212,255,52,.9)';ctx.fillRect(w/2-10,h/2,20,2);ctx.fillRect(w/2,h/2-10,2,20);
  ctx.fillStyle='#e9eedf';ctx.fillRect(w/2-2,h/2-2,4,4);

  if(world.aiEvent){ctx.fillStyle='#d4ff34';ctx.textAlign='center';ctx.font='700 25px Oswald';ctx.fillText('NEXUS // '+world.aiEvent.objective,w/2,70)}
}

function sendMovement(){
  if(!socket)return;
  let forward=(keys.w?1:0)-(keys.s?1:0);let strafe=(keys.d?1:0)-(keys.a?1:0);
  if(!forward&&!strafe)return;
  const dx=Math.cos(angle)*forward+Math.cos(angle+Math.PI/2)*strafe;
  const dy=Math.sin(angle)*forward+Math.sin(angle+Math.PI/2)*strafe;
  socket.emit('move',{dx,dy,sprint:!!keys.shift});
}

function draw(){drawScene();sendMovement();requestAnimationFrame(draw)}draw();

function connect(){
  socket=io();socket.on('joined',data=>{myId=data.id;world=data.world;document.getElementById('join').classList.add('hidden');document.getElementById('status').textContent='SIGNAL ACTIVE';canvas.requestPointerLock?.();});
  socket.on('world',w=>world=w);socket.on('leaderboard',s=>renderScores(s));socket.on('event',e=>logEvent(e.text));
  const name=document.getElementById('name').value.trim();if(name)socket.emit('setName',name);
}
function renderScores(scores){document.getElementById('scores').innerHTML=(scores||[]).slice(0,8).map(s=>`<li>${escapeHtml(s.name)}<span>${s.score}</span></li>`).join('')||'<li>NO RECORDS</li>'}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function logEvent(text){const el=document.createElement('div');el.className='event';el.textContent=text;document.getElementById('eventLog').prepend(el);setTimeout(()=>el.remove(),9000)}
fetch('/api/leaderboard').then(r=>r.json()).then(renderScores);
document.getElementById('enter').onclick=()=>{const n=document.getElementById('name').value.trim();if(!n)return document.getElementById('name').focus();connect();};
addEventListener('keydown',e=>{if(!socket)return;const k=e.key.toLowerCase();if(k==='e')for(const r of world.resources||[]){if(Math.hypot(r.x-(myPlayer?.x||500),r.y-(myPlayer?.y||500))<70)socket.emit('collect',r.id)}if(k==='f')socket.emit('attack')});
