const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ============================
// CONFIGURATION
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
let score = 0;
let fuel = 100;
let gameRunning = false;
let particles = [];
let screenShake = 0;
let scrollOffset = 0;
let frameCount = 0;

// Stars for background
let stars = [];
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

// River path segments for curved banks
let riverSegments = [];
function initRiver() {
  riverSegments = [];
  const segCount = Math.ceil(canvas.height / 20) + 30;
  let cx = canvas.width / 2;
  let drift = 0;
  for (let i = 0; i < segCount; i++) {
    drift += (Math.random() - 0.5) * 8;
    drift = Math.max(-canvas.width * 0.15, Math.min(canvas.width * 0.15, drift));
    const riverW = canvas.width * CONFIG.riverWidthRatio + Math.sin(i * 0.08) * 40;
    riverSegments.push({ cx: canvas.width / 2 + drift, w: riverW });
  }
}

// ============================
// DRAWING HELPERS
// ============================
function drawGradientRect(x, y, w, h, colors) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

// ============================
// PLAYER
// ============================
class Player {
  constructor() {
    this.width = 38;
    this.height = 44;
    this.x = canvas.width / 2 - this.width / 2;
    this.y = canvas.height - this.height - 20;
    this.speed = 7;
    this.tilt = 0;
    this.engineFlicker = 0;
    this.trail = [];
  }

