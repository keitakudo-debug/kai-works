// ============================================================
// KAI WORKS — 3D表示（トップ画面 ＋ 制作実績）
// three.js を使用。WebGL が使えない環境では今までの絵がそのまま表示されます。
// ============================================================
import * as THREE from 'three';

const C = {
  navy: '#0b2545',
  navyLight: '#12345f',
  blue: '#1d4ed8',
  sky: '#38bdf8',
  bgAlt: '#f4f8fb',
  line: '#dbe4ee',
  text: '#1f2933',
  muted: '#5b6b79',
  warm: '#f59e0b',
};
const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 共通の道具 ----------
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

function makeTexture(draw, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function fillRR(g, x, y, w, h, r, color) { g.fillStyle = color; rr(g, x, y, w, h, r); g.fill(); }
function text(g, s, x, y, size, color, weight = 700, align = 'left') {
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

// 角丸の板（表面にテクスチャ、側面は単色）
function roundedPlate(w, h, r, depth) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  return geo;
}
function screenMat(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32 });
}
const soft = (c, rough = 0.45) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05 });

function softShadowTex() {
  return makeTexture((g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(11,37,69,0.22)');
    grd.addColorStop(1, 'rgba(11,37,69,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, 256, 256);
}

// 1つの canvas に 1つの3D画面を作る共通の仕組み
function createStage(canvas, { fov = 35, z = 14 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, z);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe4ee, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(4, 6, 8);
  scene.add(sun);

  const stage = { renderer, scene, camera, visible: true, onResize: null, onFrame: null };
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (stage.onResize) stage.onResize(w, h);
  };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { stage.visible = e.isIntersecting; }).observe(canvas);
  resize();

  const clock = new THREE.Clock();
  const loop = () => {
    requestAnimationFrame(loop);
    if (!stage.visible) return;
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    if (stage.onFrame) stage.onFrame(t);
    renderer.render(scene, camera);
  };
  loop();
  return stage;
}

// ============================================================
// 1. トップ画面：ふわふわ浮かぶ「記録」「シフト」「申し送り」
// ============================================================
function buildHero(canvas) {
  const stage = createStage(canvas, { z: 12 });
  const group = new THREE.Group();
  stage.scene.add(group);

  const docTex = makeTexture((g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.blue; g.fillRect(0, 0, w, 76);
    text(g, '記録', 36, 40, 34, '#fff');
    for (let i = 0; i < 9; i++) fillRR(g, 36, 128 + i * 58, w - 72 - (i % 3) * 70, 16, 8, C.line);
    g.fillStyle = C.sky; g.beginPath(); g.arc(w - 70, h - 70, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath();
    g.moveTo(w - 84, h - 70); g.lineTo(w - 72, h - 58); g.lineTo(w - 54, h - 82); g.stroke();
  }, 512, 680);

  const calTex = makeTexture((g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.navy; g.fillRect(0, 0, w, 76);
    text(g, 'シフト', 36, 40, 34, '#fff');
    const cols = 5, cw = (w - 72) / cols, ch = 80;
    for (let r = 0; r < 6; r++) for (let c = 0; c < cols; c++) {
      const on = (r * 3 + c * 7) % 5 === 0, mid = (r + c * 2) % 6 === 1;
      fillRR(g, 36 + c * cw + 5, 112 + r * ch + 5, cw - 10, ch - 10, 10, on ? C.blue : mid ? '#bae6fd' : '#eef3f8');
    }
  }, 512, 680);

  const chatTex = makeTexture((g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    fillRR(g, 30, 40, w - 140, 120, 30, '#e0f2fe');
    fillRR(g, 110, 190, w - 140, 120, 30, '#e8eefb');
    fillRR(g, 30, 340, w - 200, 120, 30, '#e0f2fe');
    text(g, '申し送り', 62, 100, 32, C.navy);
    fillRR(g, 140, 232, 230, 16, 8, C.line); fillRR(g, 140, 264, 160, 16, 8, C.line);
    fillRR(g, 60, 382, 200, 16, 8, C.line); fillRR(g, 60, 414, 120, 16, 8, C.line);
    g.fillStyle = C.blue; g.beginPath(); g.arc(w - 80, 560, 46, 0, Math.PI * 2); g.fill();
    text(g, 'AI', w - 80, 562, 38, '#fff', 900, 'center');
  }, 512, 640);

  const items = [];
  const add = (obj, x, y, z, rx, ry, rz, speed, amp) => {
    obj.position.set(x, y, z);
    obj.rotation.set(rx, ry, rz);
    obj.userData = { base: obj.position.clone(), rot: obj.rotation.clone(), speed, amp, phase: Math.random() * Math.PI * 2 };
    group.add(obj); items.push(obj);
    return obj;
  };
  const card = (tex, w, h) => new THREE.Mesh(roundedPlate(w, h, 0.18, 0.06), [screenMat(tex), soft(0xeef2f7, 0.9)]);

  add(card(docTex, 2.4, 3.2), 0.1, 0.4, 0, -0.12, -0.35, 0.08, 0.6, 0.22);
  add(card(calTex, 2.2, 2.9), 2.4, -0.8, -1.2, 0.1, -0.55, -0.1, 0.5, 0.26);
  add(card(chatTex, 2.0, 2.5), -2.0, -1.2, 0.8, 0.05, 0.3, 0.12, 0.7, 0.2);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), soft(0x38bdf8)), 1.5, 2.3, 0.6, 0, 0, 0, 0.9, 0.3);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), soft(0x1d4ed8)), -2.5, 1.6, -0.5, 0, 0, 0, 1.1, 0.25);
  const cube = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), soft(0x0b2545)), 3.3, 1.6, -0.4, 0.5, 0.6, 0, 0.8, 0.3);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.11, 24, 48), soft(0x93c5fd)), -1.0, -2.8, 0.4, 1.0, 0.3, 0, 0.75, 0.25);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), soft(0x38bdf8)), 3.6, -2.4, 0.3, 0, 0, 0, 1.2, 0.22);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
    new THREE.MeshBasicMaterial({ map: softShadowTex(), transparent: true, depthWrite: false }));
  shadow.position.set(0.3, -3.9, -1.5);
  shadow.rotation.x = -Math.PI / 2.4;
  group.add(shadow);

  stage.onResize = (w, h) => {
    // 縦横比に合わせて全体が収まる大きさにする
    const fit = Math.min(1, (w / h) / 1.35);
    group.scale.setScalar(Math.max(0.6, fit) * 1.05);
  };
  stage.onResize(canvas.clientWidth, canvas.clientHeight);

  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  stage.onFrame = (t) => {
    cur.x += (target.x - cur.x) * 0.05;
    cur.y += (target.y - cur.y) * 0.05;
    group.rotation.y = cur.x * 0.25;
    group.rotation.x = cur.y * 0.15;
    for (const o of items) {
      const d = o.userData;
      o.position.y = d.base.y + Math.sin(t * d.speed + d.phase) * d.amp;
      o.rotation.x = d.rot.x + Math.sin(t * d.speed * 0.7 + d.phase) * 0.08;
      o.rotation.y = d.rot.y + Math.cos(t * d.speed * 0.5 + d.phase) * 0.12;
    }
    cube.rotation.y = 0.6 + t * 0.35;
  };
}

