// ============================================================
// Audio Reactive Visualizer – Enhanced sketch.js
// Original template preserved. All enhancements clearly marked.
// ============================================================

let defaultSong = null; // bundled asset
let song = null; // currently active sound (default or custom)
let fft = null;
let amp = null;
let peak = null;
let customSong = null; // loaded custom sound (if any)

const radBase = 70;
let rad = radBase;
let rOuter = 200;
let rotation = 0;
let particles = [];

let playerFileInputEl, demoTrackBtn, chooseTrackBtn, localFileName, playerErrorEl, replaceTrackBtn;
let playerPanel, playerClose, playPauseBtn, restartBtn, volRange, seekRange;
let muteBtn, fullscreenBtn, volumeControl;
let infoModalOverlayEl, infoModalEl, infoModalCloseBtn, infoBtn;
let sliderHideTimeoutId = null;
let volWrapEl = null;
let audioReady = false;
let selectedFile = null;
let selectedFileURL = null;
let currentVolume = 1;
let previousVolume = 1;
let isMuted = false;
let isSeeking = false;
let defaultLoadFailed = false;
let loopEnabled = false;
let loopStart = 0;
let loopEnd = null;
let draggingLoopMarker = null; // 'start', 'end', or 'region'
let isDraggingLoopMarker = false;
let activePointerId = null;
let loopRegionDragStartX = null;
let loopRegionDragStartS = null;
let loopRegionDragStartE = null;
let loopToggle, loopStartMarker, loopEndMarker, seekContainer, loopRegionEl;
// Seek position chosen while paused.
let deferredSeek = null;
// Pending start time used to keep the UI in sync when resuming from paused seek.
let pendingStartTime = null;
let pendingStartSince = null;
// track previous playing state to detect natural end-of-track transitions
let lastWasPlaying = false;
// Separate audible output from analysis so volume changes do not affect visuals.
let masterOutputGain = null;
let analysisInputGain = null;

/* Start - own code */

// ============================================================
// PHASE 1 – MULTI VISUALIZER SYSTEM
// ============================================================
let currentVisualizer = 0; // 0 = original (legacy), 1-7 = new modes
const VISUALIZER_NAMES = [
  'Radial Burst',        // 0 – original template visualizer
  'Spectrum Bars',       // 1
  'Circular Spectrum',   // 2
  'Galaxy Particle Field', // 3
  'Audio Tunnel',        // 4
  'Frequency Rings',     // 5
  'Wave Ribbon',         // 6
  'Audio Mountain',      // 7
  'Audio Mandala'        // 8
];

// ============================================================
// PHASE 5 – PROFESSIONAL THEME ENGINE
// ============================================================
let currentTheme = 0;
const THEMES = [
  { // 0 Cyberpunk
    name: 'Cyberpunk',
    bg: [5, 0, 15],
    primary: [300, 100, 100],
    secondary: [180, 100, 100],
    accent: [60, 100, 100],
    particle: [280, 90, 95],
    hudText: [300, 80, 100]
  },
  { // 1 Matrix
    name: 'Matrix',
    bg: [0, 8, 0],
    primary: [120, 100, 90],
    secondary: [130, 80, 70],
    accent: [140, 60, 100],
    particle: [120, 100, 80],
    hudText: [120, 90, 100]
  },
  { // 2 Aurora
    name: 'Aurora',
    bg: [10, 5, 20],
    primary: [170, 80, 95],
    secondary: [240, 70, 90],
    accent: [300, 60, 95],
    particle: [190, 75, 90],
    hudText: [190, 60, 100]
  },
  { // 3 Ocean
    name: 'Ocean',
    bg: [0, 15, 25],
    primary: [200, 100, 95],
    secondary: [220, 80, 80],
    accent: [180, 70, 100],
    particle: [210, 85, 90],
    hudText: [200, 70, 100]
  },
  { // 4 Firestorm
    name: 'Firestorm',
    bg: [15, 5, 5],
    primary: [15, 100, 100],
    secondary: [35, 100, 100],
    accent: [50, 100, 100],
    particle: [20, 100, 100],
    hudText: [30, 80, 100]
  },
  { // 5 Deep Space
    name: 'Deep Space',
    bg: [0, 0, 3],
    primary: [260, 80, 100],
    secondary: [220, 60, 90],
    accent: [280, 100, 100],
    particle: [240, 70, 95],
    hudText: [260, 60, 100]
  },
  { // 6 Sunset
    name: 'Sunset',
    bg: [10, 30, 10],
    primary: [30, 100, 100],
    secondary: [350, 90, 90],
    accent: [280, 70, 90],
    particle: [20, 100, 95],
    hudText: [30, 70, 100]
  },
  { // 7 Monochrome
    name: 'Monochrome',
    bg: [0, 0, 5],
    primary: [0, 0, 100],
    secondary: [0, 0, 70],
    accent: [0, 0, 50],
    particle: [0, 0, 85],
    hudText: [0, 0, 100]
  }
];

function getTheme() { return THEMES[currentTheme % THEMES.length]; }

// ============================================================
// PHASE 2 – ADVANCED AUDIO ANALYSIS
// ============================================================
let bassEnergy = 0, lowMidEnergy = 0, midEnergy = 0, highMidEnergy = 0, trebleEnergy = 0;
let smoothBass = 0, smoothMid = 0, smoothTreble = 0;
const SMOOTH = 0.15;

function updateAudioBands() {
  if (!fft || !audioReady) return;
  bassEnergy     = fft.getEnergy('bass');
  lowMidEnergy   = fft.getEnergy('lowMid');
  midEnergy      = fft.getEnergy('mid');
  highMidEnergy  = fft.getEnergy('highMid');
  trebleEnergy   = fft.getEnergy('treble');
  // smooth for display
  smoothBass   = lerp(smoothBass,   bassEnergy   / 255, SMOOTH);
  smoothMid    = lerp(smoothMid,    midEnergy    / 255, SMOOTH);
  smoothTreble = lerp(smoothTreble, trebleEnergy / 255, SMOOTH);
}

// ============================================================
// PHASE 3 – BEAT DETECTION SYSTEM
// ============================================================
let beatActive = false;
let beatCooldown = 0;
let shockwaves = [];
let beatFlash = 0;

function detectBeat(level) {
  if (!peak) return;
  if (peak.isDetected && beatCooldown <= 0) {
    beatActive = true;
    beatCooldown = 8;
    beatFlash = 1.0;
    // spawn shockwave at center
    shockwaves.push({ r: 0, maxR: min(width, height) * 0.8, alpha: 255, speed: 8 });
    // burst advanced particles
    spawnBurstParticles(width / 2, height / 2, 18);
  } else {
    beatActive = false;
  }
  if (beatCooldown > 0) beatCooldown--;
  beatFlash = max(0, beatFlash - 0.06);
}

function updateShockwaves() {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.r += s.speed + smoothBass * 10;
    s.alpha -= 6;
    if (s.alpha <= 0 || s.r > s.maxR) shockwaves.splice(i, 1);
  }
}

function drawShockwaves() {
  const t = getTheme();
  push();
  translate(width / 2, height / 2);
  noFill();
  for (const s of shockwaves) {
    strokeWeight(2.5);
    stroke(t.primary[0], t.primary[1], t.primary[2], s.alpha);
    ellipse(0, 0, s.r * 2, s.r * 2);
    strokeWeight(1);
    stroke(t.accent[0], t.accent[1], t.accent[2], s.alpha * 0.5);
    ellipse(0, 0, (s.r - 12) * 2, (s.r - 12) * 2);
  }
  pop();
}

// ============================================================
// PHASE 4 – ADVANCED PARTICLE ENGINE
// ============================================================
class AdvParticle {
  constructor(x, y, vx, vy, hue, isBurst) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.ax = 0; this.ay = 0;
    this.hue = hue;
    this.sat = isBurst ? 100 : random(60, 90);
    this.bri = isBurst ? 100 : random(75, 95);
    this.alpha = isBurst ? 240 : random(140, 210);
    this.size = isBurst ? random(3, 8) : random(1.5, 5.5);
    this.life = 1.0;
    this.decay = isBurst ? random(0.018, 0.035) : random(0.004, 0.012);
    this.trail = [];
    this.maxTrail = isBurst ? 6 : 3;
    this.isBurst = isBurst;
  }
  update(bassE) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();
    const gravFactor = this.isBurst ? 0.04 : 0;
    this.ay = gravFactor;
    if (!this.isBurst) {
      // audio-reactive drift
      this.ax = sin(frameCount * 0.02 + this.x * 0.01) * (bassE / 255) * 0.3;
    }
    this.vx += this.ax;
    this.vy += this.ay;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    this.alpha = this.life * (this.isBurst ? 240 : 180);
    // hue shift over time
    this.hue = (this.hue + 0.4) % 360;
  }
  draw() {
    if (this.life <= 0) return;
    push();
    noStroke();
    // draw trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const tAlpha = (i / this.trail.length) * this.alpha * 0.4;
      fill(this.hue, this.sat, this.bri, tAlpha);
      const ts = this.size * (i / this.trail.length) * 0.7;
      ellipse(t.x, t.y, ts, ts);
    }
    // glow outer ring
    fill(this.hue, this.sat * 0.6, this.bri, this.alpha * 0.2);
    ellipse(this.x, this.y, this.size * 3.2, this.size * 3.2);
    // core
    fill(this.hue, this.sat, this.bri, this.alpha);
    ellipse(this.x, this.y, this.size, this.size);
    pop();
  }
  isDead() { return this.life <= 0; }
}

let advParticles = [];
const MAX_ADV_PARTICLES = 280;

function spawnBurstParticles(cx, cy, count) {
  const t = getTheme();
  for (let i = 0; i < count; i++) {
    if (advParticles.length >= MAX_ADV_PARTICLES) break;
    const angle = random(TWO_PI);
    const speed = random(2, 9);
    const vx = cos(angle) * speed;
    const vy = sin(angle) * speed;
    const h = (t.particle[0] + random(-40, 40) + 360) % 360;
    advParticles.push(new AdvParticle(cx, cy, vx, vy, h, true));
  }
}

