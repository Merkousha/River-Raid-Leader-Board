const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // Pixel art style

let playerImage = new Image();
playerImage.src = 'player(1).png';

let enemyPlaneImage = new Image();
enemyPlaneImage.src = 'aircraft- enemy.png';

let enemyHeliImage = new Image();
enemyHeliImage.src = 'heli - left to right.png';

let fuelImage = new Image();
fuelImage.src = 'Gas.png';

let playerName = '';
let score = 0;
let fuel = 100;
let gameRunning = false;
let particles = [];

// Player
class Player {
  constructor() {
    this.x = canvas.width / 2;
    this.y = canvas.height - this.height - 10;
    this.width = 40;
    this.height = 20;
    this.speed = 8;
  }

  draw() {
    if (playerImage.complete) {
      ctx.drawImage(playerImage, this.x, this.y, this.width, this.height);
    } else {
      // Fallback pixel
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  move(dir) {
    this.x += dir * this.speed;
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
  }
}

let player = new Player();
let enemies = [];
let bullets = [];

// Enemy
class Enemy {
  constructor() {
    this.x = Math.random() * (canvas.width - 40);
    this.y = -40;
    this.width = 40;
    this.height = 20;
    this.speed = 4;
    this.type = Math.floor(Math.random() * 3); // Different types
  }

  draw() {
    let img;
    if (this.type === 0 && enemyPlaneImage.complete) {
      img = enemyPlaneImage;
    } else if (this.type === 1 && enemyHeliImage.complete) {
      img = enemyHeliImage;
    } else if (this.type === 2 && fuelImage.complete) {
      img = fuelImage;
    }
    if (img) {
      ctx.drawImage(img, this.x, this.y, this.width, this.height);
    } else {
      // Fallback
      ctx.fillStyle = this.type === 2 ? '#ffff00' : '#ff0000';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }

  update() {
    this.y += this.speed;
  }
}

// Particle
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 15;
    this.vy = (Math.random() - 0.5) * 15;
    this.life = 60;
    this.color = color;
    this.size = Math.random() * 5 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.1; // Gravity
    this.life--;
    this.size *= 0.98; // Shrink
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, 4, 4);
  }
}

function resizeCanvas() {
  const maxWidth = Math.min(window.innerWidth - 20, 800);
  const maxHeight = Math.min(window.innerHeight - 100, 600);
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  canvas.style.width = maxWidth + 'px';
  canvas.style.height = maxHeight + 'px';
  // Adjust player position if needed
  player.x = Math.min(player.x, canvas.width - player.width);
  player.y = canvas.height - player.height - 10;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function createParticles(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

function update() {
  if (!gameRunning) return;

  // Update enemies
  enemies.forEach((enemy, index) => {
    enemy.update();
    if (enemy.y > canvas.height) {
      enemies.splice(index, 1);
    }
  });

  // Check collision with player
  enemies.forEach((enemy, index) => {
    if (player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y) {
      createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff0000', 30);
      gameOver();
    }
  });

  // Spawn enemies
  if (Math.random() < 0.05) {
    const rand = Math.random();
    let type;
    if (rand < 0.6) type = 0; // 60% plane
    else if (rand < 0.9) type = 1; // 30% helicopter
    else type = 2; // 10% fuel
    const enemy = new Enemy();
    enemy.type = type;
    enemies.push(enemy);
  }

  // Update bullets
  bullets.forEach((bullet, index) => {
    bullet.y -= 5;
    if (bullet.y < 0) {
      bullets.splice(index, 1);
    }
  });

  // Collision detection
  bullets.forEach((bullet, bIndex) => {
    enemies.forEach((enemy, eIndex) => {
      if (bullet.x < enemy.x + enemy.width &&
          bullet.x + 5 > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + 10 > enemy.y) {
        if (enemy.type === 2) {
          fuel = Math.min(100, fuel + 20);
          score += 5;
        } else {
          score += 10;
        }
        createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type === 2 ? '#00ff00' : '#ffff00', 20);
        enemies.splice(eIndex, 1);
        bullets.splice(bIndex, 1);
      }
    });
  });

  // Update particles
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => p.update());

  fuel -= 0.1;
  if (fuel <= 0) {
    gameOver();
  }

  // Update HUD
  document.getElementById('score').textContent = `امتیاز: ${score}`;
  document.getElementById('fuel').textContent = `سوخت: ${Math.floor(fuel)}`;

  draw();
  requestAnimationFrame(update);
}

function draw() {
  // Pixel background
  ctx.fillStyle = '#001122';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple river
  ctx.fillStyle = '#003366';
  ctx.fillRect(50, 0, canvas.width - 100, canvas.height);

  // Banks
  ctx.fillStyle = '#228B22';
  ctx.fillRect(0, 0, 50, canvas.height);
  ctx.fillRect(canvas.width - 50, 0, 50, canvas.height);

  player.draw();
  enemies.forEach(e => e.draw());
  bullets.forEach(b => {
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(b.x, b.y, 5, 10);
  });
  particles.forEach(p => p.draw());
}

function gameOver() {
  gameRunning = false;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('game-over-screen').style.display = 'block';
  document.getElementById('final-score').textContent = `امتیاز نهایی: ${score}`;

  // Send score to server
  fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: playerName, score })
  });
}

function startGame() {
  playerName = document.getElementById('player-name').value.trim();
  if (!playerName) return;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  gameRunning = true;
  score = 0;
  fuel = 100;
  enemies = [];
  bullets = [];
  particles = [];
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
        li.textContent = `${item.name}: ${item.score}`;
        list.appendChild(li);
      });
      document.getElementById('game-over-screen').style.display = 'none';
      document.getElementById('leaderboard-screen').style.display = 'block';
    });
}

// Event listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('start-btn').addEventListener('touchstart', startGame);
document.getElementById('play-again-btn').addEventListener('click', () => {
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
});
document.getElementById('play-again-btn').addEventListener('touchstart', () => {
  document.getElementById('game-over-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
});
document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('leaderboard-btn').addEventListener('touchstart', showLeaderboard);
document.getElementById('back-to-menu-btn').addEventListener('click', () => {
  document.getElementById('leaderboard-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
});
document.getElementById('back-to-menu-btn').addEventListener('touchstart', () => {
  document.getElementById('leaderboard-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
});

// Controls
document.addEventListener('keydown', (e) => {
  if (!gameRunning) return;
  if (e.key === 'ArrowLeft') player.move(-1);
  if (e.key === 'ArrowRight') player.move(1);
  if (e.key === ' ') {
    e.preventDefault();
    bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y });
  }
});

// Mobile controls
let touchStartX = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touchX = e.touches[0].clientX;
  const diff = (touchX - touchStartX) * 0.5; // Increase sensitivity
  player.move(diff);
  touchStartX = touchX;
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y });
});