// ============================================================
// 2. 制作実績：各アプリの画面を3Dの端末に映す
// ============================================================

// --- LIFE（科学的介護）用アプリの画面 ---
function lifeScreen() {
  return makeTexture((g, w, h) => {
    g.fillStyle = C.bgAlt; g.fillRect(0, 0, w, h);
    // 上のバー
    g.fillStyle = C.navy; g.fillRect(0, 0, w, 70);
    text(g, 'LIFE 入力サポート', 32, 36, 28, '#fff');
    fillRR(g, w - 170, 18, 140, 34, 17, C.sky);
    text(g, '提出まで あと3件', w - 100, 36, 15, C.navy, 700, 'center');
    // 左メニュー
    g.fillStyle = '#fff'; g.fillRect(0, 70, 200, h - 70);
    ['利用者一覧', '評価の入力', 'チェック', 'データ出力'].forEach((s, i) => {
      if (i === 1) fillRR(g, 14, 92 + i * 56, 172, 42, 10, '#e0e9fb');
      text(g, s, 34, 113 + i * 56, 18, i === 1 ? C.blue : C.muted, i === 1 ? 700 : 500);
    });
    // メイン
    text(g, '評価の入力', 232, 112, 26, C.navy);
    text(g, '入力の進み具合', 232, 156, 16, C.muted, 500);
    fillRR(g, 380, 148, w - 420, 16, 8, C.line);
    fillRR(g, 380, 148, (w - 420) * 0.72, 16, 8, C.blue);
    text(g, '72%', w - 30, 156, 16, C.blue, 700, 'right');
    const rows = ['ADL（食事・移動など）', '栄養の状態', '口腔の状態', '認知症の状態', '日常生活の様子'];
    rows.forEach((s, i) => {
      const y = 196 + i * 72;
      fillRR(g, 232, y, w - 264, 58, 12, '#fff');
      text(g, s, 256, y + 29, 18, C.text, 500);
      const done = i < 3;
      fillRR(g, w - 160, y + 14, 112, 30, 15, done ? '#dcfce7' : '#fef3c7');
      text(g, done ? '入力済み' : '未入力', w - 104, y + 29, 15, done ? '#15803d' : '#b45309', 700, 'center');
    });
    fillRR(g, w - 300, h - 70, 268, 48, 24, C.blue);
    text(g, '提出用データを作成', w - 166, h - 46, 18, '#fff', 700, 'center');
  }, 1024, 640);
}