function spawnAmbientParticle() {
  if (advParticles.length >= MAX_ADV_PARTICLES) return;
  const t = getTheme();
  const edge = floor(random(4));
  let x, y, vx, vy;
  const speed = random(0.3, 1.5) * (1 + smoothBass);
  if (edge === 0) { x = random(width); y = 0; vx = random(-0.5, 0.5); vy = speed; }
  else if (edge === 1) { x = width; y = random(height); vx = -speed; vy = random(-0.5, 0.5); }
  else if (edge === 2) { x = random(width); y = height; vx = random(-0.5, 0.5); vy = -speed; }
  else { x = 0; y = random(height); vx = speed; vy = random(-0.5, 0.5); }
  const h = (t.particle[0] + random(-50, 50) + 360) % 360;
  advParticles.push(new AdvParticle(x, y, vx, vy, h, false));
}

function updateAndDrawAdvParticles() {
  // spawn a few per frame based on audio
  if (frameCount % max(1, floor(4 - smoothBass * 3)) === 0) spawnAmbientParticle();
  for (let i = advParticles.length - 1; i >= 0; i--) {
    const p = advParticles[i];
    p.update(bassEnergy);
    p.draw();
    if (p.isDead()) advParticles.splice(i, 1);
  }
}

// ============================================================
// PHASE 7 – PROFESSIONAL HUD
// ============================================================
let showHUD = true;
let hudFPS = 60;
let hudFPSTimer = 0;
let hudFrameCount = 0;

function drawHUD() {
  if (!showHUD) return;
  const t = getTheme();
  const fps = frameRate ? frameRate() : 60;
  push();
  colorMode(HSB, 360, 100, 100, 255);
  const pad = 18;
  const x = pad;
  let y = pad + 14;
  const lineH = 19;

  // background panel
  noStroke();
  fill(0, 0, 5, 190);
  rect(pad - 8, pad - 6, 172, 9 * lineH + 10, 8);

  // text style
  textSize(11);
  textFont('monospace');
  textAlign(LEFT, TOP);

  const draw2Col = (label, val) => {
    fill(t.hudText[0], t.hudText[1] * 0.5, t.hudText[2] * 0.6, 200);
    text(label, x, y);
    fill(t.hudText[0], t.hudText[1], t.hudText[2], 240);
    text(val, x + 90, y);
    y += lineH;
  };

  // divider line
  stroke(t.hudText[0], 40, 40, 80);
  strokeWeight(0.5);
  line(x - 8, y + lineH - 4, x + 164, y + lineH - 4);
  noStroke();

  draw2Col('VISUALIZER', VISUALIZER_NAMES[currentVisualizer]);
  draw2Col('THEME', getTheme().name);
  draw2Col('FPS', nf(fps, 1, 0));
  draw2Col('BASS', nf(smoothBass * 100, 1, 0) + '%');
  draw2Col('MID', nf(smoothMid * 100, 1, 0) + '%');
  draw2Col('TREBLE', nf(smoothTreble * 100, 1, 0) + '%');
  draw2Col('PARTICLES', advParticles.length + particles.length);

  pop();
}

// ============================================================
// PHASE 8 – INTERACTION SYSTEM (keyboard)
// ============================================================
let showHelp = false;

function drawHelpOverlay() {
  if (!showHelp) return;
  push();
  colorMode(HSB, 360, 100, 100, 255);
  const t = getTheme();
  const w = min(420, width - 40);
  const h = 320;
  const x = (width - w) / 2;
  const y = (height - h) / 2;

  // backdrop
  fill(0, 0, 3, 230);
  noStroke();
  rect(x, y, w, h, 12);
  stroke(t.primary[0], t.primary[1], t.primary[2], 80);
  strokeWeight(1);
  noFill();
  rect(x, y, w, h, 12);
  noStroke();

  fill(t.primary[0], t.primary[1], t.primary[2], 255);
  textSize(16);
  textFont('monospace');
  textAlign(CENTER, TOP);
  text('KEYBOARD CONTROLS', x + w / 2, y + 18);

  textSize(12);
  textAlign(LEFT, TOP);
  const col = x + 26;
  let row = y + 52;
  const LH = 24;
  const keys = [
    ['1 – 8', 'Switch visualizer'],
    ['T', 'Cycle theme'],
    ['H', 'Toggle help overlay'],
    ['S', 'Save screenshot'],
    ['F', 'Toggle fullscreen'],
    ['SPACE', 'Play / Pause'],
    ['U', 'Toggle HUD'],
  ];
  for (const [key, desc] of keys) {
    fill(t.accent[0], t.accent[1], t.accent[2], 240);
    text(key, col, row);
    fill(t.hudText[0], t.hudText[1] * 0.6, t.hudText[2] * 0.9, 220);
    text(desc, col + 90, row);
    row += LH;
  }

  fill(t.hudText[0], 30, 60, 160);
  textAlign(CENTER, BOTTOM);
  textSize(11);
  text('Press H to close', x + w / 2, y + h - 14);
  pop();
}

// ============================================================
// VISUALIZER 1 – ENHANCED SPECTRUM BARS
// ============================================================
function drawSpectrumBars(spectrum) {
  const t = getTheme();
  const barCount = 128;
  const barW = width / barCount;
  const maxH = height * 0.75;

  push();
  colorMode(HSB, 360, 100, 100, 255);
  noStroke();
  for (let i = 0; i < barCount; i++) {
    const idx = floor(map(i, 0, barCount, 0, spectrum.length));
    const val = spectrum[idx] / 255;
    const bh = val * maxH;
    const hue = (t.primary[0] + i * 2.8 + frameCount * 0.3) % 360;
    const sat = t.primary[1];
    const bri = t.primary[2];

    // mirror bottom
    fill(hue, sat, bri, 200);
    rect(i * barW, height - bh, barW - 1, bh);
    // reflection fade
    fill(hue, sat, bri * 0.5, 80);
    rect(i * barW, height, barW - 1, -bh * 0.3);
    // top cap glow
    fill(hue, sat * 0.6, 100, 200);
    rect(i * barW, height - bh - 3, barW - 1, 3);
  }
  pop();

  // beat flash overlay
  if (beatFlash > 0) {
    push();
    colorMode(HSB, 360, 100, 100, 255);
    noStroke();
    fill(t.accent[0], t.accent[1], t.accent[2], beatFlash * 40);
    rect(0, 0, width, height);
    pop();
  }
}

// ============================================================
// VISUALIZER 2 – CIRCULAR SPECTRUM
// ============================================================
function drawCircularSpectrum(spectrum) {
  const t = getTheme();
  const cx = width / 2, cy = height / 2;
  const innerR = min(width, height) * 0.15;
  const outerMax = min(width, height) * 0.42;

  push();
  colorMode(HSB, 360, 100, 100, 255);
  translate(cx, cy);
  rotate(frameCount * 0.003);

  const count = 256;
  for (let i = 0; i < count; i++) {
    const idx = floor(map(i, 0, count, 0, spectrum.length));
    const val = spectrum[idx] / 255;
    const angle = map(i, 0, count, 0, TWO_PI);
    const r2 = innerR + val * (outerMax - innerR);
    const hue = (t.primary[0] + i * 1.4 + frameCount * 0.2) % 360;
    strokeWeight(lerp(1, 3, val));
    stroke(hue, t.primary[1], t.primary[2], 200);
    const x1 = cos(angle) * innerR;
    const y1 = sin(angle) * innerR;
    const x2 = cos(angle) * r2;
    const y2 = sin(angle) * r2;
    line(x1, y1, x2, y2);
  }
  // center glow
  noStroke();
  fill(t.secondary[0], t.secondary[1], t.secondary[2], 80 + smoothBass * 100);
  ellipse(0, 0, innerR * 2 + smoothBass * 20, innerR * 2 + smoothBass * 20);
  fill(t.primary[0], t.primary[1], 100, 200);
  ellipse(0, 0, 8, 8);
  pop();
}

// ============================================================
// VISUALIZER 3 – GALAXY PARTICLE FIELD
// ============================================================
let galaxyParticles = [];
function initGalaxyParticles() {
  galaxyParticles = [];
  const count = 600;
  for (let i = 0; i < count; i++) {
    const angle = random(TWO_PI);
    const r = random(20, min(width, height) * 0.5);
    const armOffset = floor(random(3)) * (TWO_PI / 3);
    const spiral = angle + r * 0.008 + armOffset;
    galaxyParticles.push({
      angle: spiral, r,
      baseR: r,
      speed: random(0.001, 0.004) * (r < 100 ? 3 : 1),
      size: random(1, 4),
      hue: random(360),
      brightness: random(60, 100),
      phase: random(1000)
    });
  }
}
function drawGalaxyParticleField() {
  const t = getTheme();
  push();
  colorMode(HSB, 360, 100, 100, 255);
  translate(width / 2, height / 2);
  noStroke();
  for (const p of galaxyParticles) {
    p.angle += p.speed * (1 + smoothBass * 2);
    const pulse = 1 + sin(frameCount * 0.05 + p.phase) * 0.15 * smoothMid;
    const pr = p.baseR * pulse + smoothBass * 15;
    const px = cos(p.angle) * pr;
    const py = sin(p.angle) * pr * 0.55;
    const hue = (t.particle[0] + p.hue * 0.3 + frameCount * 0.1) % 360;
    const alpha = map(pr, 0, min(width, height) * 0.5, 220, 80);
    fill(hue, t.primary[1] * 0.8, p.brightness, alpha);
    const s = p.size * (1 + smoothBass * 1.5);
    ellipse(px, py, s, s);
  }
  pop();
}

