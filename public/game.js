const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ============================
// CONFIGURATION (visual only)
// ============================
const CONFIG = {
  riverWidthRatio: 0.65,
  bankMinWidth: 60,
  scrollSpeed: 2.5,
  starCount: 80,
  treeSpacing: 60,
  waveAmplitude: 3,
  waveFrequency: 0.03,
  waterShimmerSpeed: 0.002,
};

let playerName = '';
let renderState = null;
let riverSegments = [];
let stars = [];
let screenShake = 0;
let frameCount = 0;
let scrollOffset = 0;

// Visual-only trails (renderer side)
let playerTrail = [];
const bulletTrails = new Map();

// ============================
// WEB SOCKET
// ============================
const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProtocol}://${location.host}`);

const inputState = { left: false, right: false, shoot: false };

function safeSend(payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendInit() {
  safeSend({
    type: 'init',
    data: { width: canvas.width, height: canvas.height }
  });
}

ws.addEventListener('open', () => {
  sendInit();
});

ws.addEventListener('message', (event) => {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch {
    return;
  }

  if (payload.type === 'init') {
    if (payload.data?.width && payload.data?.height) {
      applyServerSize(payload.data.width, payload.data.height);
    }
    riverSegments = payload.data?.riverSegments || riverSegments;
  }

  if (payload.type === 'state') {
    renderState = payload.data;
    screenShake = renderState.screenShake || 0;
    frameCount = renderState.frameCount || 0;
    scrollOffset = renderState.scrollOffset || 0;
    updateHUD();
  }

  if (payload.type === 'game_over') {
    document.getElementById('game-screen').style.display = 'none';
    const goScreen = document.getElementById('game-over-screen');
    goScreen.style.display = 'block';
    goScreen.style.animation = 'none';
    void goScreen.offsetWidth;
    goScreen.style.animation = 'panelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
    document.getElementById('final-score').textContent = `امتیاز نهایی: ${payload.data?.score ?? 0}`;
  }
});

// ============================
// CANVAS SETUP
// ============================
function applyServerSize(w, h) {
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  initStars();
}

function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth, 800);
  const maxHeight = Math.min(window.innerHeight - 60, 700);
  applyServerSize(maxWidth, maxHeight);
  safeSend({ type: 'resize', data: { width: maxWidth, height: maxHeight } });
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================
// VISUALS: STARS & RIVER
// ============================
function initStars() {
  stars = [];
  for (let i = 0; i < CONFIG.starCount; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.1,
    });
  }
}