// --- 事故報告書・ヒヤリハットアプリの画面 ---
function hiyariScreen() {
  return makeTexture((g, w, h) => {
    g.fillStyle = C.bgAlt; g.fillRect(0, 0, w, h);
    g.fillStyle = C.blue; g.fillRect(0, 0, w, 150);
    text(g, '事故・ヒヤリハット', 40, 70, 38, '#fff');
    text(g, '報告をかんたんに', 40, 118, 24, 'rgba(255,255,255,0.85)', 500);
    // 種類のチップ
    text(g, '種類', 40, 200, 24, C.navy);
    const chips = ['転倒', '誤薬', '転落', '外傷', 'その他'];
    let x = 40, y = 240;
    chips.forEach((s, i) => {
      const cw = 40 + s.length * 26;
      if (x + cw > w - 30) { x = 40; y += 66; }
      fillRR(g, x, y, cw, 50, 25, i === 0 ? C.warm : '#fff');
      text(g, s, x + cw / 2, y + 25, 22, i === 0 ? '#fff' : C.text, 700, 'center');
      x += cw + 14;
    });
    // 入力欄
    const fields = [['日時', '11/21 14:30'], ['場所', 'リビング'], ['内容', '']];
    let fy = y + 96;
    fields.forEach(([l, v], i) => {
      text(g, l, 40, fy, 22, C.navy);
      const fh = i === 2 ? 150 : 64;
      fillRR(g, 40, fy + 22, w - 80, fh, 14, '#fff');
      if (v) text(g, v, 64, fy + 22 + fh / 2, 22, C.text, 500);
      else for (let k = 0; k < 3; k++) fillRR(g, 64, fy + 50 + k * 34, w - 160 - k * 70, 14, 7, C.line);
      fy += fh + 66;
    });
    // 今月の件数グラフ
    fillRR(g, 40, fy - 20, w - 80, 170, 16, '#fff');
    text(g, '今月の件数', 64, fy + 14, 20, C.muted, 500);
    [3, 5, 2, 4, 1, 3].forEach((v, i) => fillRR(g, 70 + i * 66, fy + 130 - v * 18, 38, v * 18, 6, i === 1 ? C.warm : '#93c5fd'));
    // ボタン
    fillRR(g, 40, h - 120, w - 80, 76, 38, C.blue);
    text(g, '報告書を作成する', w / 2, h - 82, 26, '#fff', 700, 'center');
  }, 540, 1120);
}