// ============================================================
// VISUALIZER 4 – AUDIO TUNNEL
// ============================================================
function drawAudioTunnel(spectrum) {
  const t = getTheme();
  push();
  colorMode(HSB, 360, 100, 100, 255);
  translate(width / 2, height / 2);
  const rings = 28;
  const maxR = min(width, height) * 0.52;
  noFill();
  for (let r = rings; r >= 0; r--) {
    const fraction = r / rings;
    const radius = fraction * maxR;
    const idx = floor(map(fraction, 0, 1, 0, spectrum.length * 0.5));
    const energy = spectrum[idx] / 255;
    const distort = energy * radius * 0.22;
    const hue = (t.primary[0] + r * 12 + frameCount * 0.5) % 360;
    const alpha = map(fraction, 0, 1, 240, 60);
    strokeWeight(lerp(2.5, 0.5, fraction));
    stroke(hue, t.primary[1], t.primary[2], alpha);
    // slightly elliptical to create perspective
    const rx = radius + distort;
    const ry = radius * 0.6 + distort * 0.6;
    ellipse(0, 0, rx * 2, ry * 2);
  }
  // center vanishing point
  noStroke();
  fill(t.primary[0], t.primary[1], 100, 200);
  ellipse(0, 0, 6 + smoothBass * 10, 6 + smoothBass * 10);
  pop();
}

// ============================================================
// VISUALIZER 5 – FREQUENCY RINGS
// ============================================================
function drawFrequencyRings(spectrum) {
  const t = getTheme();
  push();
  colorMode(HSB, 360, 100, 100, 255);
  translate(width / 2, height / 2);
  const ringCount = 8;
  const step = floor(spectrum.length / ringCount);
  noFill();
  for (let ri = 0; ri < ringCount; ri++) {
    const bandStart = ri * step;
    const bandEnd = bandStart + step;
    let avg = 0;
    for (let k = bandStart; k < bandEnd; k++) avg += spectrum[k];
    avg /= step;
    const fraction = avg / 255;
    const baseR = map(ri, 0, ringCount, 40, min(width, height) * 0.46);
    const r = baseR + fraction * 60;
    const hue = (t.primary[0] + ri * 45 + frameCount * 0.4) % 360;
    const alpha = 100 + fraction * 155;
    strokeWeight(1.5 + fraction * 3);
    stroke(hue, t.primary[1], t.primary[2], alpha);
    ellipse(0, 0, r * 2, r * 2);
    // dots on ring
    const dotCount = 24 + ri * 8;
    noStroke();
    for (let d = 0; d < dotCount; d++) {
      const ang = map(d, 0, dotCount, 0, TWO_PI) + frameCount * 0.01 * (ri % 2 === 0 ? 1 : -1);
      const dx = cos(ang) * r;
      const dy = sin(ang) * r;
      fill(hue, t.primary[1] * 0.7, 100, fraction * 200);
      ellipse(dx, dy, 3 + fraction * 4, 3 + fraction * 4);
    }
    stroke(hue, t.primary[1], t.primary[2], alpha * 0.5);
    noFill();
  }
  pop();
}

// ============================================================
// VISUALIZER 6 – WAVE RIBBON
// ============================================================
function drawWaveRibbon(waveform) {
  const t = getTheme();
  push();
  colorMode(HSB, 360, 100, 100, 255);
  noFill();
  const ribbonCount = 5;
  for (let ri = 0; ri < ribbonCount; ri++) {
    const yBase = height / 2 + (ri - ribbonCount / 2) * (height * 0.12);
    const amp2 = height * 0.18 * (1 + smoothBass * 0.8);
    const speed = (ri + 1) * 0.5;
    const hue = (t.primary[0] + ri * 30 + frameCount * 0.3) % 360;
    strokeWeight(lerp(3, 0.8, ri / ribbonCount));
    stroke(hue, t.primary[1], t.primary[2], 200 - ri * 20);
    beginShape();
    for (let i = 0; i <= width; i += 3) {
      const idx = floor(map(i, 0, width, 0, waveform.length));
      const sample = waveform[idx] || 0;
      const y = yBase + sample * amp2 + sin(i * 0.01 + frameCount * 0.04 * speed) * 20 * smoothMid;
      curveVertex(i, y);
    }
    endShape();
  }
  // floating glow particles along the primary ribbon
  noStroke();
  const glowCount = 30;
  for (let g = 0; g < glowCount; g++) {
    const ix = floor(map(g, 0, glowCount, 0, waveform.length));
    const sample = waveform[ix] || 0;
    const gx = map(g, 0, glowCount, 0, width);
    const gy = height / 2 + sample * height * 0.18;
    const hue2 = (t.accent[0] + frameCount * 0.5 + g * 12) % 360;
    fill(hue2, 100, 100, abs(sample) * 200 + 40);
    ellipse(gx, gy, 5 + abs(sample) * 12, 5 + abs(sample) * 12);
  }
  pop();
}

// ============================================================
// VISUALIZER 7 – AUDIO MOUNTAIN
// ============================================================
function drawAudioMountain(spectrum) {
  const t = getTheme();
  const layers = 5;
  push();
  colorMode(HSB, 360, 100, 100, 255);
  for (let l = layers; l >= 0; l--) {
    const fraction = l / layers;
    const yBase = height * (0.55 + fraction * 0.25);
    const hue = (t.secondary[0] + l * 25 + frameCount * 0.2) % 360;
    const alpha = 180 - l * 20;
    fill(hue, t.primary[1] * (0.4 + fraction * 0.6), t.primary[2] * (0.5 + fraction * 0.5), alpha);
    noStroke();
    beginShape();
    vertex(0, height);
    for (let i = 0; i <= width; i += 4) {
      const idx = floor(map(i, 0, width, 0, spectrum.length * 0.6));
      const val = spectrum[idx] / 255;
      const mountainH = val * height * (0.35 + fraction * 0.2) * (1 + smoothBass * 0.5);
      const noise2 = sin(i * 0.005 + frameCount * 0.01 + l * 0.5) * 15;
      vertex(i, yBase - mountainH + noise2);
    }
    vertex(width, height);
    endShape(CLOSE);
    // rim glow
    noFill();
    stroke(hue, t.primary[1], 100, 120);
    strokeWeight(1.5);
    beginShape();
    for (let i = 0; i <= width; i += 4) {
      const idx = floor(map(i, 0, width, 0, spectrum.length * 0.6));
      const val = spectrum[idx] / 255;
      const mountainH = val * height * (0.35 + fraction * 0.2) * (1 + smoothBass * 0.5);
      const noise2 = sin(i * 0.005 + frameCount * 0.01 + l * 0.5) * 15;
      vertex(i, yBase - mountainH + noise2);
    }
    endShape();
  }
  pop();
}

// ============================================================
// VISUALIZER 8 – AUDIO MANDALA
// ============================================================
function drawAudioMandala(spectrum, waveform) {
  const t = getTheme();
  push();
  colorMode(HSB, 360, 100, 100, 255);
  translate(width / 2, height / 2);
  const symmetry = 12;
  const slice = TWO_PI / symmetry;
  const maxR = min(width, height) * 0.44;

  for (let s = 0; s < symmetry; s++) {
    push();
    rotate(s * slice + frameCount * 0.005);
    // primary petal
    noFill();
    const count = 80;
    for (let i = 0; i < count; i++) {
      const idx = floor(map(i, 0, count, 0, spectrum.length * 0.5));
      const val = spectrum[idx] / 255;
      const r = map(i, 0, count, 8, maxR);
      const w2 = val * 28 + smoothBass * 18;
      const hue = (t.primary[0] + i * 2.2 + frameCount * 0.3) % 360;
      const ang1 = -w2 * 0.012;
      const ang2 = w2 * 0.012;
      stroke(hue, t.primary[1], t.primary[2], 160 - i * 1.5);
      strokeWeight(0.8 + val * 2);
      line(cos(ang1) * r, sin(ang1) * r, cos(ang2) * r * (1 + val * 0.1), sin(ang2) * r * (1 + val * 0.1));
    }
    // inner decorative arc using waveform
    noFill();
    stroke(t.secondary[0], t.secondary[1], t.secondary[2], 100);
    strokeWeight(1.2);
    beginShape();
    for (let i = 0; i < 40; i++) {
      const wIdx = floor(map(i, 0, 40, 0, waveform.length / symmetry));
      const sample = waveform[wIdx] || 0;
      const r = map(i, 0, 40, 15, maxR * 0.35) + sample * 30;
      const ang = map(i, 0, 40, -slice / 2, slice / 2);
      curveVertex(cos(ang) * r, sin(ang) * r);
    }
    endShape();
    pop();
  }
  // center
  noStroke();
  fill(t.primary[0], t.primary[1], t.primary[2], 200 + smoothBass * 55);
  ellipse(0, 0, 14 + smoothBass * 20, 14 + smoothBass * 20);
  fill(t.accent[0], t.accent[1], 100, 255);
  ellipse(0, 0, 6, 6);
  pop();
}

// ============================================================
// PHASE 9 – SCREENSHOT EXPORT
// ============================================================
function saveScreenshot() {
  const ts = year() + nf(month(), 2) + nf(day(), 2) + '_' + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
  saveCanvas('visualizer_' + ts, 'png');
}

// ============================================================
// PHASE 10 – BACKGROUND WITH THEME + TRAILS
// ============================================================
function drawBackground() {
  const t = getTheme();
  push();
  colorMode(RGB, 255);
  noStroke();
  // theme-tinted trail
  const [r2, g, b] = t.bg;
  fill(r2, g, b, 210);
  rect(0, 0, width, height);
  // subtle beat flash
  if (beatFlash > 0) {
    const t2 = getTheme();
    colorMode(HSB, 360, 100, 100, 255);
    fill(t2.accent[0], t2.accent[1], t2.accent[2], beatFlash * 25);
    rect(0, 0, width, height);
  }
  pop();
}