  draw() {
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(this.tilt * 0.15);
    ctx.translate(-cx, -cy);

    // Engine trail particles
    this.trail.push({
      x: cx + (Math.random() - 0.5) * 6,
      y: this.y + this.height + 2,
      life: 18 + Math.random() * 10,
      maxLife: 28,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.5 + Math.random(),
    });
    if (this.trail.length > 40) this.trail.shift();

    this.trail.forEach(t => {
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
      gradient.addColorStop(1, `rgba(0,60,180,0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
    this.trail = this.trail.filter(t => t.life > 0);

    const px = this.x;
    const py = this.y;
    const w = this.width;
    const h = this.height;

    // Body shadow/glow
    ctx.shadowColor = 'rgba(0,150,255,0.4)';
    ctx.shadowBlur = 15;

    // Main fuselage
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py);           // Nose
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

    // Wings
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

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h * 0.28, w * 0.1, h * 0.1, 0, 0, Math.PI * 2);
    const cockpitGrad = ctx.createRadialGradient(px + w / 2, py + h * 0.26, 0, px + w / 2, py + h * 0.28, h * 0.1);
    cockpitGrad.addColorStop(0, '#b0e8ff');
    cockpitGrad.addColorStop(0.6, '#40a0d0');
    cockpitGrad.addColorStop(1, '#1a5080');
    ctx.fillStyle = cockpitGrad;
    ctx.fill();

    // Tail fins
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

    // Engine glow
    this.engineFlicker = (this.engineFlicker + 0.15) % (Math.PI * 2);
    const glow = 0.5 + Math.sin(this.engineFlicker) * 0.3;
    const engineGrad = ctx.createRadialGradient(px + w / 2, py + h + 2, 0, px + w / 2, py + h + 8, 12);
    engineGrad.addColorStop(0, `rgba(100,200,255,${glow})`);
    engineGrad.addColorStop(0.5, `rgba(0,100,255,${glow * 0.4})`);
    engineGrad.addColorStop(1, 'rgba(0,50,150,0)');
    ctx.fillStyle = engineGrad;
    ctx.beginPath();
    ctx.arc(px + w / 2, py + h + 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // Highlight edge
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + 1);
    ctx.lineTo(px + w * 0.62, py + h * 0.3);
    ctx.strokeStyle = 'rgba(180,230,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  move(dir) {
    this.x += dir * this.speed;
    this.tilt += dir * 0.3;
    this.tilt *= 0.85;
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
  }

  updateTilt() {
    this.tilt *= 0.92;
  }
}

let player = new Player();
let enemies = [];
let bullets = [];

// ============================
// ENEMY
// ============================
class Enemy {
  constructor() {
    this.width = 36;
    this.height = 20;
    this.x = Math.random() * (canvas.width - 60) + 20;
    this.y = -50;
    this.speed = 3 + Math.random() * 1.5;
    this.type = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.03 + Math.random() * 0.03;
    this.wobbleAmp = 0.5 + Math.random() * 1;
    this.heliRotor = 0;
  }

  draw() {
    ctx.save();
    if (this.type === 0) this.drawPlane();
    else if (this.type === 1) this.drawHeli();
    else if (this.type === 2) this.drawFuel();
    ctx.restore();
  }

  drawPlane() {
    const px = this.x, py = this.y, w = this.width, h = this.height;
    // Shadow
    ctx.shadowColor = 'rgba(255,60,60,0.3)';
    ctx.shadowBlur = 10;

    // Body
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

    // Wings
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

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h * 0.35, 3, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffcc00';
    ctx.fill();
  }

  drawHeli() {
    const px = this.x, py = this.y, w = this.width, h = this.height;
    ctx.shadowColor = 'rgba(200,120,0,0.3)';
    ctx.shadowBlur = 8;

    // Body
    ctx.beginPath();
    ctx.ellipse(px + w / 2, py + h * 0.55, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
    const bg = ctx.createRadialGradient(px + w / 2, py + h * 0.45, 0, px + w / 2, py + h * 0.55, w * 0.35);
    bg.addColorStop(0, '#e09030');
    bg.addColorStop(1, '#8a5010');
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Tail
    ctx.beginPath();
    ctx.moveTo(px + w * 0.2, py + h * 0.5);
    ctx.lineTo(px - 4, py + h * 0.3);
    ctx.lineTo(px, py + h * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#7a4010';
    ctx.fill();

    // Rotor
    this.heliRotor += 0.3;
    const rLen = w * 0.65;
    ctx.save();
    ctx.translate(px + w / 2, py + h * 0.2);
    ctx.rotate(this.heliRotor);
    ctx.strokeStyle = 'rgba(200,200,200,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-rLen, 0);
    ctx.lineTo(rLen, 0);
    ctx.stroke();
    ctx.restore();

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(px + w / 2 + 3, py + h * 0.5, 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe080';
    ctx.fill();
  }

  drawFuel() {
    const px = this.x, py = this.y, w = this.width, h = this.height + 8;
    
    // Glow
    const glowGrad = ctx.createRadialGradient(px + w / 2, py + h / 2, 0, px + w / 2, py + h / 2, w);
    glowGrad.addColorStop(0, 'rgba(0,255,120,0.15)');
    glowGrad.addColorStop(1, 'rgba(0,255,80,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(px + w / 2, py + h / 2, w, 0, Math.PI * 2);
    ctx.fill();

    // Tank body
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

    // "F" label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F', px + w / 2, py + h / 2);

    // Animated pulse
    const pulse = Math.sin(frameCount * 0.08) * 0.15 + 0.85;
    ctx.strokeStyle = `rgba(0,255,120,${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px + 2, py, w - 4, h, rr + 2);
    ctx.stroke();
  }

  update() {
    this.wobble += this.wobbleSpeed;
    this.y += this.speed;
    if (this.type === 1) {
      this.x += Math.sin(this.wobble) * this.wobbleAmp;
    }
  }
}

// ============================
// BULLET
// ============================
class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 8;
    this.trail = [];
    this.width = 4;
    this.height = 14;
  }

  update() {
    this.trail.push({ x: this.x + this.width / 2, y: this.y + this.height, life: 8 });
    if (this.trail.length > 8) this.trail.shift();
    this.y -= this.speed;
  }

  draw() {
    // Trail
    this.trail.forEach((t, i) => {
      t.life--;
      const a = t.life / 8;
      const r = 2 * a;
      if (r <= 0) return;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,100,${a * 0.5})`;
      ctx.fill();
    });
    this.trail = this.trail.filter(t => t.life > 0);

    // Bullet glow
    const gx = this.x + this.width / 2;
    const gy = this.y + this.height / 2;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 10);
    glow.addColorStop(0, 'rgba(255,255,150,0.5)');
    glow.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(gx, gy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Bullet body
    const bg = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
    bg.addColorStop(0, '#ffffaa');
    bg.addColorStop(0.5, '#ffdd44');
    bg.addColorStop(1, '#ffaa00');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 2);
    ctx.fill();
  }
}

// ============================
// PARTICLE SYSTEM (Enhanced)
// ============================
class Particle {
  constructor(x, y, color, type = 'explosion') {
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'explosion' ? (Math.random() * 6 + 2) : (Math.random() * 3 + 0.5);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = type === 'explosion' ? (40 + Math.random() * 30) : (20 + Math.random() * 15);
    this.maxLife = this.life;
    this.color = color;
    this.size = type === 'explosion' ? (Math.random() * 6 + 2) : (Math.random() * 3 + 1);
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    this.vx *= 0.98;
    this.life--;
    this.rotation += this.rotSpeed;
  }

  draw() {
    const a = this.life / this.maxLife;
    const size = this.size * a;
    if (size <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = a;

    // Glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    glow.addColorStop(0, this.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = this.color;
    if (this.type === 'explosion') {
      ctx.fillRect(-size / 2, -size / 2, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function createParticles(x, y, color, count = 25) {
  const colors = color === '#ff0000'
    ? ['#ff4444', '#ff8800', '#ffcc00', '#ff2200', '#ff6600']
    : color === '#ffff00' || color === '#ffaa00'
    ? ['#ffee44', '#ffaa00', '#ff8800', '#ffcc22', '#ffffff']
    : ['#44ff88', '#00ff66', '#88ffaa', '#22dd66', '#aaffcc'];

  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)], 'explosion'));
  }
  // Add some sparks
  for (let i = 0; i < count / 2; i++) {
    particles.push(new Particle(x, y, '#ffffff', 'spark'));
  }
  screenShake = 8;
}

// ============================
// CANVAS SETUP
// ============================
function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth, 800);
  const maxHeight = Math.min(window.innerHeight - 60, 700);
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  canvas.style.width = maxWidth + 'px';
  canvas.style.height = maxHeight + 'px';
  player.x = Math.min(player.x, canvas.width - player.width);
  player.y = canvas.height - player.height - 20;
  initStars();
  initRiver();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================
// DRAWING: BACKGROUND & TERRAIN
// ============================
function drawBackground() {
  // Dark sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#020a18');
  skyGrad.addColorStop(0.5, '#051525');
  skyGrad.addColorStop(1, '#081e30');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
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
  const segH = 20;
  const offsetIdx = Math.floor(scrollOffset / segH);

  for (let i = 0; i < Math.ceil(canvas.height / segH) + 2; i++) {
    const segIdx = (offsetIdx + i) % riverSegments.length;
    const seg = riverSegments[segIdx];
    const yBase = i * segH - (scrollOffset % segH);

    const leftBank = seg.cx - seg.w / 2;
    const rightBank = seg.cx + seg.w / 2;

    // Water
    const waveOff = Math.sin((yBase + scrollOffset) * CONFIG.waveFrequency + frameCount * 0.03) * CONFIG.waveAmplitude;
    const waterGrad = ctx.createLinearGradient(leftBank, yBase, rightBank, yBase);
    waterGrad.addColorStop(0, '#0a2a4a');
    waterGrad.addColorStop(0.15, '#0d3560');
    waterGrad.addColorStop(0.5, '#104070');
    waterGrad.addColorStop(0.85, '#0d3560');
    waterGrad.addColorStop(1, '#0a2a4a');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(leftBank + waveOff, yBase, seg.w, segH + 1);

    // Water shimmer lines
    ctx.strokeStyle = `rgba(60,160,230,${0.06 + Math.sin(yBase * 0.05 + frameCount * 0.02) * 0.04})`;
    ctx.lineWidth = 0.5;
    for (let wx = leftBank + 20; wx < rightBank - 20; wx += 30) {
      const shimOff = Math.sin((yBase + wx) * 0.03 + frameCount * CONFIG.waterShimmerSpeed * 60) * 8;
      ctx.beginPath();
      ctx.moveTo(wx + shimOff, yBase + 4);
      ctx.lineTo(wx + shimOff + 18, yBase + 4);
      ctx.stroke();
    }

    // Left bank
    const lbGrad = ctx.createLinearGradient(0, yBase, leftBank + waveOff, yBase);
    lbGrad.addColorStop(0, '#0a3a10');
    lbGrad.addColorStop(0.6, '#156628');
    lbGrad.addColorStop(0.85, '#1a7a30');
    lbGrad.addColorStop(1, '#0d4a18');
    ctx.fillStyle = lbGrad;
    ctx.fillRect(0, yBase, leftBank + waveOff, segH + 1);

    // Right bank
    const rbGrad = ctx.createLinearGradient(rightBank + waveOff, yBase, canvas.width, yBase);
    rbGrad.addColorStop(0, '#0d4a18');
    rbGrad.addColorStop(0.15, '#1a7a30');
    rbGrad.addColorStop(0.4, '#156628');
    rbGrad.addColorStop(1, '#0a3a10');
    ctx.fillStyle = rbGrad;
    ctx.fillRect(rightBank + waveOff, yBase, canvas.width - rightBank, segH + 1);

    // Bank edges (dirt/sand strip)
    ctx.fillStyle = 'rgba(80,60,30,0.3)';
    ctx.fillRect(leftBank + waveOff - 3, yBase, 6, segH + 1);
    ctx.fillRect(rightBank + waveOff - 3, yBase, 6, segH + 1);
  }

  // Trees/bushes on banks
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

    // Pseudo-random based on index for deterministic placement
    const seed = ((segIdx * 7 + 13) * 31) % 100;
    if (seed < 35) {
      drawTree(leftBank - 15 - (seed % 20), yBase - 5, seed);
    }
    if (seed > 60) {
      drawTree(rightBank + 8 + (seed % 18), yBase - 5, seed + 50);
    }
  }
}

function drawTree(x, y, seed) {
  const size = 6 + (seed % 5);
  // Trunk
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(x + size / 2 - 1, y + size * 0.6, 3, size * 0.5);
  // Canopy layers
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
// HUD UPDATE
// ============================
function updateHUD() {
  document.getElementById('score').textContent = `امتیاز: ${score}`;
  const fuelBar = document.getElementById('fuel-bar-inner');
  const pct = Math.max(0, Math.min(100, fuel));
  fuelBar.style.width = pct + '%';
  fuelBar.classList.remove('warning', 'critical');
  if (pct <= 20) fuelBar.classList.add('critical');
  else if (pct <= 40) fuelBar.classList.add('warning');
}

// ============================
// GAME LOOP
// ============================
function update() {
  if (!gameRunning) return;
  frameCount++;
  const segH = 20;
  const scrollWrap = riverSegments.length * segH;
  scrollOffset = (scrollOffset - CONFIG.scrollSpeed + scrollWrap) % scrollWrap;
  player.updateTilt();

  // Spawn enemies
  if (Math.random() < 0.04 + Math.min(score / 2000, 0.03)) {
    const rand = Math.random();
    const enemy = new Enemy();
    if (rand < 0.55) enemy.type = 0;
    else if (rand < 0.85) enemy.type = 1;
    else enemy.type = 2;
    enemies.push(enemy);
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].update();
    if (enemies[i].y > canvas.height + 50) {
      enemies.splice(i, 1);
    }
  }

  // Player-enemy collision
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (player.x < e.x + e.width &&
        player.x + player.width > e.x &&
        player.y < e.y + e.height &&
        player.y + player.height > e.y) {
      if (e.type === 2) {
        // Fuel pickup on contact
        fuel = Math.min(100, fuel + 25);
        score += 5;
        createParticles(e.x + e.width / 2, e.y + e.height / 2, '#00ff66', 15);
        enemies.splice(i, 1);
      } else {
        createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff0000', 40);
        gameOver();
        return;
      }
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    if (bullets[i].y < -20) {
      bullets.splice(i, 1);
    }
  }

  // Bullet-enemy collision
  outer: for (let b = bullets.length - 1; b >= 0; b--) {
    for (let e = enemies.length - 1; e >= 0; e--) {
      const bul = bullets[b];
      const en = enemies[e];
      if (bul && en &&
          bul.x < en.x + en.width &&
          bul.x + bul.width > en.x &&
          bul.y < en.y + en.height &&
          bul.y + bul.height > en.y) {
        if (en.type === 2) {
          fuel = Math.min(100, fuel + 25);
          score += 5;
          createParticles(en.x + en.width / 2, en.y + en.height / 2, '#00ff66', 18);
        } else {
          score += 10;
          createParticles(en.x + en.width / 2, en.y + en.height / 2, '#ffaa00', 25);
        }
        enemies.splice(e, 1);
        bullets.splice(b, 1);
        continue outer;
      }
    }
  }

  // Particles  
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => p.update());

  // Screen shake decay
  screenShake *= 0.88;
  if (screenShake < 0.3) screenShake = 0;

  // Fuel drain
  fuel -= 0.08;
  if (fuel <= 0) {
    fuel = 0;
    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff0000', 30);
    gameOver();
    return;
  }

  updateHUD();
  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.save();
  // Screen shake
  if (screenShake > 0.5) {
    ctx.translate(
      (Math.random() - 0.5) * screenShake * 2,
      (Math.random() - 0.5) * screenShake * 2
    );
  }

  drawBackground();
  drawRiver();

  // Draw bullets behind enemies
  bullets.forEach(b => b.draw());
  enemies.forEach(e => e.draw());
  player.draw();
  particles.forEach(p => p.draw());

  // Vignette overlay
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

  // Scanline effect (subtle)
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let sy = 0; sy < canvas.height; sy += 3) {
    ctx.fillRect(0, sy, canvas.width, 1);
  }

  ctx.restore();
}

// ============================
// GAME LIFECYCLE
// ============================
function gameOver() {
  gameRunning = false;
  // Let last frame render
  draw();
  setTimeout(() => {
    document.getElementById('game-screen').style.display = 'none';
    const goScreen = document.getElementById('game-over-screen');
    goScreen.style.display = 'block';
    goScreen.style.animation = 'none';
    void goScreen.offsetWidth; // trigger reflow
    goScreen.style.animation = 'panelIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
    document.getElementById('final-score').textContent = `امتیاز نهایی: ${score}`;

    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score })
    });
  }, 300);
}

function startGame() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) return;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  resizeCanvas();
  gameRunning = true;
  score = 0;
  fuel = 100;
  frameCount = 0;
  scrollOffset = 0;
  enemies = [];
  bullets = [];
  particles = [];
  player = new Player();
  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - player.height - 20;
  initStars();
  initRiver();
  update();
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

// Keyboard controls
const keysDown = new Set();
document.addEventListener('keydown', (e) => {
  keysDown.add(e.key);
  if (!gameRunning) return;
  if (e.key === ' ') {
    e.preventDefault();
    bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y - 10));
  }
});
document.addEventListener('keyup', (e) => {
  keysDown.delete(e.key);
});

// Smooth keyboard movement via game loop (always keep loop running)
function processInput() {
  if (gameRunning) {
    if (keysDown.has('ArrowLeft')) player.move(-1);
    if (keysDown.has('ArrowRight')) player.move(1);
  }
  requestAnimationFrame(processInput);
}
processInput();

// Mobile touch controls
let touchStartX = 0;
let lastTapTime = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  // Tap to shoot (debounced)
  const now = Date.now();
  if (now - lastTapTime > 150) {
    bullets.push(new Bullet(player.x + player.width / 2 - 2, player.y - 10));
    lastTapTime = now;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  const diff = (touchX - touchStartX) * 0.4;
  player.move(diff > 0 ? 1 : -1);
  touchStartX = touchX;
}, { passive: false });