// --- 洋菓子店のホームページの画面（店名なし） ---
function sweetsScreen() {
  return makeTexture((g, w, h) => {
    g.fillStyle = '#fffaf5'; g.fillRect(0, 0, w, h);
    // ナビ
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, 64);
    text(g, 'PATISSERIE', 36, 33, 24, '#8a5a44', 900);
    ['商品', 'お店', 'アクセス'].forEach((s, i) => text(g, s, w - 300 + i * 92, 33, 17, '#8a5a44', 500));
    // ヒーロー
    const grd = g.createLinearGradient(0, 64, w, 380);
    grd.addColorStop(0, '#fde8ec'); grd.addColorStop(1, '#fff3e3');
    g.fillStyle = grd; g.fillRect(0, 64, w, 330);
    text(g, 'やさしい甘さを、', 60, 170, 40, '#6b3f2e', 900);
    text(g, '毎日に。', 60, 226, 40, '#6b3f2e', 900);
    fillRR(g, 60, 280, 190, 50, 25, '#e88aa0');
    text(g, '商品を見る', 155, 305, 19, '#fff', 700, 'center');
    // ケーキのイラスト
    const cx = w - 250, cy = 250;
    g.fillStyle = 'rgba(232,138,160,0.18)'; g.beginPath(); g.arc(cx, cy, 130, 0, Math.PI * 2); g.fill();
    fillRR(g, cx - 110, cy + 10, 220, 70, 14, '#f3d2b3');
    fillRR(g, cx - 110, cy - 30, 220, 44, 14, '#fff');
    fillRR(g, cx - 110, cy + 4, 220, 12, 6, '#f5a3b5');
    fillRR(g, cx - 110, cy + 40, 220, 10, 5, '#fff');
    [-70, -10, 50].forEach((dx) => {
      g.fillStyle = '#e2405f'; g.beginPath(); g.arc(cx + dx + 10, cy - 44, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5aa469'; g.beginPath(); g.ellipse(cx + dx + 10, cy - 64, 8, 4, 0, 0, Math.PI * 2); g.fill();
    });
    // 商品カード
    const cols = ['#fbd3dc', '#f6e1c3', '#e4d8f5'];
    ['いちごのショート', '焼き菓子セット', '季節のタルト'].forEach((s, i) => {
      const x = 48 + i * ((w - 96) / 3);
      const cw = (w - 96) / 3 - 24;
      fillRR(g, x, 430, cw, 250, 18, '#fff');
      fillRR(g, x + 16, 446, cw - 32, 140, 14, cols[i]);
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x + cw / 2, 516, 40, 0, Math.PI * 2); g.fill();
      text(g, s, x + cw / 2, 620, 19, '#6b3f2e', 700, 'center');
      fillRR(g, x + cw / 2 - 50, 646, 100, 14, 7, '#f1e4da');
    });
  }, 1024, 720);
}