/* End - own code */

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 255);

  // Create analyzers and bind them after the source is ready.
  fft = new p5.FFT(0.9, 1024);
  amp = new p5.Amplitude();
  peak = new p5.PeakDetect(20, 20000, 0.15, 20);

  // Route audio through separate gains for playback and analysis.
  try{
    masterOutputGain = new p5.Gain();
    analysisInputGain = new p5.Gain();
    // Keep the analysis path silent.
    try{ analysisInputGain.disconnect(); }catch(_){ }
    // Connect the audible output gain and set its initial level.
    try{ masterOutputGain.connect(); masterOutputGain.amp(currentVolume); }catch(_){ }
  }catch(_){ masterOutputGain = null; analysisInputGain = null; }

  playerFileInputEl = document.getElementById('playerFileInput');
  demoTrackBtn = document.getElementById('demoTrackBtn');
  chooseTrackBtn = document.getElementById('chooseTrackBtn');
  localFileName = document.getElementById('localFileName');
  playerErrorEl = document.getElementById('playerError');

  replaceTrackBtn = document.getElementById('replaceTrackBtn');

  playerPanel = document.getElementById('playerPanel');
  playerClose = document.getElementById('playerClose');
  playPauseBtn = document.getElementById('playPauseBtn');
  restartBtn = document.getElementById('restartBtn');
  volRange = document.getElementById('volRange');
  muteBtn = document.getElementById('muteBtn');
  fullscreenBtn = document.getElementById('fullscreenBtn');
  volumeControl = document.getElementById('volumeControl');
  seekRange = document.getElementById('seekRange');

  playerFileInputEl && playerFileInputEl.addEventListener('change', onPlayerFileSelected);
  demoTrackBtn && demoTrackBtn.addEventListener('click', (e)=>{ e.stopPropagation(); e.currentTarget.blur && e.currentTarget.blur(); switchActiveSource('bundled'); });
  chooseTrackBtn && chooseTrackBtn.addEventListener('click', (e)=>{ e.stopPropagation(); e.currentTarget.blur && e.currentTarget.blur(); if (customSong){ switchActiveSource('local'); } else if (playerFileInputEl){ playerFileInputEl.value = ''; playerFileInputEl.click(); } });

  replaceTrackBtn && replaceTrackBtn.addEventListener('click', (e)=>{ e.stopPropagation(); e.currentTarget.blur && e.currentTarget.blur(); if (playerFileInputEl){ playerFileInputEl.value = ''; playerFileInputEl.click(); } });

  playerClose && playerClose.addEventListener('click', (e)=>{ e.stopPropagation(); hidePlayer(); });
  playerPanel && playerPanel.addEventListener('click', (e)=>{ e.stopPropagation(); });
  playPauseBtn && playPauseBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (typeof hideInfoModal === 'function') hideInfoModal(); togglePlayPause(); });
  restartBtn && restartBtn.addEventListener('click', (e)=>{ e.stopPropagation(); restartSong(); });

  volRange && volRange.addEventListener('input', (e)=>{ e.stopPropagation(); const v = parseFloat(e.target.value); changeVolume(v); if (v > 0 && isMuted){ isMuted = false; updateMuteUI(); } if (v === 0 && !isMuted){ isMuted = true; updateMuteUI(); } });
  muteBtn && muteBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleMute(); showVolumeSliderTemporary(); });
  fullscreenBtn && fullscreenBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleFullscreen(); });

  infoModalOverlayEl = document.getElementById('infoModalOverlay');
  infoModalEl = document.getElementById('infoModal');
  infoModalCloseBtn = document.getElementById('infoModalClose');
  infoBtn = document.getElementById('infoBtn');

  if (infoBtn) infoBtn.addEventListener('click', (e)=>{ e.stopPropagation(); showInfoModal(); });
  if (infoModalOverlayEl){
    infoModalOverlayEl.addEventListener('click', (e)=>{ e.stopPropagation(); hideInfoModal(); });
    if (infoModalEl) infoModalEl.addEventListener('click', (e)=>{ e.stopPropagation(); });
  }
  if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', (e)=>{ e.stopPropagation(); hideInfoModal(); });

  if (seekRange){
    seekRange.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); isSeeking = true; });
    seekRange.addEventListener('input', (e)=>{
      e.stopPropagation();
      const v = parseFloat(e.target.value);
      if (isSeeking){
        previewSeekTime(v);
      } else {
        seekTo(v);
      }
    });
    seekRange.addEventListener('pointerup', (e)=>{ e.stopPropagation(); if (isSeeking){ isSeeking = false; seekTo(parseFloat(e.target.value)); } });
    window.addEventListener('pointerup', (e)=>{ if (isSeeking && !isDraggingLoopMarker){ isSeeking = false; if (seekRange) seekTo(parseFloat(seekRange.value)); } });
  }

  document.addEventListener('click', onDocumentClick);

  loopToggle = document.getElementById('loopToggle');
  loopStartMarker = document.getElementById('loopStartMarker');
  loopEndMarker = document.getElementById('loopEndMarker');
  seekContainer = document.querySelector('.seek-container');

  if (loopToggle) loopToggle.addEventListener('click', (e)=>{ e.stopPropagation(); toggleLoop(); });

  document.addEventListener('fullscreenchange', ()=>{
    if (!fullscreenBtn) return;
    const isFS = !!document.fullscreenElement;
    fullscreenBtn.setAttribute('aria-pressed', isFS ? 'true' : 'false');
    updateFullscreenIcon(isFS);
    updateFullscreenLabel(isFS);
  });

  updateMuteUI();
  updatePlayUI();
  updateFullscreenIcon(!!document.fullscreenElement);
  updateFullscreenLabel(!!document.fullscreenElement);
  if (loopToggle) updateLoopIcon(!!loopEnabled);
  if (restartBtn) restartBtn.innerHTML = restartIconSVG();

  volWrapEl = document.querySelector('.volume-slider-wrap');
  if (volWrapEl){
    volWrapEl.addEventListener('pointerdown', (ev)=>{ ev.stopPropagation(); showVolumeSliderTemporary(); });
    volWrapEl.addEventListener('pointerup', (ev)=>{ ev.stopPropagation(); scheduleHideSlider(1200); });
  }

  const onMarkerPointerDown = (e)=>{
    // only allow dragging when loop mode is enabled
    if (!loopEnabled) return;
    e.stopPropagation(); e.preventDefault();
    draggingLoopMarker = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.marker;
    isDraggingLoopMarker = true;
    // pause seek syncing while dragging a loop marker
    isSeeking = true;
    activePointerId = e.pointerId;
    try{ e.currentTarget.setPointerCapture(activePointerId); }catch(_){ }
  };
  if (loopStartMarker) loopStartMarker.addEventListener('pointerdown', onMarkerPointerDown);
  if (loopEndMarker) loopEndMarker.addEventListener('pointerdown', onMarkerPointerDown);

  // Loop region element: allow dragging the whole block
  loopRegionEl = document.getElementById('loopRegion');
  if (loopRegionEl){
    loopRegionEl.addEventListener('pointerdown', (e)=>{
      if (!loopEnabled) return;
      e.stopPropagation(); e.preventDefault();
      draggingLoopMarker = 'region';
      isDraggingLoopMarker = true;
      isSeeking = true;
      activePointerId = e.pointerId;
      loopRegionDragStartX = e.clientX;
      loopRegionDragStartS = loopStart;
      loopRegionDragStartE = loopEnd;
      loopRegionEl.classList.add('dragging');
      try{ loopRegionEl.setPointerCapture(activePointerId); }catch(_){ }
    });
  }

  window.addEventListener('pointermove', (e)=>{
    if (!isDraggingLoopMarker || !draggingLoopMarker || !seekContainer) return;
    const rect = seekContainer.getBoundingClientRect();
    const d = (song && typeof song.duration === 'function') ? song.duration() : null;
    if (!d || isNaN(d)) return;

    if (draggingLoopMarker === 'region'){
      // drag the whole loop block, preserving duration
      const duration = loopRegionDragStartE - loopRegionDragStartS;
      const deltaX = e.clientX - loopRegionDragStartX;
      const deltaFrac = deltaX / rect.width;
      const deltaTime = deltaFrac * d;
      let newStart = loopRegionDragStartS + deltaTime;
      let newEnd = loopRegionDragStartE + deltaTime;
      // clamp within track bounds
      if (newStart < 0){ newStart = 0; newEnd = duration; }
      if (newEnd > d){ newEnd = d; newStart = d - duration; }
      loopStart = Math.max(0, newStart);
      loopEnd = Math.min(d, newEnd);
    } else {
      let frac = (e.clientX - rect.left) / rect.width;
      frac = Math.max(0, Math.min(1, frac));
      const t = frac * d;
      if (draggingLoopMarker === 'start'){
        loopStart = Math.min(t, loopEnd || d);
        if (loopStart < 0) loopStart = 0;
      } else {
        loopEnd = Math.max(t, loopStart || 0);
        if (loopEnd > d) loopEnd = d;
      }
    }
    syncLoopUI();
  });

  window.addEventListener('pointerup', (e)=>{
    if (!isDraggingLoopMarker) return;
    try{
      if (draggingLoopMarker === 'start' && loopStartMarker) loopStartMarker.releasePointerCapture(activePointerId);
      if (draggingLoopMarker === 'end' && loopEndMarker) loopEndMarker.releasePointerCapture(activePointerId);
      if (draggingLoopMarker === 'region' && loopRegionEl){ loopRegionEl.releasePointerCapture(activePointerId); loopRegionEl.classList.remove('dragging'); }
    }catch(_){ }
    isDraggingLoopMarker = false;
    isSeeking = false;
    draggingLoopMarker = null;
    activePointerId = null;
    loopRegionDragStartX = null;
    loopRegionDragStartS = null;
    loopRegionDragStartE = null;
    // After finishing a loop drag, ensure the current position lies inside
    // the newly-edited loop. If it is outside, move to `loopStart` once.
    try{ enforceLoopContainment(); }catch(_){ }
  });

  strokeCap(ROUND);

  // load bundled audio; allow custom file as fallback
  loadSound('assets/audio/song.mp3', (s) => {
    defaultSong = s;
    // do not auto-loop or auto-play; make bundled track available as default source
    if (!song){
      song = defaultSong;
      // route the loaded song through our gain nodes and point analyzers
      connectSongToGains(song);
      applyCurrentVolumeToSong();
      try{ loopEnabled = false; resetLoopRangeForTrack(song.duration()); }catch(_){ }
      updateSourceOptions();
    }
    audioReady = true;
  }, (err) => {
    console.error('Audio load failed', err);
    defaultLoadFailed = true;
    if (playerErrorEl){ playerErrorEl.textContent = 'Failed to load bundled audio. You can choose a local file.'; playerErrorEl.classList.remove('hidden'); }
  });

  // precompute loose particle positions for spread effect
  buildParticles();

  /* Start - own code */
  // Initialize advanced systems
  initGalaxyParticles();
  /* End - own code */

  updateRadii();

  // revoke any created object URLs on page unload to be defensive
  window.addEventListener('beforeunload', ()=>{
    // attempt a safe cleanup of any custom audio resources and object URLs
    try{ cleanupCustomAudioResources(true); }catch(e){}
  });

  // prevent spacebar page scroll and wire robust toggling
  window.addEventListener('keydown', (e) => {
    /* Start - own code */
    // Prevent default for all our shortcut keys
    const handled = ['Space','KeyT','KeyS','KeyF','KeyH','KeyU','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8'].includes(e.code);
    if (handled && !e.repeat) e.preventDefault();

    if (e.code === 'Space' && !e.repeat) {
      handleSpaceToggle();
      return;
    }

    if (e.repeat) return;

    // Visualizer switching 1–8
    if (e.code === 'Digit1') { currentVisualizer = 0; return; }
    if (e.code === 'Digit2') { currentVisualizer = 1; return; }
    if (e.code === 'Digit3') { currentVisualizer = 2; return; }
    if (e.code === 'Digit4') { currentVisualizer = 3; return; }
    if (e.code === 'Digit5') { currentVisualizer = 4; return; }
    if (e.code === 'Digit6') { currentVisualizer = 5; return; }
    if (e.code === 'Digit7') { currentVisualizer = 6; return; }
    if (e.code === 'Digit8') { currentVisualizer = 7; return; }

    // Theme cycling
    if (e.code === 'KeyT') { currentTheme = (currentTheme + 1) % THEMES.length; return; }

    // Screenshot
    if (e.code === 'KeyS') { saveScreenshot(); return; }

    // Fullscreen
    if (e.code === 'KeyF') { toggleFullscreen(); return; }

    // Help overlay
    if (e.code === 'KeyH') { showHelp = !showHelp; return; }

    // HUD toggle
    if (e.code === 'KeyU') { showHUD = !showHUD; return; }
    /* End - own code */
  }, {passive: false});

  // ensure the player is visible and open on initial load
  showPlayer();
  // show introductory info modal on initial load
  try{ showInfoModal(); }catch(_){ }
  // align UI anchors and size the seek track to match the compact time display
  try{ alignPlayingWithPlayButton(); updateSeekWidth(); watchTimeDisplay(); }catch(_){ }
}