function drawBackground() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#020a18');
  skyGrad.addColorStop(0.5, '#051525');
  skyGrad.addColorStop(1, '#081e30');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach(s => {
    s.twinkle += 0.02;
    const alpha = 0.4 + Math.sin(s.twinkle) * 0.3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,220,255,${alpha})`;
    ctx.fill();
  });
}

function drawRiver() {
  if (!riverSegments.length) return;
  const segH = 20;
  const offsetIdx = Math.floor(scrollOffset / segH);

  for (let i = 0; i < Math.ceil(canvas.height / segH) + 2; i++) {
    const segIdx = (offsetIdx + i) % riverSegments.length;
    const seg = riverSegments[segIdx];
    const yBase = i * segH - (scrollOffset % segH);

    const leftBank = seg.cx - seg.w / 2;
    const rightBank = seg.cx + seg.w / 2;

    const waveOff = Math.sin((yBase + scrollOffset) * CONFIG.waveFrequency + frameCount * 0.03) * CONFIG.waveAmplitude;
    const waterGrad = ctx.createLinearGradient(leftBank, yBase, rightBank, yBase);
    waterGrad.addColorStop(0, '#0a2a4a');
    waterGrad.addColorStop(0.15, '#0d3560');
    waterGrad.addColorStop(0.5, '#104070');
    waterGrad.addColorStop(0.85, '#0d3560');
    waterGrad.addColorStop(1, '#0a2a4a');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(leftBank + waveOff, yBase, seg.w, segH + 1);

    ctx.strokeStyle = `rgba(60,160,230,${0.06 + Math.sin(yBase * 0.05 + frameCount * 0.02) * 0.04})`;
    ctx.lineWidth = 0.5;
    for (let wx = leftBank + 20; wx < rightBank - 20; wx += 30) {
      const shimOff = Math.sin((yBase + wx) * 0.03 + frameCount * CONFIG.waterShimmerSpeed * 60) * 8;
      ctx.beginPath();
      ctx.moveTo(wx + shimOff, yBase + 4);
      ctx.lineTo(wx + shimOff + 18, yBase + 4);
      ctx.stroke();
    }

    const lbGrad = ctx.createLinearGradient(0, yBase, leftBank + waveOff, yBase);
    lbGrad.addColorStop(0, '#0a3a10');
    lbGrad.addColorStop(0.6, '#156628');
    lbGrad.addColorStop(0.85, '#1a7a30');
    lbGrad.addColorStop(1, '#0d4a18');
    ctx.fillStyle = lbGrad;
    ctx.fillRect(0, yBase, leftBank + waveOff, segH + 1);

    const rbGrad = ctx.createLinearGradient(rightBank + waveOff, yBase, canvas.width, yBase);
    rbGrad.addColorStop(0, '#0d4a18');
    rbGrad.addColorStop(0.15, '#1a7a30');
    rbGrad.addColorStop(0.4, '#156628');
    rbGrad.addColorStop(1, '#0a3a10');
    ctx.fillStyle = rbGrad;
    ctx.fillRect(rightBank + waveOff, yBase, canvas.width - rightBank, segH + 1);

    ctx.fillStyle = 'rgba(80,60,30,0.3)';
    ctx.fillRect(leftBank + waveOff - 3, yBase, 6, segH + 1);
    ctx.fillRect(rightBank + waveOff - 3, yBase, 6, segH + 1);
  }

  drawBankDecor();
}

function drawBankDecor() {
  const segH = 20;
  const offsetIdx = Math.floor(scrollOffset / segH);

  for (let i = 0; i < Math.ceil(canvas.height / segH); i++) {
    const segIdx = (offsetIdx + i) % riverSegments.length;
    const seg = riverSegments[segIdx];
    const yBase = i * segH - (scrollOffset % segH);
    const leftBank = seg.cx - seg.w / 2;
    const rightBank = seg.cx + seg.w / 2;

    const seed = ((segIdx * 7 + 13) * 31) % 100;
    if (seed < 35) drawTree(leftBank - 15 - (seed % 20), yBase - 5, seed);
    if (seed > 60) drawTree(rightBank + 8 + (seed % 18), yBase - 5, seed + 50);
  }
}

function drawTree(x, y, seed) {
  const size = 6 + (seed % 5);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(x + size / 2 - 1, y + size * 0.6, 3, size * 0.5);
  for (let l = 0; l < 3; l++) {
    const s = size - l * 2;
    const yOff = l * -3;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.4 + yOff, s / 2, 0, Math.PI * 2);
    const shade = 25 + l * 15 + (seed % 20);
    ctx.fillStyle = `rgb(${10 + l * 5}, ${shade + 60}, ${10 + l * 5})`;
    ctx.fill();
  }
}

// ============================
// DRAWING: ENTITIES
// ============================
function drawPlayer(p) {
  const px = p.x;
  const py = p.y;
  const w = p.width;
  const h = p.height;

  ctx.save();
  const cx = px + w / 2;
  const cy = py + h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((p.tilt || 0) * 0.15);
  ctx.translate(-cx, -cy);

  // Engine trail (visual only)
  playerTrail.push({
    x: cx + (Math.random() - 0.5) * 6,
    y: py + h + 2,
    life: 18 + Math.random() * 10,
    maxLife: 28,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 1.5 + Math.random(),
  });
  if (playerTrail.length > 40) playerTrail.shift();

  playerTrail.forEach(t => {
    t.x += t.vx;
    t.y += t.vy;
    t.life--;
    const a = t.life / t.maxLife;
    const size = a * 5;
    if (size <= 0) return;
    ctx.beginPath();
    ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, size);
    gradient.addColorStop(0, `rgba(100,200,255,${a * 0.7})`);
    gradient.addColorStop(0.5, `rgba(0,120,255,${a * 0.4})`);
    gradient.addColorStop(1, 'rgba(0,60,180,0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  });
  playerTrail = playerTrail.filter(t => t.life > 0);

  ctx.shadowColor = 'rgba(0,150,255,0.4)';
  ctx.shadowBlur = 15;

  ctx.beginPath();
  ctx.moveTo(px + w / 2, py);
  ctx.lineTo(px + w * 0.65, py + h * 0.35);
  ctx.lineTo(px + w * 0.6, py + h * 0.9);
  ctx.lineTo(px + w * 0.5, py + h);
  ctx.lineTo(px + w * 0.4, py + h * 0.9);
  ctx.lineTo(px + w * 0.35, py + h * 0.35);
  ctx.closePath();
  const bodyGrad = ctx.createLinearGradient(px, py, px + w, py);
  bodyGrad.addColorStop(0, '#1a4a7a');
  bodyGrad.addColorStop(0.4, '#3a8ad0');
  bodyGrad.addColorStop(0.6, '#4aa0e8');
  bodyGrad.addColorStop(1, '#1a4a7a');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(px + w * 0.3, py + h * 0.45);
  ctx.lineTo(px - 4, py + h * 0.6);
  ctx.lineTo(px + 2, py + h * 0.65);
  ctx.lineTo(px + w * 0.38, py + h * 0.55);
  ctx.closePath();
  const wingGradL = ctx.createLinearGradient(px - 4, py + h * 0.45, px + w * 0.4, py + h * 0.55);
  wingGradL.addColorStop(0, '#0d3060');
  wingGradL.addColorStop(1, '#2870b0');
  ctx.fillStyle = wingGradL;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px + w * 0.7, py + h * 0.45);
  ctx.lineTo(px + w + 4, py + h * 0.6);
  ctx.lineTo(px + w - 2, py + h * 0.65);
  ctx.lineTo(px + w * 0.62, py + h * 0.55);
  ctx.closePath();
  const wingGradR = ctx.createLinearGradient(px + w + 4, py + h * 0.45, px + w * 0.6, py + h * 0.55);
  wingGradR.addColorStop(0, '#0d3060');
  wingGradR.addColorStop(1, '#2870b0');
  ctx.fillStyle = wingGradR;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h * 0.28, w * 0.1, h * 0.1, 0, 0, Math.PI * 2);
  const cockpitGrad = ctx.createRadialGradient(px + w / 2, py + h * 0.26, 0, px + w / 2, py + h * 0.28, h * 0.1);
  cockpitGrad.addColorStop(0, '#b0e8ff');
  cockpitGrad.addColorStop(0.6, '#40a0d0');
  cockpitGrad.addColorStop(1, '#1a5080');
  ctx.fillStyle = cockpitGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px + w * 0.42, py + h * 0.85);
  ctx.lineTo(px + w * 0.3, py + h);
  ctx.lineTo(px + w * 0.45, py + h * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#1a5080';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px + w * 0.58, py + h * 0.85);
  ctx.lineTo(px + w * 0.7, py + h);
  ctx.lineTo(px + w * 0.55, py + h * 0.95);
  ctx.closePath();
  ctx.fillStyle = '#1a5080';
  ctx.fill();

  const glow = 0.5 + Math.sin(frameCount * 0.15) * 0.3;
  const engineGrad = ctx.createRadialGradient(px + w / 2, py + h + 2, 0, px + w / 2, py + h + 8, 12);
  engineGrad.addColorStop(0, `rgba(100,200,255,${glow})`);
  engineGrad.addColorStop(0.5, `rgba(0,100,255,${glow * 0.4})`);
  engineGrad.addColorStop(1, 'rgba(0,50,150,0)');
  ctx.fillStyle = engineGrad;
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h + 2, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px + w / 2, py + 1);
  ctx.lineTo(px + w * 0.62, py + h * 0.3);
  ctx.strokeStyle = 'rgba(180,230,255,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();
  if (e.type === 0) drawPlane(e);
  else if (e.type === 1) drawHeli(e);
  else if (e.type === 2) drawFuel(e);
  ctx.restore();
}

function drawPlane(e) {
  const px = e.x, py = e.y, w = e.width, h = e.height;
  ctx.shadowColor = 'rgba(255,60,60,0.3)';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(px + w / 2, py + h);
  ctx.lineTo(px + w * 0.7, py + h * 0.3);
  ctx.lineTo(px + w * 0.6, py);
  ctx.lineTo(px + w * 0.4, py);
  ctx.lineTo(px + w * 0.3, py + h * 0.3);
  ctx.closePath();
  const bg = ctx.createLinearGradient(px, py, px + w, py);
  bg.addColorStop(0, '#8a2020');
  bg.addColorStop(0.5, '#d04040');
  bg.addColorStop(1, '#8a2020');
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(px + w * 0.25, py + h * 0.4);
  ctx.lineTo(px - 6, py + h * 0.55);
  ctx.lineTo(px + 2, py + h * 0.6);
  ctx.lineTo(px + w * 0.35, py + h * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#701818';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(px + w * 0.75, py + h * 0.4);
  ctx.lineTo(px + w + 6, py + h * 0.55);
  ctx.lineTo(px + w - 2, py + h * 0.6);
  ctx.lineTo(px + w * 0.65, py + h * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#701818';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h * 0.35, 3, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcc00';
  ctx.fill();
}

function drawHeli(e) {
  const px = e.x, py = e.y, w = e.width, h = e.height;
  ctx.shadowColor = 'rgba(200,120,0,0.3)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h * 0.55, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
  const bg = ctx.createRadialGradient(px + w / 2, py + h * 0.45, 0, px + w / 2, py + h * 0.55, w * 0.35);
  bg.addColorStop(0, '#e09030');
  bg.addColorStop(1, '#8a5010');
  ctx.fillStyle = bg;
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.moveTo(px + w * 0.2, py + h * 0.5);
  ctx.lineTo(px - 4, py + h * 0.3);
  ctx.lineTo(px, py + h * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#7a4010';
  ctx.fill();

  const rLen = w * 0.65;
  const rotor = (frameCount * 0.3) % (Math.PI * 2);
  ctx.save();
  ctx.translate(px + w / 2, py + h * 0.2);
  ctx.rotate(rotor);
  ctx.strokeStyle = 'rgba(200,200,200,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-rLen, 0);
  ctx.lineTo(rLen, 0);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(px + w / 2 + 3, py + h * 0.5, 4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe080';
  ctx.fill();
}

function drawFuel(e) {
  const px = e.x, py = e.y, w = e.width, h = e.height + 8;
  const glowGrad = ctx.createRadialGradient(px + w / 2, py + h / 2, 0, px + w / 2, py + h / 2, w);
  glowGrad.addColorStop(0, 'rgba(0,255,120,0.15)');
  glowGrad.addColorStop(1, 'rgba(0,255,80,0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h / 2, w, 0, Math.PI * 2);
  ctx.fill();

  const rr = 5;
  ctx.beginPath();
  ctx.roundRect(px + 4, py + 2, w - 8, h - 4, rr);
  const tg = ctx.createLinearGradient(px + 4, py, px + w - 4, py);
  tg.addColorStop(0, '#1a6030');
  tg.addColorStop(0.4, '#30b060');
  tg.addColorStop(0.6, '#40d070');
  tg.addColorStop(1, '#1a6030');
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,255,150,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', px + w / 2, py + h / 2);

  const pulse = Math.sin(frameCount * 0.08) * 0.15 + 0.85;
  ctx.strokeStyle = `rgba(0,255,120,${0.3 * pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px + 2, py, w - 4, h, rr + 2);
  ctx.stroke();
}

function drawBullet(b) {
  const trail = bulletTrails.get(b.id) || [];
  trail.push({ x: b.x + b.width / 2, y: b.y + b.height, life: 8 });
  if (trail.length > 8) trail.shift();

  trail.forEach(t => {
    t.life--;
    const a = t.life / 8;
    const r = 2 * a;
    if (r <= 0) return;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,100,${a * 0.5})`;
    ctx.fill();
  });

  const cleaned = trail.filter(t => t.life > 0);
  bulletTrails.set(b.id, cleaned);

  const gx = b.x + b.width / 2;
  const gy = b.y + b.height / 2;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 10);
  glow.addColorStop(0, 'rgba(255,255,150,0.5)');
  glow.addColorStop(1, 'rgba(255,200,50,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(gx, gy, 10, 0, Math.PI * 2);
  ctx.fill();

  const bg = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height);
  bg.addColorStop(0, '#ffffaa');
  bg.addColorStop(0.5, '#ffdd44');
  bg.addColorStop(1, '#ffaa00');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.width, b.height, 2);
  ctx.fill();
}

function drawParticle(p) {
  const a = p.life / p.maxLife;
  const size = p.size * a;
  if (size <= 0) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = a;

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
  glow.addColorStop(0, p.color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = p.color;
  if (p.type === 'explosion') {
    ctx.fillRect(-size / 2, -size / 2, size, size);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================
// HUD UPDATE
// ============================
function updateHUD() {
  if (!renderState) return;
  document.getElementById('score').textContent = `امتیاز: ${renderState.score}`;
  const fuelBar = document.getElementById('fuel-bar-inner');
  const pct = Math.max(0, Math.min(100, renderState.fuel));
  fuelBar.style.width = pct + '%';
  fuelBar.classList.remove('warning', 'critical');
  if (pct <= 20) fuelBar.classList.add('critical');
  else if (pct <= 40) fuelBar.classList.add('warning');
}

// ============================
// RENDER LOOP
// ============================
function render() {
  requestAnimationFrame(render);
  if (!renderState) return;

  ctx.save();
  if (screenShake > 0.5) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake * 2,
      (Math.random() - 0.5) * screenShake * 2
    );
  }

  drawBackground();
  drawRiver();

  renderState.bullets.forEach(drawBullet);
  renderState.enemies.forEach(drawEnemy);
  drawPlayer(renderState.player);
  renderState.particles.forEach(drawParticle);

  const vig = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2,
    canvas.width * 0.3,
    canvas.width / 2, canvas.height / 2,
    canvas.width * 0.75
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let sy = 0; sy < canvas.height; sy += 3) {
    ctx.fillRect(0, sy, canvas.width, 1);
  }

  ctx.restore();

  // Clean bullet trails for bullets no longer active
  const activeBulletIds = new Set(renderState.bullets.map(b => b.id));
  for (const id of bulletTrails.keys()) {
    if (!activeBulletIds.has(id)) bulletTrails.delete(id);
  }
}
render();

// ============================
// GAME LIFECYCLE
// ============================
function startGame() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) return;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  resizeCanvas();
  renderState = null;
  playerTrail = [];
  bulletTrails.clear();
  safeSend({ type: 'start', data: { name: playerName } });
}

function showLeaderboard() {
  fetch('/api/leaderboard')
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('leaderboard-list');
      list.innerHTML = '';
      data.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.setProperty('--i', index);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'leaderboard-name';
        nameSpan.textContent = item.name;
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'leaderboard-score';
        scoreSpan.textContent = item.score;
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        list.appendChild(li);
      });
      document.getElementById('game-over-screen').style.display = 'none';
      const lbScreen = document.getElementById('leaderboard-screen');
      lbScreen.style.display = 'block';
      lbScreen.style.animation = 'none';
      void lbScreen.offsetWidth;
      lbScreen.style.animation = 'panelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
    });
}

// ============================
// EVENT LISTENERS
// ============================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', () => {
  document.getElementById('game-over-screen').style.display = 'none';
  const ss = document.getElementById('start-screen');
  ss.style.display = 'block';
  ss.style.animation = 'none';
  void ss.offsetWidth;
  ss.style.animation = 'panelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
});
document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('back-to-menu-btn').addEventListener('click', () => {
  document.getElementById('leaderboard-screen').style.display = 'none';
  const ss = document.getElementById('start-screen');
  ss.style.display = 'block';
  ss.style.animation = 'none';
  void ss.offsetWidth;
  ss.style.animation = 'panelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
});

// Keyboard controls (send input to server)
function sendInput() {
  safeSend({ type: 'input', data: inputState });
}

const keysDown = new Set();
document.addEventListener('keydown', (e) => {
  keysDown.add(e.key);
  if (e.key === 'ArrowLeft') inputState.left = true;
  if (e.key === 'ArrowRight') inputState.right = true;
  if (e.key === ' ') {
    e.preventDefault();
    inputState.shoot = true;
  }
  sendInput();
});

document.addEventListener('keyup', (e) => {
  keysDown.delete(e.key);
  if (e.key === 'ArrowLeft') inputState.left = false;
  if (e.key === 'ArrowRight') inputState.right = false;
  if (e.key === ' ') inputState.shoot = false;
  sendInput();
});

// Mobile touch controls
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  inputState.shoot = true;
  sendInput();
  inputState.shoot = false;
  setTimeout(sendInput, 0);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  const diff = (touchX - touchStartX) * 0.4;
  if (diff > 0) {
    inputState.right = true;
    inputState.left = false;
  } else if (diff < 0) {
    inputState.left = true;
    inputState.right = false;
  }
  sendInput();
  inputState.left = false;
  inputState.right = false;
  setTimeout(sendInput, 0);
  touchStartX = touchX;
}, { passive: false });