// --- 端末の形 ---
function laptop(tex) {
  const g = new THREE.Group();
  const lid = new THREE.Group();
  const shell = new THREE.Mesh(roundedPlate(4.2, 2.75, 0.14, 0.08), [soft(0x1b2a3e, 0.5), soft(0x1b2a3e, 0.5)]);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 2.48), screenMat(tex));
  screen.position.z = 0.075;
  lid.add(shell, screen);
  lid.position.set(0, 1.375, 0);
  const hinge = new THREE.Group();
  hinge.add(lid);
  hinge.rotation.x = -0.12;
  hinge.position.set(0, 0, -1.3);
  const base = new THREE.Mesh(roundedPlate(4.4, 2.7, 0.16, 0.12), [soft(0xc9d3df, 0.4), soft(0xb7c2cf, 0.4)]);
  base.rotation.x = -Math.PI / 2;
  base.position.set(0, -0.06, 0.05);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), soft(0xb3bfcd, 0.5));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.005, 0.85);
  g.add(hinge, base, pad);
  g.position.y = -1.0;
  return g;
}
function phone(tex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedPlate(2.1, 4.25, 0.32, 0.2), [soft(0x0b2545, 0.35), soft(0x12345f, 0.35)]);
  const screen = new THREE.Mesh(roundedPlate(1.92, 3.98, 0.24, 0.005), [screenMat(tex), soft(0x000000)]);
  screen.position.z = 0.125;
  const notch = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 12), soft(0x0b2545));
  notch.rotation.z = Math.PI / 2; notch.position.set(0, 1.86, 0.135);
  g.add(body, screen, notch);
  return g;
}
function tablet(tex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(roundedPlate(4.4, 3.2, 0.26, 0.16), [soft(0xe5e9ef, 0.35), soft(0xd3d9e1, 0.35)]);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.12, 2.9), screenMat(tex));
  screen.position.z = 0.115;
  g.add(body, screen);
  return g;
}

function buildWork(canvas, kind) {
  const stage = createStage(canvas, { fov: 30, z: 10 });
  const holder = new THREE.Group();
  stage.scene.add(holder);

  let device, base = { rx: 0, ry: 0 };
  if (kind === 'life') { device = laptop(lifeScreen()); base = { rx: 0.22, ry: -0.35 }; }
  else if (kind === 'hiyari') { device = phone(hiyariScreen()); base = { rx: 0.05, ry: -0.3 }; }
  else { device = tablet(sweetsScreen()); base = { rx: 0.1, ry: 0.3 }; }
  holder.add(device);

  // 足元の影と小さな飾り
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6),
    new THREE.MeshBasicMaterial({ map: softShadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2.3;
  shadow.position.set(0, kind === 'hiyari' ? -2.6 : -2.1, -0.5);
  stage.scene.add(shadow);
  const deco = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), soft(kind === 'sweets' ? 0xe88aa0 : kind === 'hiyari' ? 0xf59e0b : 0x38bdf8));
  deco.position.set(kind === 'sweets' ? -2.4 : 2.3, 1.6, 0.4);
  stage.scene.add(deco);

  stage.onResize = (w, h) => {
    const need = kind === 'hiyari' ? 1 : 1.25;
    holder.scale.setScalar(Math.min(1, ((w / h) / 1.4) * need + 0.15));
  };
  stage.onResize(canvas.clientWidth, canvas.clientHeight);

  // カードにマウスを乗せると、その方向に少し傾く
  const card = canvas.closest('.work3d-card') || canvas;
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  card.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });

  const phase = Math.random() * 6;
  stage.onFrame = (t) => {
    cur.x += (target.x - cur.x) * 0.08;
    cur.y += (target.y - cur.y) * 0.08;
    holder.rotation.y = base.ry + Math.sin(t * 0.5 + phase) * 0.18 + cur.x * 0.35;
    holder.rotation.x = base.rx + cur.y * 0.18;
    holder.position.y = Math.sin(t * 0.9 + phase) * 0.08;
    deco.position.y = 1.6 + Math.sin(t * 1.2 + phase) * 0.15;
  };
}

// ============================================================
// 起動
// ============================================================
async function start() {
  if (!webglOK()) return;
  // 日本語フォントの読み込みを少し待ってから画面の文字を描く
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`700 24px "Noto Sans JP"`), document.fonts.load(`500 24px "Noto Sans JP"`)]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { /* フォントが無くても続行 */ }

  const heroCanvas = document.getElementById('hero3d-canvas');
  if (heroCanvas) {
    try { buildHero(heroCanvas); document.documentElement.classList.add('has-3d'); }
    catch (e) { console.warn('hero 3D', e); }
  }
  document.querySelectorAll('canvas[data-work3d]').forEach((cv) => {
    try { buildWork(cv, cv.dataset.work3d); cv.closest('.work3d-stage')?.classList.add('is-ready'); }
    catch (e) { console.warn('work 3D', e); }
  });
}
start();