// Safely dispose a p5.SoundFile.
function safeDisposeSoundFile(sf){
  if (!sf) return;
  try{ if (sf.isPlaying && sf.isPlaying()) sf.stop(); }catch(e){}
  try{ if (typeof sf.disconnect === 'function') sf.disconnect(); }catch(e){}
  try{ if (typeof sf.dispose === 'function') sf.dispose(); }catch(e){}
}

// Cleanup custom audio and revoke object URL.
function cleanupCustomAudioResources(revokeURL = true){
  if (customSong){
    try{ safeDisposeSoundFile(customSong); }catch(e){}
    customSong = null;
  }
  if (revokeURL && selectedFileURL){
    try{ URL.revokeObjectURL(selectedFileURL); }catch(e){}
    selectedFileURL = null;
    selectedFile = null;
  }
  try{ updateSourceOptions(); }catch(e){}
  // reset loop state when custom audio resources are removed
  loopEnabled = false;
  loopStart = 0;
  loopEnd = null;
  // clear any pending deferred seek when audio resources change
  deferredSeek = null;
  try{ syncLoopUI(); }catch(_){ }
}

// Route audio through separate gains for playback and analysis.
function connectSongToGains(s){
  if (!s) return;
  try{ s.disconnect(); }catch(_){ }
  try{
    if (masterOutputGain && typeof s.connect === 'function') s.connect(masterOutputGain);
    if (analysisInputGain && typeof s.connect === 'function') s.connect(analysisInputGain);
  }catch(_){ }
  // point analyzers to the analysis input so visuals ignore master volume
  try{ if (fft && analysisInputGain) fft.setInput(analysisInputGain); }catch(_){ }
  try{ if (amp && analysisInputGain) amp.setInput(analysisInputGain); }catch(_){ }
}

// Update player source buttons and displayed filename.
function updateSourceOptions(){
  const demoBtn = document.getElementById('demoTrackBtn');
  const chooseBtn = document.getElementById('chooseTrackBtn');
  const replaceBtn = document.getElementById('replaceTrackBtn');
  const ln = document.getElementById('localFileName');
  if (!demoBtn || !chooseBtn || !ln) return;
  // disable demo when bundled audio unavailable
  demoBtn.disabled = !!defaultLoadFailed || !defaultSong;
  // Compose a friendly "Playing:" label based on the currently active source (`song`)
  const activeDemo = (song === defaultSong);
  const activeLocal = (song === customSong);
  if (activeDemo){
    ln.textContent = 'Playing: Demo Track';
    ln.title = 'Demo Track';
  } else if (activeLocal && selectedFile && selectedFile.name){
    const display = friendlyTrackLabel(selectedFile.name);
    ln.textContent = 'Playing: ' + display;
    ln.title = selectedFile.name;
  } else {
    // No active known source — show a neutral placeholder
    ln.textContent = 'Playing: --';
    ln.title = '';
  }
  // reflect active selection in segmented control
  chooseBtn.classList.toggle('active', activeLocal);
  chooseBtn.setAttribute('aria-pressed', activeLocal ? 'true' : 'false');
  demoBtn.classList.toggle('active', activeDemo);
  demoBtn.setAttribute('aria-pressed', activeDemo ? 'true' : 'false');
  // show/hide replace affordance
  if (replaceBtn){ if (customSong) replaceBtn.classList.remove('hidden'); else replaceBtn.classList.add('hidden'); }
  // ensure timeline width and left anchors update when source text or layout changes
  try{ updateSeekWidth(); alignPlayingWithPlayButton(); }catch(_){ }
}

// Handle player file selection (loads custom file but does not autoplay)
function onPlayerFileSelected(e){
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  selectedFile = f;
  if (selectedFileURL) try{ URL.revokeObjectURL(selectedFileURL); }catch(_){ }
  selectedFileURL = URL.createObjectURL(f);
  // dispose previous customSong if present and not active
  if (customSong && customSong !== song){ try{ safeDisposeSoundFile(customSong); }catch(_){ } customSong = null; }
  if (playerErrorEl) playerErrorEl.classList.add('hidden');
  // preload the custom file so duration and analysis are available
  loadSound(selectedFileURL, (s) => {
    // assign the loaded file as the custom song and make it the active source
    customSong = s;
    audioReady = true;
    // stop any currently playing active song so the newly selected file becomes the active, paused source
    try{ if (song && song.isPlaying && song.isPlaying()) song.stop(); }catch(_){ }
    song = customSong;
    // reconnect the newly-loaded song through our routing so analysis
    // reads the raw signal while master output controls loudness
    connectSongToGains(song);
    applyCurrentVolumeToSong();
    // Reset loop mode when a new track is loaded so each new track
    // starts with loop disabled by default and a sensible range.
    try{
      const d = song.duration && song.duration();
      loopEnabled = false;
      resetLoopRangeForTrack(d);
    }catch(_){ }
    updateSourceOptions();
    // reflect the change in the UI immediately (remain paused)
    syncPlaybackUIState();
    // ensure loop icon and local display updated
    updateLoopIcon(loopEnabled);
    try{ enforceLoopContainment(); }catch(_){ }
  }, (err) => {
    console.error('Failed to load custom file', err);
    if (playerErrorEl){ playerErrorEl.textContent = 'Failed to load selected file.'; playerErrorEl.classList.remove('hidden'); }
    if (selectedFileURL){ try{ URL.revokeObjectURL(selectedFileURL); }catch(_){ } selectedFileURL = null; selectedFile = null; }
    updateSourceOptions();
  });
}

// Switch active source (bundled/local); stays paused.
function switchActiveSource(src){
  if (src === 'local'){
    if (!customSong){ if (playerErrorEl){ playerErrorEl.textContent = 'No local file selected.'; playerErrorEl.classList.remove('hidden'); } updateSourceOptions(); return; }
    try{ if (song && song.isPlaying && song.isPlaying()) song.stop(); }catch(_){ }
    song = customSong;
    connectSongToGains(song);
    applyCurrentVolumeToSong();
    try{ loopEnabled = false; resetLoopRangeForTrack(song.duration()); }catch(_){ }
  } else {
    if (!defaultSong){ if (playerErrorEl){ playerErrorEl.textContent = 'Bundled track unavailable.'; playerErrorEl.classList.remove('hidden'); } updateSourceOptions(); return; }
    try{ if (song && song.isPlaying && song.isPlaying()) song.stop(); }catch(_){ }
    song = defaultSong;
    connectSongToGains(song);
    applyCurrentVolumeToSong();
    try{ loopEnabled = false; resetLoopRangeForTrack(song.duration()); }catch(_){ }
  }
  // remain paused by default after switching; user must press Play
  syncPlaybackUIState();
  updateSourceOptions();
  // ensure loop and loop icon updated
  updateLoopIcon(loopEnabled);
  try{ enforceLoopContainment(); }catch(_){ }
}
function applyCurrentVolumeToSong(){
  if (volRange) volRange.value = currentVolume;
  // Apply volume to master output gain or per-file fallback.
  if (masterOutputGain && typeof masterOutputGain.amp === 'function'){
    try{
      if (isMuted){ masterOutputGain.amp(0); } else { masterOutputGain.amp(currentVolume); }
    }catch(e){}
  } else if (song && typeof song.setVolume === 'function'){
    try{ if (isMuted) song.setVolume(0); else song.setVolume(currentVolume); }catch(e){}
  }
}

// Format seconds into MM:SS or HH:MM:SS
function formatTime(sec){
  if (!sec || isNaN(sec) || sec < 0) return '00:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = m < 10 ? '0'+m : ''+m;
  const ss = s < 10 ? '0'+s : ''+s;
  if (h > 0){
    const hh = h < 10 ? '0'+h : ''+h;
    return hh+':'+mm+':'+ss;
  }
  return mm+':'+ss;
}

function updateTimeDisplay(){
  const el = document.getElementById('timeDisplay');
  if (!el || !song || typeof song.currentTime !== 'function' || typeof song.duration !== 'function') return;
  // Prefer deferred/pending seek positions for UI display.
  let c;
  try{
    const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
    // If a pending start exists (we just invoked play from a deferred
    // seek), keep the UI tied to that pending start until the audio's
    // reported currentTime advances to the requested point or a short
    // timeout elapses to avoid flicker.
    if (pendingStartTime !== null){
      c = pendingStartTime;
      try{
        const cur = song.currentTime();
        if (!isNaN(cur) && song.isPlaying && song.isPlaying() && cur >= pendingStartTime - 0.05){
          // audio has caught up — stop pinning UI
          pendingStartTime = null;
          pendingStartSince = null;
          c = cur;
        } else if (pendingStartSince && (millis() - pendingStartSince) > 500){
          // safety: clear pending after a short timeout to avoid stuck UI
          pendingStartTime = null;
          pendingStartSince = null;
        }
      }catch(_){ }
    } else if (deferredSeek !== null && !isPlaying){
      c = deferredSeek;
    } else {
      c = song.currentTime();
    }
  }catch(_){ c = song.currentTime(); }
  const d = song.duration();
  if (d && !isNaN(c)){
    el.textContent = formatTime(c) + ' / ' + formatTime(d);
  } else {
    el.textContent = formatTime(c) + ' / --:--';
  }
}

// Preview a seek position (used while dragging the seek slider)
function previewSeekTime(norm){
  const el = document.getElementById('timeDisplay');
  if (!el || !song || typeof song.duration !== 'function') return;
  const d = song.duration();
  if (!d || isNaN(d)){
    el.textContent = '00:00 / --:--';
    return;
  }
  const t = constrain(norm, 0, 1) * d;
  el.textContent = formatTime(t) + ' / ' + formatTime(d);
  // Set deferred seek when paused so Play resumes from selected position.
  const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
  if (!isPlaying){
    deferredSeek = t;
    if (seekRange) seekRange.value = constrain(norm, 0, 1);
  }
}

// --- Loop helpers -------------------------------------------------------
function resetLoopRangeForTrack(d){
  if (!d || isNaN(d) || d <= 0){
    loopStart = 0;
    loopEnd = null;
  } else {
    loopStart = 0;
    loopEnd = d;
  }
  syncLoopUI();
}

function syncLoopUI(){
  if (!seekContainer || !loopStartMarker || !loopEndMarker) return;
  const d = (song && typeof song.duration === 'function') ? song.duration() : null;
  const loopRegion = document.getElementById('loopRegion');
  if (!d || isNaN(d) || !loopEnd || !loopEnabled){
    loopStartMarker.style.display = 'none';
    loopEndMarker.style.display = 'none';
    if (loopRegion) loopRegion.style.display = 'none';
  } else {
    loopStartMarker.style.display = 'block';
    loopEndMarker.style.display = 'block';
    if (loopRegion) loopRegion.style.display = 'block';
    const sPct = (loopStart / d) * 100;
    const ePct = (loopEnd / d) * 100;
    loopStartMarker.style.left = sPct + '%';
    loopEndMarker.style.left = ePct + '%';
    if (loopRegion){ loopRegion.style.left = sPct + '%'; loopRegion.style.width = (ePct - sPct) + '%'; }
  }
  if (loopToggle){
    // use icon-based loop control
    updateLoopIcon(loopEnabled);
  }
}

// --- UI icons/helpers -------------------------------------------------
function playIconSVG(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>';
}
function pauseIconSVG(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6" y="4" width="4" height="16" fill="currentColor"></rect><rect x="14" y="4" width="4" height="16" fill="currentColor"></rect></svg>';
}
function volumeIconSVG(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor"/><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>';
}
function volumeLowIconSVG(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor"/></svg>';
}
function mutedIconSVG(){
  // Balanced speaker + X (keeps the same base speaker path as unmuted)
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">'
    + '<path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/>'
    // repositioned X so it is visually centered relative to the speaker tip
    + '<line x1="15" y1="9" x2="19" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    + '<line x1="19" y1="9" x2="15" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  + '</svg>';
}
function fullscreenEnterSVG(){
  // outward-facing rounded corner brackets (enter fullscreen)
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v3"/><path d="M18 3h3v3"/><path d="M6 21H3v-3"/><path d="M18 21h3v-3"/></g></svg>';
}
function fullscreenExitSVG(){
  // inward-facing rounded corner brackets (exit fullscreen)
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h3V3"/><path d="M21 6h-3V3"/><path d="M3 18h3v3"/><path d="M21 18h-3v3"/></g></svg>';
}

function loopIconSVG(active){
  // single repeat icon geometry for both states; color/state is indicated by the button styling only
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">'
    + '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zM17 17H7v-3l-4 4 4 4v-3h12v-6h-2z" fill="currentColor"/>'
  + '</svg>';
}

function restartIconSVG(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor"/></svg>';
}

// Show the horizontal volume slider temporarily (used when mute/volume button clicked)
function showVolumeSliderTemporary(){
  if (!volumeControl) return;
  volumeControl.classList.add('show-slider');
  if (sliderHideTimeoutId) clearTimeout(sliderHideTimeoutId);
  sliderHideTimeoutId = setTimeout(()=>{ volumeControl.classList.remove('show-slider'); sliderHideTimeoutId = null; }, 3500);
}

function scheduleHideSlider(delay=900){ if (sliderHideTimeoutId) clearTimeout(sliderHideTimeoutId); sliderHideTimeoutId = setTimeout(()=>{ if (volumeControl) volumeControl.classList.remove('show-slider'); sliderHideTimeoutId = null; }, delay); }

function updateMuteUI(){
  if (!muteBtn) return;
  let icon;
  if (isMuted || currentVolume === 0) icon = mutedIconSVG();
  else if (currentVolume < 0.5) icon = volumeLowIconSVG();
  else icon = volumeIconSVG();
  muteBtn.innerHTML = icon;
  muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
  // Accessible label and title reflect current toggle state
  try{ muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute'); muteBtn.title = isMuted ? 'Unmute' : 'Mute'; }catch(_){ }
}

// Derive display-friendly track name.
function friendlyTrackLabel(filename){
  if (!filename || typeof filename !== 'string') return '';
  // strip any path segments just in case
  const base = filename.split('/').pop().split('\\').pop();
  // remove only the last extension (e.g. name.mp3 -> name)
  const idx = base.lastIndexOf('.');
  if (idx > 0) return base.substring(0, idx);
  return base;
}

function toggleMute(){
  isMuted = !isMuted;
  if (isMuted){
    previousVolume = currentVolume > 0 ? currentVolume : previousVolume;
    try{
      if (masterOutputGain && typeof masterOutputGain.amp === 'function') masterOutputGain.amp(0);
      else if (song && typeof song.setVolume === 'function') song.setVolume(0);
    }catch(_){ }
  } else {
    currentVolume = previousVolume || currentVolume || 1;
    try{
      if (masterOutputGain && typeof masterOutputGain.amp === 'function') masterOutputGain.amp(currentVolume);
      else if (song && typeof song.setVolume === 'function') song.setVolume(currentVolume);
    }catch(_){ }
    if (volRange) volRange.value = currentVolume;
  }
  updateMuteUI();
}

async function toggleFullscreen(){
  try{
    if (!document.fullscreenElement){
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }catch(err){ console.warn('Fullscreen toggle failed', err); }
}

function updatePlayUI(){
  if (!playPauseBtn) return;
  const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
  playPauseBtn.innerHTML = isPlaying ? pauseIconSVG() : playIconSVG();
  playPauseBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
  playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
  // Accessible label reflects current action
  try{ playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play'); }catch(_){ }
}

function updateFullscreenIcon(isFS){ if (!fullscreenBtn) return; fullscreenBtn.innerHTML = isFS ? fullscreenExitSVG() : fullscreenEnterSVG(); }

// update fullscreen ARIA label
function updateFullscreenLabel(isFS){
  if (!fullscreenBtn) return;
  try{
    const label = isFS ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreenBtn.setAttribute('aria-label', label);
    fullscreenBtn.title = label;
  }catch(_){ }
}

// update loop icon to reflect active state
function updateLoopIcon(active){
  if (!loopToggle) return;
  const label = active ? 'Disable loop' : 'Enable loop';
  loopToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
  loopToggle.title = label;
  try{ loopToggle.setAttribute('aria-label', label); }catch(_){ }
  loopToggle.innerHTML = loopIconSVG(!!active);
}

function toggleLoop(){
  loopEnabled = !loopEnabled;
  // initialize sensible defaults when enabling
  if (loopEnabled && (!loopEnd || isNaN(loopEnd))){
    const d = (song && typeof song.duration === 'function') ? song.duration() : null;
    if (d && !isNaN(d)){
      loopStart = 0;
      loopEnd = d;
    }
  }
  syncLoopUI();
  updateLoopIcon(loopEnabled);
  // If loop was enabled, ensure the current position is inside it.
  if (loopEnabled) try{ enforceLoopContainment(); }catch(_){ }
}

function applyLoopIfNeeded(){
  // Handle automatic loop jumps when reaching loop end; skip while dragging.
  if (isDraggingLoopMarker) return;
  if (!loopEnabled || !song || typeof song.currentTime !== 'function' || !loopEnd) return;
  const c = song.currentTime();
  if (isNaN(c)) return;
  // small epsilon to avoid precision issues
  if (c >= loopEnd - 0.04){
    try{
      if (typeof song.jump === 'function'){
        song.jump(loopStart);
      } else {
        song.stop();
        if (typeof song.play === 'function') song.play();
      }
    }catch(e){ console.warn('Loop jump failed', e); }
    syncPlaybackUIState();
  }
}

// Ensure playback position is within loop; reposition once if outside.
function enforceLoopContainment(){
  if (!loopEnabled || !song || typeof song.currentTime !== 'function' || !loopEnd) return;
  try{
    const c = song.currentTime();
    if (isNaN(c)) return;
    if (c < loopStart || c > loopEnd){
      const wasPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
      if (!wasPlaying){
        // Keep paused: update deferred seek and UI immediately
        deferredSeek = loopStart;
        syncPlaybackUIState();
      } else {
        // While playing, do a single minimal reposition to loopStart
        try{
          if (typeof song.jump === 'function'){
            song.jump(loopStart);
          } else if (typeof song.play === 'function'){
            // Fallback: attempt a play cue at the requested time
            song.stop();
            // Use unity amplitude here; masterOutputGain controls audible level
            song.play(0, 1, 1, loopStart);
          }
        }catch(e){ console.warn('Loop reposition failed', e); }
        syncPlaybackUIState();
      }
    }
  }catch(_){ }
}

// Start flows removed: playback starts only from the player Play button.

// Player show/hide and controls ------------------------------------------
function onDocumentClick(e){
  if (!playerPanel) return;
  const playerOpen = playerPanel && !playerPanel.classList.contains('hidden');
  if (playerOpen){
    if (!e.target.closest || !e.target.closest('#playerPanel')){
      hidePlayer();
    }
    return;
  }
  // Do not open player when clicking interactive UI elements
  if (e.target.closest && (
    e.target.closest('.player-controls') ||
    e.target.closest('.range-wrap') ||
    e.target.closest('button') ||
    e.target.closest('input') ||
    e.target.closest('label') ||
    e.target.closest('.source-controls')
  )) return;
  // otherwise open player
  showPlayer();
}

function showPlayer(){
  if (!playerPanel) return;
  playerPanel.classList.remove('hidden');
  playerPanel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('player-open');
  syncPlaybackUIState();
}

function hidePlayer(){
  if (!playerPanel) return;
  playerPanel.classList.add('hidden');
  playerPanel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('player-open');
  syncPlaybackUIState();
}
// Info modal show/hide helpers
function showInfoModal(){
  if (!infoModalOverlayEl) infoModalOverlayEl = document.getElementById('infoModalOverlay');
  if (!infoModalEl) infoModalEl = document.getElementById('infoModal');
  if (!infoModalOverlayEl) return;
  infoModalOverlayEl.classList.remove('hidden');
  infoModalOverlayEl.setAttribute('aria-hidden', 'false');
  document.body.classList.add('info-open');
  // Intentionally avoid auto-focusing the close button on initial load
}
function hideInfoModal(){
  const overlay = infoModalOverlayEl || document.getElementById('infoModalOverlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('info-open');
}
function syncPlaybackUIState(){
  if (!playPauseBtn) return;
  const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
  // play/pause icon
  updatePlayUI();
  // body class for cursor behavior (cursor hidden only when playing and player closed)
  if (isPlaying) document.body.classList.add('playing'); else document.body.classList.remove('playing');
  // volume
  if (volRange) volRange.value = currentVolume;
  updateMuteUI();
  // seek: only update when user is not actively dragging the slider
  if (!isSeeking && seekRange && song && typeof song.duration === 'function' && typeof song.currentTime === 'function'){
    const d = song.duration();
    // Prioritize any pending start time (we're transitioning from a
    // paused seek into playback) so the handle doesn't briefly snap
    // back to an old paused position.
    if (pendingStartTime !== null && d && !isNaN(pendingStartTime)){
      seekRange.value = constrain(pendingStartTime / d, 0, 1);
    } else if (deferredSeek !== null && !isPlaying && d && !isNaN(deferredSeek)){
      seekRange.value = constrain(deferredSeek / d, 0, 1);
    } else {
      const c = song.currentTime();
      if (d && !isNaN(c)){
        seekRange.value = constrain(c / d, 0, 1);
      }
    }
  }
  // update compact time display unless user is previewing via drag
  if (!isSeeking) updateTimeDisplay();
  // keep loop UI in sync
  try{ syncLoopUI(); }catch(_){ }
}

async function togglePlayPause(){
  if (!song){
    // no active song yet
    if (defaultSong) song = defaultSong; else return;
  }
  if (song.isPlaying && song.isPlaying()){
    try{ song.pause(); }catch(_){ }
    syncPlaybackUIState();
    return;
  }
  // ensure audio context is resumed by a user gesture
  try{ await userStartAudio(); }catch(_){ }
  // If the user previously sought while paused, start playback directly
  // from that stored position in one coherent step to avoid racey
  // jump(...)+play() sequences which can reset the intended position.
  if (deferredSeek !== null){
    // If loop is enabled, ensure the deferred seek lies inside the loop
    try{
      if (loopEnabled && loopEnd && typeof loopStart === 'number'){
        if (deferredSeek < loopStart || deferredSeek > loopEnd - 0.04){
          deferredSeek = loopStart;
        }
      }
    }catch(_){ }

    try{
      // We intentionally do not pass user audible volume into the
      // SoundFile play call. The masterOutputGain controls loudness.
      // Mark the requested start time as pending so the UI doesn't
      // briefly read back the old paused currentTime.
      pendingStartTime = deferredSeek;
      pendingStartSince = millis();
      // Clear any old paused playback state so the upcoming play/loop
      // call cannot resume from a stale position. Stopping the sound
      // ensures the new cueStart will be honored reliably.
      if (song && typeof song.stop === 'function'){
        try{ song.stop(); }catch(_){ }
      }
      if (loopEnabled && typeof song.loop === 'function'){
        song.loop(0, 1, 1, deferredSeek);
      } else if (typeof song.play === 'function'){
        song.play(0, 1, 1, deferredSeek);
      } else if (typeof song.jump === 'function'){
        // Fallback: position then resume playback
        try{ song.jump(deferredSeek); }catch(_){ }
        if (typeof song.play === 'function') song.play();
        else if (typeof song.loop === 'function') song.loop();
      }
    }catch(e){ console.warn('Applying deferred seek failed', e); }

    // clear the paused deferred seek (we now have a pending start)
    deferredSeek = null;
    syncPlaybackUIState();
    return;
  }

  // No deferred seek: resume normal playback
  try{ if (typeof song.play === 'function') song.play(); else if (typeof song.loop === 'function') song.loop(); }catch(e){ console.warn('Play failed', e); }
  syncPlaybackUIState();
}

function restartSong(){
  if (!song) return;
  const wasPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
  const target = (loopEnabled && typeof loopStart === 'number') ? loopStart : 0;
  // If paused: treat Restart as a position reset (do not play).
  if (!wasPlaying){
    deferredSeek = target;
    // clear any pending play-from-deferred marker
    pendingStartTime = null;
    pendingStartSince = null;
    // update the seek UI immediately
    try{
      const d = song.duration && song.duration();
      if (d && !isNaN(d) && seekRange) seekRange.value = constrain(deferredSeek / d, 0, 1);
    }catch(_){ }
    updateTimeDisplay();
    syncPlaybackUIState();
    return;
  }
  // If playing: reposition immediately and keep playing.
  try{
    if (typeof song.jump === 'function'){
      song.jump(target);
    } else {
      // fallback: use play cue at requested time with unity amplitude
      song.stop();
      if (typeof song.play === 'function'){
        if (loopEnabled && typeof song.loop === 'function') song.loop(0, 1, 1, target);
        else song.play(0, 1, 1, target);
      }
    }
  }catch(e){
    try{ song.stop(); if (typeof song.play === 'function') song.play(); }catch(_e){}
  }
  syncPlaybackUIState();
}

function changeVolume(v){
  currentVolume = parseFloat(v);
  if (!isNaN(currentVolume) && currentVolume > 0) previousVolume = currentVolume;
  // update the master output gain; this leaves analysis input untouched
  if (masterOutputGain && typeof masterOutputGain.amp === 'function'){
    try{ if (isMuted) masterOutputGain.amp(0); else masterOutputGain.amp(currentVolume); }catch(e){}
  } else if (song && typeof song.setVolume === 'function'){
    try{ if (isMuted) song.setVolume(0); else song.setVolume(currentVolume); }catch(e){}
  }
}

function seekTo(norm){
  if (!song) return;
  // preserve current play state across seeks
  const wasPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
  if (typeof song.duration === 'function'){
    const d = song.duration();
    if (d && !isNaN(norm)){
      const t = constrain(norm, 0, 1) * d;
      // If the track was paused, defer applying the position to the audio
      // engine until the user resumes playback. This avoids starting/stopping
      // audio while paused and keeps the UI responsive.
      if (!wasPlaying){
        deferredSeek = t;
        // reflect the requested seek in the UI immediately
        if (seekRange) seekRange.value = constrain(norm, 0, 1);
        updateTimeDisplay();
      } else {
        // currently playing: apply immediately and preserve play state
        deferredSeek = null;
        if (typeof song.jump === 'function'){
          try{
            song.jump(t);
          }catch(e){
            try{ song.stop(); if (wasPlaying) song.play(); else song.pause && song.pause(); }catch(_e){}
          }
        } else {
          // fallback: try to reposition using play() with cue start
          try{
            song.stop();
            // Use unity amplitude here; audible level is handled via masterOutputGain
            if (wasPlaying){ song.play(0, 1, 1, t); }
            else { song.play(0, 1, 1, t); if (song.pause) song.pause(); }
          }catch(_e){}
        }
      }
    }
  }
  syncPlaybackUIState();
}

function draw(){
  /* Start - own code */
  // Phase 10 – Theme-aware background with trails
  drawBackground();
  colorMode(HSB, 360, 100, 100, 255);

  if (!audioReady){
    // idle subtle animation while loading
    push();
    translate(width/2, height/2);
    noStroke();
    fill(200, 10, 20, 30);
    ellipse(0,0, radBase*2.6, radBase*2.6);
    pop();
    return;
  }

  // Phase 2 – Advanced audio analysis
  fft.analyze();
  const spectrum = fft.analyze();
  const waveform = fft.waveform();
  peak.update(fft);
  const level = amp.getLevel();
  updateAudioBands();

  // Phase 3 – Beat detection and shockwaves
  detectBeat(level);
  updateShockwaves();

  // ============================================================
  // VISUALIZER DISPATCH (Phase 1)
  // ============================================================
  switch (currentVisualizer) {
    case 0: drawOriginalVisualizer(waveform, level); break;
    case 1: drawSpectrumBars(spectrum); break;
    case 2: drawCircularSpectrum(spectrum); break;
    case 3: drawGalaxyParticleField(); break;
    case 4: drawAudioTunnel(spectrum); break;
    case 5: drawFrequencyRings(spectrum); break;
    case 6: drawWaveRibbon(waveform); break;
    case 7: drawAudioMountain(spectrum); break;
    case 8: drawAudioMandala(spectrum, waveform); break;
    default: drawOriginalVisualizer(waveform, level);
  }

  // Shared elements drawn on top of every visualizer
  drawShockwaves();
  updateAndDrawAdvParticles();

  // Phase 7 – HUD & Phase 8 – Help overlay
  drawHUD();
  drawHelpOverlay();
  /* End - own code */

  // update player seek UI occasionally
  if (seekRange && song && typeof song.duration === 'function' && typeof song.currentTime === 'function'){
    if (frameCount % 4 === 0){
      const d = song.duration();
      const c = song.currentTime();
      // Prefer any pending start time (when transitioning from paused
      // deferred seek into playback) or a deferred paused seek. Only
      // fall back to the actual audio position when appropriate.
      if (!isSeeking && d){
        const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
        if (pendingStartTime !== null && !isNaN(pendingStartTime)){
          seekRange.value = constrain(pendingStartTime / d, 0, 1);
        } else if (deferredSeek !== null && !isPlaying && !isNaN(deferredSeek)){
          seekRange.value = constrain(deferredSeek / d, 0, 1);
        } else if (!isNaN(c)){
          seekRange.value = constrain(c / d, 0, 1);
        }
      }
      // update textual time display periodically when not actively dragging
      if (!isSeeking) updateTimeDisplay();
      // apply custom loop region if enabled
      try{ applyLoopIfNeeded(); }catch(_){ }

      // Detect natural end-of-track when loop is OFF. When playback
      // reaches the track's natural end, reset position to start and
      // leave the player paused with UI updated (seek handle -> start,
      // time display -> 00:00, play UI -> paused). This preserves the
      // existing loop behavior (handled in applyLoopIfNeeded).
      try{
        if (!loopEnabled && d && !isNaN(c)){
          const isPlaying = song && typeof song.isPlaying === 'function' && song.isPlaying();
          const eps = 0.05;
          const reachedEndNow = (isPlaying && c >= d - eps) || (!isPlaying && lastWasPlaying && c >= d - eps);
          if (reachedEndNow){
            try{ if (song && typeof song.stop === 'function') song.stop(); }catch(_){ }
            // keep paused at start
            deferredSeek = 0;
            pendingStartTime = null;
            pendingStartSince = null;
            if (seekRange) seekRange.value = 0;
            try{ updateTimeDisplay(); }catch(_){ }
            syncPlaybackUIState();
          }
          lastWasPlaying = isPlaying;
        } else {
          lastWasPlaying = (song && typeof song.isPlaying === 'function' && song.isPlaying()) || false;
        }
      }catch(_){ }
    }
  }
}

/* Start - own code */
// Original visualizer extracted into its own function (Visualizer 0)
function drawOriginalVisualizer(waveform, level) {
  // center circle behavior: shrink on detected peak, otherwise relax back
  if (peak.isDetected){
    rad = max(radBase * 0.45, rad * 0.9);
  } else {
    rad = lerp(rad, radBase, 0.1);
  }

  push();
  translate(width/2, height/2);

  // outer reactive lines (sample-driven radial lines)
  strokeWeight(1);
  const len = waveform.length;
  const step = Math.max(1, Math.floor(len / 220));
  for (let i = 0; i < len; i += step){
    const sample = waveform[i];
    const angle = map(i, 0, len, 0, TWO_PI);
    const baseR = rOuter;
    const extra = sample * (rOuter * 0.7);
    const x1 = baseR * cos(angle);
    const y1 = baseR * sin(angle);
    const x2 = (baseR + extra) * cos(angle);
    const y2 = (baseR + extra) * sin(angle);
    const hue = (i / len) * 160 + (frameCount * 0.08);
    stroke(hue % 360, 70, 92, 160);
    line(x1, y1, x2, y2);
  }

  // central circle
  noFill();
  stroke(0, 0, 95, 220);
  strokeWeight(2);
  ellipse(0, 0, rad * 2, rad * 2);

  // spread effects (many small ellipses, loose/rotative)
  rotation += 0.006 + level * 0.03;
  push();
  // add a gentle global rotation so particles sweep around
  rotate(rotation);
  for (let i = 0; i < particles.length; i++){
    const p = particles[i];
    // compute a slowly changing angle per particle for looser diagonal motion
    const t = frameCount * (0.003 + p.speed);
    const ang = p.baseAngle + t * p.spin + p.offset * 0.4;
    const wobble = sin(t + p.phase) * p.wobble;
    const px = cos(ang) * (p.dist + wobble) + sin(ang * 1.13) * (p.dist * 0.06);
    const py = sin(ang) * (p.dist + wobble * 0.6) + cos(ang * 1.07) * (p.dist * 0.04);
    const s = p.size * (1 + level * 8);
    noStroke();
    const hue = (p.hue + rotation * 18) % 360;
    fill(hue, 58, 92, constrain(160 - s * 2, 30, 200));
    ellipse(px, py, s, s);
  }
  pop();

  pop();
}
/* End - own code */


function windowResized(){
  resizeCanvas(windowWidth, windowHeight);
  updateRadii();
  buildParticles();
  /* Start - own code */
  initGalaxyParticles();
  /* End - own code */
  try{ alignPlayingWithPlayButton(); updateSeekWidth(); }catch(_){ }
}

function updateRadii(){
  rOuter = min(windowWidth, windowHeight) * 0.32;
}

// Build particle field sized to viewport for balanced performance
function buildParticles(){
  particles = [];
  const area = max(windowWidth, windowHeight) * min(windowWidth, windowHeight);
  // base density: about 1 particle per ~6000 px, clamped
  const count = floor(constrain(area / 6000, 80, 220));
  const maxD = max(windowWidth, windowHeight) * 0.7;
  const minD = min(windowWidth, windowHeight) * 0.12;
  for (let i = 0; i < count; i++){
    const baseAngle = random(TWO_PI);
    const dist = random(minD, maxD) * random(0.6, 1.0);
    particles.push({
      baseAngle,
      dist,
      phase: random(1000),
      size: random(1.6, 7.2),
      wobble: random(8, 32),
      speed: random(0.0005, 0.004) * (random() < 0.5 ? -1 : 1),
      spin: random(0.2, 1.1),
      offset: random(-0.4, 0.4),
      hue: random(20, 220)
    });
  }
}

// Keep the seek range visually aligned with the compact time display.
function updateSeekWidth(){
  const seek = document.getElementById('seekRange');
  const container = document.querySelector('.seek-container');
  const timeEl = document.getElementById('timeDisplay');
  if (!seek || !container || !timeEl) return;
  // Keep the seek input full-width of the seek container so its right edge
  // aligns with the time display (time display is absolutely positioned
  // to the container's right edge). Using 100% keeps layout responsive
  // and ensures loop markers (percent-based) align with the visible bar.
  seek.style.width = '100%';
}

// Align the Playing label and the timeline left anchor to the exact left column used by the Play button.
function alignPlayingWithPlayButton(){
  const play = document.getElementById('playPauseBtn');
  const localWrap = document.getElementById('localFileWrap');
  const timeline = document.querySelector('.player-timeline');
  const container = document.querySelector('.player-inner');
  if (!play || !localWrap || !container) return;
  const cRect = container.getBoundingClientRect();
  const pRect = play.getBoundingClientRect();
  // account for the container's internal left padding so we don't double-offset
  const cs = window.getComputedStyle(container);
  const paddingLeft = parseFloat(cs.paddingLeft) || 0;
  const rawOffset = pRect.left - cRect.left;
  const anchor = Math.max(0, Math.round(rawOffset - paddingLeft));
  // apply exact pixel alignment so the Playing label and timeline share the same left anchor
  localWrap.style.marginLeft = anchor + 'px';
  if (timeline) timeline.style.paddingLeft = anchor + 'px';
}

// Observe changes to the time text and adjust seek width when the text length (and width) change.
function watchTimeDisplay(){
  const timeEl = document.getElementById('timeDisplay');
  if (!timeEl) return;
  let last = timeEl.textContent;
  const mo = new MutationObserver(() => {
    if (timeEl.textContent !== last){
      last = timeEl.textContent;
      updateSeekWidth();
    }
  });
  mo.observe(timeEl, { characterData: true, childList: true, subtree: true });
}

// Handle space toggling robustly from page keydown listener
function handleSpaceToggle(){
  if (!audioReady || !song) return;
  // Toggle via the same player control (ensures audio context is resumed on first play)
  togglePlayPause();
}