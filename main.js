/* =========================================================
   TRẠI HEO — farm 3D cho vui
   Một file duy nhất, không asset ngoài: mọi thứ dựng bằng
   geometry + màu, âm thanh tổng hợp bằng WebAudio.
   ========================================================= */
import * as THREE from './vendor/three.module.min.js';

/* ---------------- helpers ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerpAngle = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

/* ---------------- state ---------------- */
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const SMALL = Math.min(screen.width, screen.height) < 820; // điện thoại
const S = {
  quality: TOUCH && SMALL ? 'low' : 'medium',
  weather: 'clear',
  time: 'cycle',
  sound: false,
  cinematic: false,
  debug: false,
};
const QUALITY = {
  low:    { px: 1,    shadow: false, shadowMap: 512,  grass: 3500,  flowers: 40  },
  medium: { px: 1.5,  shadow: true,  shadowMap: 1024, grass: 12000, flowers: 90  },
  high:   { px: 1.75, shadow: true,  shadowMap: 2048, grass: 24000, flowers: 150 },
  ultra:  { px: 2,    shadow: true,  shadowMap: 2048, grass: 42000, flowers: 220 },
};
const TIME_PRESET = { morning: 0.30, noon: 0.50, golden: 0.67, sunset: 0.775, night: 0.97 };
const DAY_LEN = 240; // giây cho 1 ngày đêm (chế độ cycle)
const timeState = { t: 0.34 };

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const loadingEl = $('loading'), toastEl = $('toast'), debugEl = $('debug');
const oinkCountEl = $('oinkCount'), pigCountEl = $('pigCount');

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: !SMALL, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdff2ff, 60, 250);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a33, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2df, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0015;
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0x9db8ff, 0);
scene.add(moon);

/* ---------------- bầu trời ---------------- */
const skyGroup = new THREE.Group();
scene.add(skyGroup);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color(0x6fb6ff) },
    mid: { value: new THREE.Color(0xdff2ff) },
  },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid;
    void main(){
      float h = normalize(vP).y;
      vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mid;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat));

// sao
{
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = rand(0, Math.PI * 2), ph = rand(0.03, Math.PI / 2.1), r = 470;
    pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r;
    pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
  }));
  skyGroup.add(stars);
}
// mặt trời + mặt trăng
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(22, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c2, fog: false }));
const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(15, 24), new THREE.MeshBasicMaterial({ color: 0xdfe7f5, fog: false }));
skyGroup.add(sunDisc, moonDisc);

/* ---------------- mặt đất ---------------- */
const WORLD_R = 138;
// đường đi: đoạn thẳng [x1,z1,x2,z2,width]
const PATHS = [
  [0, -14.5, 0, 19, 2.3],
  [0, 6, -16, 6, 1.9],
  [0, 10, 20, 8.5, 1.9],
];
const MUD = { x: -16, z: 6, rx: 6.2, rz: 4.2 };
const POND = { x: 20, z: 8, r: 6.2 };
const BARN = { x: 0, z: -18, hx: 4.8, hz: 3.4 };
const TROUGH = { x: 6, z: -14 };
const YARD = { x0: -30, x1: 30, z0: -24, z1: 18, gate: 2.6 };

function distToSeg(x, z, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1;
  const L2 = dx * dx + dz * dz;
  let t = ((x - x1) * dx + (z - z1) * dz) / L2;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx, pz = z1 + t * dz;
  return Math.hypot(x - px, z - pz);
}
const inEllipse = (x, z, e, m = 1) => ((x - e.x) / (e.rx * m)) ** 2 + ((z - e.z) / (e.rz * m)) ** 2 < 1;
const inCircle = (x, z, c, m = 1) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r * m) ** 2;
const inBarn = (x, z, m = 1) => Math.abs(x - BARN.x) < BARN.hx * m && Math.abs(z - BARN.z) < BARN.hz * m;

{
  const g = new THREE.PlaneGeometry(340, 340, 110, 110);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    c.setHSL(0.29 + (n - 0.5) * 0.035, 0.58, 0.33 + (n - 0.5) * 0.09, THREE.SRGBColorSpace);
    // đường đất
    let road = 0;
    for (const [x1, z1, x2, z2, w] of PATHS) road = Math.max(road, 1 - smoothstep(w * 0.75, w * 1.25, distToSeg(x, z, x1, z1, x2, z2)));
    if (road > 0) c.lerp(new THREE.Color(0.72, 0.58, 0.4), road * 0.85);
    // vũng bùn
    if (inEllipse(x, z, MUD, 1.15)) c.lerp(new THREE.Color(0.32, 0.22, 0.12), 0.92);
    // ao
    if (inCircle(x, z, POND, 1.12)) c.lerp(new THREE.Color(0.13, 0.3, 0.42), 0.95);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
}

/* ---------------- vật thể trang trại ---------------- */
const colliders = []; // {x,z,r}
const mat = (color, opt = {}) => new THREE.MeshLambertMaterial({ color, ...opt });

// ---- chuồng
{
  const barn = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.4, 4.6, 6.6), mat(0xa63d30));
  body.position.y = 2.3;
  barn.add(body);
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.3, 7.2), mat(0x8a5a40));
  roofL.position.set(-2.28, 5.55, 0); roofL.rotation.z = 0.62;
  const roofR = roofL.clone(); roofR.position.x = 2.28; roofR.rotation.z = -0.62;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 7.3), mat(0x6e4434));
  ridge.position.y = 6.42;
  barn.add(roofL, roofR, ridge);
  // cửa + khung trắng
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.1, 0.18), mat(0x4a2f24));
  door.position.set(0, 1.55, 3.32);
  barn.add(door);
  for (const rz of [0.72, -0.72]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.06), mat(0xe8e2d4));
    brace.position.set(0, 1.6, 3.44); brace.rotation.z = rz;
    barn.add(brace);
  }
  const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.14), mat(0x3a241b));
  win.position.set(0, 4.05, 3.34);
  barn.add(win);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.7, 0.3), mat(0xe8e2d4));
    trim.position.set(sx * 4.55, 2.3, sz * 3.15);
    barn.add(trim);
  }
  barn.position.set(BARN.x, 0, BARN.z);
  barn.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(barn);
}

// ---- hàng rào quanh sân
{
  const fence = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.17, 1.2, 0.17);
  const postMat = mat(0x8a6238);
  const railMat = mat(0x9a7048);
  const spans = [];
  const pushSpan = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.5) return;
    spans.push([x1, z1, x2, z2, len]);
    const n = Math.max(2, Math.round(len / 3) + 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(lerp(x1, x2, t), 0.6, lerp(z1, z2, t));
      fence.add(p);
    }
  };
  pushSpan(YARD.x0, YARD.z0, YARD.x1, YARD.z0);          // bắc
  pushSpan(YARD.x0, YARD.z1, YARD.x0, YARD.z0);          // tây
  pushSpan(YARD.x1, YARD.z1, YARD.x1, YARD.z0);          // đông
  pushSpan(YARD.x0, YARD.z1, -YARD.gate, YARD.z1);       // nam (trước cổng)
  pushSpan(YARD.gate, YARD.z1, YARD.x1, YARD.z1);        // nam (sau cổng)
  for (const [x1, z1, x2, z2, len] of spans) {
    for (const h of [0.45, 0.88]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.06), railMat);
      rail.scale.x = len;
      rail.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
      rail.rotation.y = Math.atan2(z2 - z1, x2 - x1) * -1 + Math.PI / 2 - Math.PI / 2;
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      fence.add(rail);
    }
  }
  for (const sx of [-YARD.gate, YARD.gate]) {
    const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.7, 0.24), postMat);
    gatePost.position.set(sx, 0.85, YARD.z1);
    fence.add(gatePost);
  }
  fence.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(fence);
}

// ---- máng ăn
{
  const t = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 1), mat(0x7a5230));
  base.position.y = 0.45;
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), mat(0xc98a3d));
  food.scale.set(1.25, 0.28, 0.55); food.position.y = 0.78;
  t.add(base, food);
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 1), mat(0x6b4526));
    wall.position.set(sx * 1.17, 0.6, 0);
    t.add(wall);
  }
  t.position.set(TROUGH.x, 0, TROUGH.z);
  t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(t);
  colliders.push({ x: TROUGH.x, z: TROUGH.z, r: 1.7 });
}

// ---- rơm
for (const [x, z] of [[12, -20], [13.9, -19], [10.6, -21.3], [-12, -20.5]]) {
  const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.5, 14), mat(0xd8b34a));
  hay.rotation.z = Math.PI / 2; hay.rotation.y = rand(0, Math.PI);
  hay.position.set(x, 0.85, z);
  hay.castShadow = hay.receiveShadow = true;
  scene.add(hay);
  colliders.push({ x, z, r: 1.25 });
}

// ---- ao + bùn
{
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 42), new THREE.MeshPhongMaterial({
    color: 0x3f87c2, transparent: true, opacity: 0.85, shininess: 120, specular: 0x99ccff,
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, 0.04, POND.z);
  const deep = new THREE.Mesh(new THREE.CircleGeometry(POND.r * 0.6, 36), new THREE.MeshBasicMaterial({ color: 0x2a5f8c }));
  deep.rotation.x = -Math.PI / 2; deep.position.set(POND.x, 0.03, POND.z);
  scene.add(water, deep);
  // sỏi quanh ao
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), r = POND.r + rand(0.2, 0.8);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.2, 0.42), 0), mat(0x9aa0a6));
    stone.position.set(POND.x + Math.cos(a) * r, 0.12, POND.z + Math.sin(a) * r);
    stone.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    stone.castShadow = true;
    scene.add(stone);
  }
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 0.35 }));
  mud.rotation.x = -Math.PI / 2;
  mud.scale.set(MUD.rx, MUD.rz, 1);
  mud.position.set(MUD.x, 0.02, MUD.z);
  scene.add(mud);
}

// ---- cây + đá + hoa
function makeTree(s = 1) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.3, 7), mat(0x7a5a3a));
  trunk.position.y = 1.15;
  t.add(trunk);
  const leafCols = [0x4e8f3d, 0x5da34a, 0x467f36];
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.1, 1.5), 0), mat(pick(leafCols), { flatShading: true }));
    leaf.position.set(rand(-0.7, 0.7), 2.4 + rand(0, 1.1), rand(-0.7, 0.7));
    leaf.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    leaf.castShadow = true;
    t.add(leaf);
  }
  t.scale.setScalar(s);
  return t;
}
{
  const treeSpots = [];
  for (let i = 0; i < 40 && treeSpots.length < 18; i++) {
    const a = rand(0, Math.PI * 2), r = rand(42, 128);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inCircle(x, z, POND, 1.6) || inEllipse(x, z, MUD, 1.8) || inBarn(x, z, 2.2)) continue;
    let ok = true;
    for (const [x1, z1, x2, z2, w] of PATHS) if (distToSeg(x, z, x1, z1, x2, z2) < w + 2.5) ok = false;
    if (ok) treeSpots.push([x, z, rand(0.8, 1.5)]);
  }
  treeSpots.push([26, -20, 1.2], [-26.5, -19.5, 1.05]); // 2 cây trong sân
  for (const [x, z, s] of treeSpots) {
    const tree = makeTree(s);
    tree.position.set(x, 0, z);
    scene.add(tree);
    colliders.push({ x, z, r: 0.8 * s });
  }
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), r = rand(30, 125);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inCircle(x, z, POND, 1.4) || inBarn(x, z, 1.8)) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 1.3), 0), mat(0x8d9298, { flatShading: true }));
    rock.position.set(x, 0.25, z);
    rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    rock.castShadow = true;
    scene.add(rock);
    if (rock.geometry.parameters.radius > 0.7) colliders.push({ x, z, r: rock.geometry.parameters.radius });
  }
}

// ---- mây
const clouds = [];
{
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < randInt(4, 6); j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(1.6, 3), 10, 8), cloudMat);
      puff.position.set(rand(-4, 4), rand(-0.5, 1), rand(-2, 2));
      puff.scale.y = 0.6;
      g.add(puff);
    }
    g.position.set(rand(-150, 150), rand(42, 62), rand(-150, 150));
    g.scale.setScalar(rand(1.6, 3.2));
    scene.add(g);
    clouds.push({ g, speed: rand(0.4, 1) });
  }
}

/* ---------------- cỏ (instanced) + hoa ---------------- */
let grassMesh = null, flowerGroup = null;
const grassUniforms = { uTime: { value: 0 } };

function buildGrass() {
  if (grassMesh) { scene.remove(grassMesh); grassMesh.geometry.dispose(); grassMesh.material.dispose(); }
  if (flowerGroup) { scene.remove(flowerGroup); flowerGroup.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  const q = QUALITY[S.quality];

  const blade = new THREE.PlaneGeometry(0.13, 1.15, 1, 3);
  blade.translate(0, 0.575, 0);
  {
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const taper = 1 - (p.getY(i) / 1.15) * 0.92;
      p.setX(i, p.getX(i) * taper);
    }
  }
  const gMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  gMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        transformed.x += sin(uTime * 1.7 + wp.x * 0.35 + wp.z * 0.27) * position.y * 0.16;
        transformed.z += cos(uTime * 1.35 + wp.x * 0.21) * position.y * 0.09;
      #endif`
    );
  };
  grassMesh = new THREE.InstancedMesh(blade, gMat, q.grass);
  grassMesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < q.grass && guard++ < q.grass * 4) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (WORLD_R - 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inCircle(x, z, POND, 1.05) || inEllipse(x, z, MUD, 1.02) || inBarn(x, z, 1.25)) continue;
    let skip = false;
    for (const [x1, z1, x2, z2, w] of PATHS) if (distToSeg(x, z, x1, z1, x2, z2) < w * 0.85) skip = true;
    if (skip) continue;
    e.set(rand(-0.15, 0.15), rand(0, Math.PI * 2), rand(-0.15, 0.15));
    q4.setFromEuler(e);
    v3.set(x, 0, z);
    s3.set(rand(0.8, 1.3), rand(0.6, 1.5), 1);
    m4.compose(v3, q4, s3);
    grassMesh.setMatrixAt(placed, m4);
    col.setHSL(rand(0.24, 0.31), rand(0.45, 0.62), rand(0.3, 0.46), THREE.SRGBColorSpace);
    grassMesh.setColorAt(placed, col);
    placed++;
  }
  grassMesh.count = placed;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  scene.add(grassMesh);

  // hoa
  flowerGroup = new THREE.Group();
  const stemMat = mat(0x3f7a2e), headGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.3, 5);
  const headCols = [0xf2d54b, 0xf2889f, 0xffffff, 0xa97ef0, 0xff8c5a];
  for (let i = 0; i < q.flowers; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (WORLD_R - 6);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inCircle(x, z, POND, 1.05) || inEllipse(x, z, MUD, 1.1) || inBarn(x, z, 1.3)) continue;
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(x, 0.15, z);
    const head = new THREE.Mesh(headGeo, mat(pick(headCols)));
    head.position.set(x, 0.34, z);
    flowerGroup.add(stem, head);
  }
  scene.add(flowerGroup);
}
buildGrass();

/* ---------------- bươm bướm ---------------- */
const butterflies = [];
for (let i = 0; i < 6; i++) {
  const b = new THREE.Group();
  const wingGeo = new THREE.PlaneGeometry(0.22, 0.16);
  const wingMat = mat(pick([0xf2d54b, 0xf2889f, 0xa97ef0, 0xff8c5a]), { side: THREE.DoubleSide });
  const wl = new THREE.Mesh(wingGeo, wingMat), wr = new THREE.Mesh(wingGeo, wingMat);
  wl.position.x = -0.1; wr.position.x = 0.1;
  b.add(wl, wr);
  b.userData = { wl, wr, cx: rand(-25, 25), cz: rand(-15, 15), r: rand(2, 7), w: rand(0.4, 0.9), ph: rand(0, 9) };
  scene.add(b);
  butterflies.push(b);
}

/* ---------------- HEO ---------------- */
const OINK_TEXTS = ['ụt ịt!', 'oink!', 'oink oink!', 'ịt ịt!', 'ụt ụt!'];
const BODIES = [0xf2a3b3, 0xf4b3ad, 0xf7c1c9, 0xef9aa8];

function textSprite(text, color = '#ffffff', outline = 'rgba(30,20,25,.65)') {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = outline;
  ctx.strokeText(text, 128, 50);
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.9, 0.72, 1);
  return sp;
}

function makePig({ scale = 1, body = pick(BODIES) } = {}) {
  const g = new THREE.Group();
  const dark = new THREE.Color(body).multiplyScalar(0.82).getHex();
  const darker = new THREE.Color(body).multiplyScalar(0.62).getHex();

  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), mat(body));
  bodyMesh.scale.set(1.22, 0.95, 1.5);
  bodyMesh.position.y = 0.98;
  bodyMesh.castShadow = true;
  g.add(bodyMesh);

  // đốm (30% heo có đốm)
  if (Math.random() < 0.35) {
    for (let i = 0; i < randInt(2, 4); i++) {
      const spot = new THREE.Mesh(new THREE.SphereGeometry(rand(0.1, 0.17), 8, 6), mat(darker));
      const a = rand(0, Math.PI * 2);
      spot.position.set(Math.cos(a) * 0.72, rand(0.7, 1.3), rand(-0.7, 0.7));
      spot.scale.set(1, 0.55, 1);
      g.add(spot);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 1.3, 1.05);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat(body));
  skull.scale.set(0.92, 0.85, 0.95);
  skull.castShadow = true;
  head.add(skull);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.18, 12), mat(dark));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.5);
  head.add(snout);
  for (const sx of [-0.07, 0.07]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat(0x8c4a5c));
    nostril.position.set(sx, -0.05, 0.6);
    head.add(nostril);
  }
  for (const sx of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0x241a1e));
    eye.position.set(sx, 0.14, 0.42);
    head.add(eye);
  }
  for (const sx of [-0.26, 0.26]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), mat(dark));
    ear.position.set(sx, 0.38, 0.02);
    ear.rotation.set(-0.35, 0, sx > 0 ? -0.5 : 0.5);
    ear.castShadow = true;
    head.add(ear);
  }
  g.add(head);

  const legs = [];
  for (const [lx, lz] of [[-0.4, 0.58], [0.4, 0.58], [-0.4, -0.6], [0.4, -0.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.52, 8), mat(dark));
    leg.position.set(lx, 0.26, lz);
    leg.castShadow = true;
    g.add(leg);
    legs.push(leg);
  }

  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 12, 4.4), mat(dark));
  tail.position.set(0, 1.12, -1.28);
  tail.rotation.y = Math.PI / 2;
  g.add(tail);

  // lớp bùn phủ lên người
  const mudCoat = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), new THREE.MeshLambertMaterial({ color: 0x5b3d24, transparent: true, opacity: 0 }));
  mudCoat.scale.set(1.24, 0.97, 1.52);
  mudCoat.position.y = 0.98;
  g.add(mudCoat);

  g.scale.setScalar(scale);
  const pig = {
    group: g, head, legs, tail, bodyMesh, mudCoat,
    scale, bodyColor: body,
    pos: new THREE.Vector3(), yaw: rand(0, Math.PI * 2),
    velX: 0, velZ: 0, vy: 0, grounded: true,
    walkPhase: rand(0, 9), speed: 0,
    state: 'idle', stateT: rand(1, 4), target: new THREE.Vector2(),
    mudLevel: 0, oinkT: 0, isPlayer: false, isBaby: scale < 0.7,
    seed: rand(0, 100),
  };
  g.userData.pig = pig;
  return pig;
}

function setPigPos(pig, x, z) { pig.pos.set(x, 0, z); pig.group.position.set(x, 0, z); }

const pigs = [];
let player = null;
function spawnPlayer() {
  player = makePig({ scale: 1.08, body: 0xf7c1c9 });
  player.isPlayer = true;
  setPigPos(player, 0, 12);
  player.yaw = Math.PI; // nhìn về phía chuồng
  scene.add(player.group);
  pigs.push(player);
}
function spawnNpc(i) {
  const pig = makePig({ scale: rand(0.85, 1.05) });
  const a = (i / 7) * Math.PI * 2;
  setPigPos(pig, clamp(Math.cos(a) * 16, YARD.x0 + 2, YARD.x1 - 2), clamp(Math.sin(a) * 12, YARD.z0 + 2, YARD.z1 - 2));
  pig.state = 'wander'; pig.stateT = rand(0, 3);
  scene.add(pig.group);
  pigs.push(pig);
}
spawnPlayer();
for (let i = 0; i < 7; i++) spawnNpc(i);

/* ---------------- va chạm ---------------- */
function resolveCollisions(pos, prev) {
  // chuồng (AABB)
  if (Math.abs(pos.x - BARN.x) < BARN.hx + 0.35 && Math.abs(pos.z - BARN.z) < BARN.hz + 0.35) {
    if (Math.abs(pos.x - BARN.x) / (BARN.hx) > Math.abs(pos.z - BARN.z) / (BARN.hz)) pos.x = prev.x;
    else pos.z = prev.z;
  }
  const T = 0.4;
  const wallX = (wx, z0, z1) => {
    if (Math.abs(pos.x - wx) < T && pos.z > z0 - 0.2 && pos.z < z1 + 0.2) {
      pos.x = prev.x > wx ? wx + T : wx - T;
    }
  };
  const wallZ = (wz, x0, x1) => {
    if (Math.abs(pos.z - wz) < T && pos.x > x0 - 0.2 && pos.x < x1 + 0.2) {
      pos.z = prev.z > wz ? wz + T : wz - T;
    }
  };
  wallX(YARD.x0, YARD.z0, YARD.z1);
  wallX(YARD.x1, YARD.z0, YARD.z1);
  wallZ(YARD.z0, YARD.x0, YARD.x1);
  wallZ(YARD.z1, YARD.x0, -YARD.gate);
  wallZ(YARD.z1, YARD.gate, YARD.x1);
  // tròn: cây, đá, rơm, máng
  for (const c of colliders) {
    const dx = pos.x - c.x, dz = pos.z - c.z;
    const d = Math.hypot(dx, dz), min = c.r + 0.42;
    if (d < min && d > 0.001) {
      pos.x = c.x + (dx / d) * min;
      pos.z = c.z + (dz / d) * min;
    }
  }
  // biên thế giới
  const r = Math.hypot(pos.x, pos.z);
  if (r > WORLD_R) { pos.x *= WORLD_R / r; pos.z *= WORLD_R / r; }
}

/* ---------------- camera ---------------- */
const cam = { yaw: 0, pitch: 0.34, dist: 8.5, pos: new THREE.Vector3(0, 5, 20) };
function updateCamera(dt) {
  if (S.cinematic) cam.yaw += dt * 0.14;
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const off = new THREE.Vector3(Math.sin(cam.yaw) * cp, sp, Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist);
  const want = target.clone().add(off);
  cam.pos.x = damp(cam.pos.x, want.x, 7, dt);
  cam.pos.y = damp(cam.pos.y, want.y, 7, dt);
  cam.pos.z = damp(cam.pos.z, want.z, 7, dt);
  if (cam.pos.y < 0.5) cam.pos.y = 0.5;
  camera.position.copy(cam.pos);
  camera.lookAt(target);
}

/* ---------------- âm thanh (WebAudio tổng hợp) ---------------- */
const sfx = {
  ctx: null, master: null, rainNode: null,
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  noiseBuf(dur = 1) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  oink(pitch = 1, vol = 1) {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(95 * pitch, t + 0.16);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 1300 * pitch;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.03);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(flt).connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.22);
  },
  squeal() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(1100, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.3);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.34);
  },
  splash() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(0.5);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 750;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.6, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(flt).connect(gn).connect(this.master);
    src.start(t);
  },
  pop() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(820, t + 0.09);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.35, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.13);
  },
  crunch() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure();
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.09;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(0.06);
      const flt = ctx.createBiquadFilter();
      flt.type = 'highpass'; flt.frequency.value = 1400;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.3, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      src.connect(flt).connect(gn).connect(this.master);
      src.start(t);
    }
  },
  chirp() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    for (let i = 0; i < randInt(2, 4); i++) {
      const st = t + i * rand(0.12, 0.2);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const f = rand(2500, 3300);
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 1.25, st + 0.06);
      osc.frequency.exponentialRampToValueAtTime(f * 0.9, st + 0.12);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, st);
      gn.gain.exponentialRampToValueAtTime(0.12, st + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, st + 0.14);
      osc.connect(gn).connect(this.master);
      osc.start(st); osc.stop(st + 0.16);
    }
  },
  setRain(on) {
    if (this.rainNode && !on) {
      this.rainNode.src.stop();
      this.rainNode = null;
      return;
    }
    if (on && !this.rainNode) {
      const ctx = this.ensure();
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(2);
      src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 850;
      const gn = ctx.createGain(); gn.gain.value = 0.14;
      src.connect(flt).connect(gn).connect(this.master);
      src.start();
      this.rainNode = { src, gn };
    }
  },
};
function playOink(pig, loud = 1) {
  sfx.oink(pig.isBaby ? rand(1.6, 1.9) : rand(0.9, 1.15), loud);
  pig.oinkT = 0.4;
  const sp = textSprite(pick(OINK_TEXTS), pig.isBaby ? '#ffd6e0' : '#ffffff');
  sp.position.copy(pig.group.position).add(new THREE.Vector3(0, 2.1 * pig.scale, 0));
  scene.add(sp);
  floaters.push({ sp, life: 1.1, vy: 0.9 });
  if (pig.isPlayer) { oinkCount++; oinkCountEl.textContent = oinkCount; attractPigs(); }
}

/* ---------------- hạt (splash / trái tim) ---------------- */
const floaters = [];
const splashPool = [];
{
  const geo = new THREE.SphereGeometry(0.09, 6, 5);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5b3d24 }));
    m.visible = false;
    scene.add(m);
    splashPool.push({ m, life: 0, v: new THREE.Vector3() });
  }
}
function spawnSplash(x, y, z, n = 12, color = 0x5b3d24) {
  let used = 0;
  for (const p of splashPool) {
    if (p.life > 0) continue;
    p.m.material.color.setHex(color);
    p.m.position.set(x + rand(-0.3, 0.3), y + rand(0, 0.2), z + rand(-0.3, 0.3));
    p.v.set(rand(-2, 2), rand(2.5, 5), rand(-2, 2));
    p.life = rand(0.5, 0.8);
    p.m.visible = true;
    if (++used >= n) break;
  }
}
function spawnHearts(x, y, z, n = 3) {
  for (let i = 0; i < n; i++) {
    const sp = textSprite('💗');
    sp.scale.set(0.55, 0.55, 1);
    sp.position.set(x + rand(-0.6, 0.6), y + rand(0.4, 1), z + rand(-0.6, 0.6));
    scene.add(sp);
    floaters.push({ sp, life: rand(0.9, 1.4), vy: 0.7 });
  }
}

/* ---------------- mưa ---------------- */
const RAIN_N = 650;
const rain = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.025, 0.6, 0.025),
  new THREE.MeshBasicMaterial({ color: 0xaecbe8, transparent: true, opacity: 0.45 }),
  RAIN_N
);
rain.frustumCulled = false;
rain.visible = false;
const rainPos = [];
for (let i = 0; i < RAIN_N; i++) rainPos.push(new THREE.Vector3(rand(-35, 35), rand(0, 26), rand(-35, 35)));
scene.add(rain);
const rainM4 = new THREE.Matrix4();
function updateRain(dt) {
  rain.visible = S.weather === 'rain';
  if (!rain.visible) return;
  for (let i = 0; i < RAIN_N; i++) {
    const p = rainPos[i];
    p.y -= 21 * dt;
    if (p.y < 0) { p.y += 26; p.x = rand(-35, 35); p.z = rand(-35, 35); }
    rainM4.makeTranslation(camera.position.x + p.x, p.y, camera.position.z + p.z);
    rain.setMatrixAt(i, rainM4);
  }
  rain.instanceMatrix.needsUpdate = true;
}

/* ---------------- bầu trời theo giờ + thời tiết ---------------- */
const C_DAY_TOP = new THREE.Color(0x4f9ff0), C_DAY_HOR = new THREE.Color(0xbfe3ff);
const C_DUSK_TOP = new THREE.Color(0x39497e), C_DUSK_HOR = new THREE.Color(0xff9c5f);
const C_NIGHT_TOP = new THREE.Color(0x060c1d), C_NIGHT_HOR = new THREE.Color(0x121d33);
const C_GREY = new THREE.Color(0x8d979f);
const tmpTop = new THREE.Color(), tmpHor = new THREE.Color(), tmpC = new THREE.Color();
const sunDir = new THREE.Vector3();

function updateSky(dt) {
  if (S.time === 'cycle') timeState.t = (timeState.t + dt / DAY_LEN) % 1;
  else timeState.t = TIME_PRESET[S.time];
  const ang = (timeState.t - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(ang), Math.sin(ang), 0.32).normalize();
  const e = sunDir.y;

  const f1 = smoothstep(-0.18, 0.1, e);  // đêm → hoàng hôn
  const f2 = smoothstep(0.06, 0.42, e);  // hoàng hôn → ban ngày
  tmpTop.copy(C_NIGHT_TOP).lerp(C_DUSK_TOP, f1).lerp(C_DAY_TOP, f2);
  tmpHor.copy(C_NIGHT_HOR).lerp(C_DUSK_HOR, f1).lerp(C_DAY_HOR, f2);

  // thời tiết làm xỉn màu
  const grey = S.weather === 'rain' ? 0.72 : S.weather === 'cloudy' ? 0.45 : 0;
  if (grey > 0) {
    tmpC.copy(C_GREY).multiplyScalar(0.35 + 0.65 * Math.max(f1, f2));
    tmpTop.lerp(tmpC, grey); tmpHor.lerp(tmpC, grey);
  }
  skyMat.uniforms.top.value.copy(tmpTop);
  skyMat.uniforms.mid.value.copy(tmpHor);
  scene.fog.color.copy(tmpHor);
  scene.fog.near = S.weather === 'rain' ? 25 : 45;
  scene.fog.far = S.weather === 'rain' ? 130 : 185;

  // nắng
  const dayI = smoothstep(-0.04, 0.3, e) * (S.weather === 'rain' ? 0.35 : S.weather === 'cloudy' ? 0.6 : 1);
  sun.intensity = dayI * 2.3;
  tmpC.set(0xffb26b).lerp(new THREE.Color(0xfff2df), smoothstep(0.05, 0.45, e));
  sun.color.copy(tmpC);
  sun.position.copy(player.pos).addScaledVector(sunDir, 90);
  sun.target.position.copy(player.pos);
  // trăng
  moon.intensity = smoothstep(0.08, -0.22, -e) * 0.55 * (S.weather === 'clear' ? 1 : 0.35);
  moon.position.copy(player.pos).addScaledVector(sunDir, -80);
  hemi.intensity = 0.2 + dayI * 0.45;

  // đĩa mặt trời/trăng + sao
  skyGroup.position.copy(camera.position);
  sunDisc.position.copy(sunDir).multiplyScalar(470);
  sunDisc.lookAt(camera.position);
  sunDisc.visible = e > -0.12;
  moonDisc.position.copy(sunDir).multiplyScalar(-470);
  moonDisc.lookAt(camera.position);
  moonDisc.visible = e < 0.12;
  stars.material.opacity = smoothstep(0.02, -0.18, e) * (S.weather === 'clear' ? 0.9 : 0.15);

  // mây: mưa/mây nhiều → màu xám
  const cloudCol = S.weather === 'clear' ? 0xffffff : S.weather === 'cloudy' ? 0xc9ced4 : 0x8f98a2;
  for (const c of clouds) {
    c.g.children[0].material.color.setHex(cloudCol);
    c.g.children[0].material.opacity = S.weather === 'rain' ? 0.98 : 0.92;
  }
}

/* ---------------- heo NPC: AI ---------------- */
function yardPoint() {
  for (let i = 0; i < 12; i++) {
    const x = rand(YARD.x0 + 2, YARD.x1 - 2), z = rand(YARD.z0 + 2, YARD.z1 - 2);
    if (inBarn(x, z, 1.4) || (Math.abs(x - TROUGH.x) < 2 && Math.abs(z - TROUGH.z) < 2)) continue;
    if (inCircle(x, z, POND, 1.2) && Math.random() < 0.7) continue;
    return new THREE.Vector2(x, z);
  }
  return new THREE.Vector2(0, 8);
}
function attractPigs() {
  for (const p of pigs) {
    if (p.isPlayer) continue;
    if (p.pos.distanceTo(player.pos) < 28) {
      p.state = 'follow'; p.stateT = rand(6, 9);
    }
  }
}
function updatePigAI(pig, dt, t) {
  pig.stateT -= dt;
  if (pig.stateT <= 0) {
    if (pig.state === 'follow') { pig.state = 'idle'; pig.stateT = rand(1, 3); }
    else if (pig.state === 'idle') {
      if (Math.random() < 0.18) { pig.state = 'eat'; pig.stateT = rand(2.5, 4); pig.target.set(TROUGH.x + rand(-1.5, 1.5), TROUGH.z + rand(1, 2)); }
      else if (Math.random() < 0.25) { pig.state = 'mudBath'; pig.stateT = rand(4, 8); pig.target.set(MUD.x + rand(-2.5, 2.5), MUD.z + rand(-1.8, 1.8)); }
      else { pig.state = 'wander'; pig.stateT = rand(4, 9); const pt = yardPoint(); pig.target.copy(pt); }
    } else { pig.state = 'idle'; pig.stateT = rand(1.5, 4); }
  }

  let speed = 0, tx = null, tz = null;
  if (pig.state === 'wander') { tx = pig.target.x; tz = pig.target.y; speed = 1.25; }
  else if (pig.state === 'follow') {
    tx = player.pos.x; tz = player.pos.z; speed = 2.3;
    const d = Math.hypot(tx - pig.pos.x, tz - pig.pos.z);
    if (d < 1.7) { tx = null; speed = 0; if (Math.random() < dt * 1.2) { pig.group.position.y = 0.25; } }
  } else if (pig.state === 'eat' || pig.state === 'mudBath') {
    tx = pig.target.x; tz = pig.target.y; speed = 1.6;
    const d = Math.hypot(tx - pig.pos.x, tz - pig.pos.z);
    if (d < 0.8) {
      tx = null; speed = 0;
      pig.head.rotation.x = Math.sin(t * 6 + pig.seed) * 0.25 - 0.15;
      if (pig.state === 'mudBath' && inEllipse(pig.pos.x, pig.pos.z, MUD)) pig.mudLevel = Math.min(1, pig.mudLevel + dt * 0.5);
    }
  } else if (pig.state === 'flee') {
    speed = 3.8;
    const dx = pig.pos.x - pig.fleeFrom.x, dz = pig.pos.z - pig.fleeFrom.z;
    const d = Math.hypot(dx, dz) || 1;
    tx = pig.pos.x + (dx / d) * 6; tz = pig.pos.z + (dz / d) * 6;
    tx = clamp(tx, YARD.x0 + 1, YARD.x1 - 1); tz = clamp(tz, YARD.z0 + 1, YARD.z1 - 1);
  }

  if (tx !== null) {
    const wantYaw = Math.atan2(tx - pig.pos.x, tz - pig.pos.z);
    pig.yaw = lerpAngle(pig.yaw, wantYaw, 1 - Math.exp(-6 * dt));
    pig.speed = damp(pig.speed, speed, 8, dt);
  } else {
    pig.speed = damp(pig.speed, 0, 10, dt);
  }

  // tách đàn nhẹ
  for (const other of pigs) {
    if (other === pig) continue;
    const dx = pig.pos.x - other.pos.x, dz = pig.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.05 && d > 0.01) {
      pig.pos.x += (dx / d) * dt * 1.2;
      pig.pos.z += (dz / d) * dt * 1.2;
    }
  }

  const prevX = pig.pos.x, prevZ = pig.pos.z;
  pig.pos.x += Math.sin(pig.yaw) * pig.speed * dt;
  pig.pos.z += Math.cos(pig.yaw) * pig.speed * dt;
  if (!pig.isPlayer) resolveCollisions(pig.pos, new THREE.Vector3(prevX, 0, prevZ));
  // heo NPC luôn ở trong sân
  if (!pig.isPlayer) {
    pig.pos.x = clamp(pig.pos.x, YARD.x0 + 1, YARD.x1 - 1);
    pig.pos.z = clamp(pig.pos.z, YARD.z0 + 1, YARD.z1 - 1);
  }
}
function updatePigAnim(pig, dt, t) {
  const g = pig.group;
  g.position.x = pig.pos.x;
  g.position.z = pig.pos.z;
  // nhảy theo trạng thái follow happy
  if (pig.state === 'follow' && pig.speed < 0.2 && Math.random() < dt * 1.2) g.position.y = Math.max(g.position.y, 0.28);
  g.position.y = Math.max(0, g.position.y - dt * 2.4);
  g.rotation.y = pig.yaw;

  const moving = pig.speed > 0.15;
  if (moving) {
    pig.walkPhase += dt * (4 + pig.speed * 2.4) * (pig.isBaby ? 1.5 : 1);
    const amp = clamp(pig.speed * 0.12, 0.1, 0.55);
    pig.legs[0].rotation.x = Math.sin(pig.walkPhase) * amp;
    pig.legs[3].rotation.x = Math.sin(pig.walkPhase) * amp;
    pig.legs[1].rotation.x = Math.sin(pig.walkPhase + Math.PI) * amp;
    pig.legs[2].rotation.x = Math.sin(pig.walkPhase + Math.PI) * amp;
    g.position.y += Math.abs(Math.sin(pig.walkPhase)) * 0.05 * amp * 2;
  } else {
    for (const l of pig.legs) l.rotation.x = damp(l.rotation.x, 0, 10, dt);
  }
  // đuôi + thở
  pig.tail.rotation.z = Math.sin(t * (pig.isBaby ? 5 : 3) + pig.seed) * 0.35;
  pig.bodyMesh.scale.y = 0.95 + Math.sin(t * 2 + pig.seed) * 0.012;
  // oink: ngẩng đầu
  if (pig.oinkT > 0) {
    pig.oinkT -= dt;
    pig.head.rotation.x = -0.6 * Math.sin(clamp(pig.oinkT / 0.4, 0, 1) * Math.PI);
  } else if (!moving && pig.state !== 'eat' && pig.state !== 'mudBath') {
    pig.head.rotation.x = damp(pig.head.rotation.x, Math.sin(t * 0.8 + pig.seed) * 0.06, 4, dt);
  }
  // bùn bám
  pig.mudLevel = Math.max(0, pig.mudLevel - dt / 40);
  pig.mudCoat.material.opacity = pig.mudLevel * 0.8;
  // hêo nghe tiếng kêu thì thỉnh thoảng kêu lại
  if (!pig.isPlayer && S.sound && Math.random() < dt * 0.02) playOink(pig, 0.25);
}

/* ---------------- người chơi ---------------- */
const input = { x: 0, z: 0, run: false, jump: false };
let oinkCount = 0;
const keys = {};
let jumpQueued = false;

function playerUpdate(dt, t) {
  // hướng đi theo camera
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
  let mx = fwd.x * input.z + right.x * input.x;
  let mz = fwd.z * input.z + right.z * input.x;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }

  const inMud = inEllipse(player.pos.x, player.pos.z, MUD);
  const inPond = inCircle(player.pos.x, player.pos.z, POND, 0.85);
  let maxSpeed = (input.run ? 6.2 : 3.1) * (inMud ? 0.6 : 1) * (inPond ? 0.55 : 1);
  const targetVx = mx * maxSpeed, targetVz = mz * maxSpeed;
  player.velX = damp(player.velX || 0, targetVx, 10, dt);
  player.velZ = damp(player.velZ || 0, targetVz, 10, dt);

  const prev = new THREE.Vector3(player.pos.x, 0, player.pos.z);
  player.pos.x += player.velX * dt;
  player.pos.z += player.velZ * dt;
  resolveCollisions(player.pos, prev);

  // trọng lực + nhảy
  player.vy -= 24 * dt;
  let gy = 0;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= gy) {
    if (!player.grounded && player.vy < -6) {
      if (inMud) { spawnSplash(player.pos.x, 0.2, player.pos.z, 16); sfx.splash(); player.mudLevel = 1; showToast('Ọt… lấm bùn hết rồi 🐷'); }
      else if (inPond) { spawnSplash(player.pos.x, 0.2, player.pos.z, 16, 0x7db4dd); sfx.splash(); }
      else sfx.oink(0.7, 0.15);
    }
    player.pos.y = gy; player.vy = 0; player.grounded = true;
  } else player.grounded = false;
  if (jumpQueued) {
    jumpQueued = false;
    if (player.grounded) { player.vy = 8.6; player.grounded = false; sfx.oink(1.4, 0.2); }
  }
  if (inMud && (Math.abs(player.velX) + Math.abs(player.velZ)) > 3 && Math.random() < dt * 3) {
    spawnSplash(player.pos.x, 0.15, player.pos.z, 3);
    player.mudLevel = Math.min(1, player.mudLevel + dt * 0.8);
  }

  // xoay người theo hướng chạy
  const hs = Math.hypot(player.velX, player.velZ);
  if (hs > 0.4) player.yaw = lerpAngle(player.yaw, Math.atan2(player.velX, player.velZ), 1 - Math.exp(-12 * dt));
  player.speed = hs;
  player.group.position.y = player.pos.y;
  updatePigAnim(player, dt, t);
}
function tryEat() {
  const d = Math.hypot(player.pos.x - TROUGH.x, player.pos.z - TROUGH.z);
  if (d < 3) {
    sfx.crunch();
    spawnHearts(player.pos.x, 1.6, player.pos.z, 3);
    playOink(player, 0.8);
    showToast('Ngon! Cám thơm phức 🌽');
  } else {
    showToast('Đói thì ra máng ăn gần chuồng đã 🌽');
  }
}
function spawnBaby() {
  const babies = pigs.filter(p => p.isBaby).length;
  if (pigs.length >= 26) { showToast('Trại quá đông rồi, chả nuôi nổi 😅'); return; }
  const baby = makePig({ scale: rand(0.42, 0.55) });
  const a = rand(0, Math.PI * 2);
  setPigPos(baby, clamp(player.pos.x + Math.cos(a) * 2, YARD.x0 + 2, YARD.x1 - 2), clamp(player.pos.z + Math.sin(a) * 2, YARD.z0 + 2, YARD.z1 - 2));
  baby.state = 'follow'; baby.stateT = rand(8, 14);
  scene.add(baby.group);
  pigs.push(baby);
  sfx.pop();
  playOink(baby, 0.9);
  showToast('Heo con vừa chào đời! 🐷 (' + pigs.filter(p => p.isBaby).length + ' heo con)');
  pigCountEl.textContent = pigs.length;
}

/* ---------------- input: bàn phím ---------------- */
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
  if (e.code === 'KeyE') playOink(player);
  if (e.code === 'KeyB') spawnBaby();
  if (e.code === 'KeyF') tryEat();
  if (e.code === 'KeyC') { S.cinematic = !S.cinematic; document.body.classList.toggle('cinematic', S.cinematic); showToast(S.cinematic ? 'Chế độ điện ảnh — bấm C để thoát' : 'Đã thoát chế độ điện ảnh'); }
  if (e.code === 'F3') { S.debug = !S.debug; debugEl.style.display = S.debug ? 'block' : 'none'; e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function readKeys() {
  let x = 0, z = 0;
  if (keys.KeyW || keys.ArrowUp) z += 1;
  if (keys.KeyS || keys.ArrowDown) z -= 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (isTouch && joyVec.active) { x = joyVec.x; z = -joyVec.y; }
  input.x = x; input.z = z;
  input.run = !!(keys.ShiftLeft || keys.ShiftRight) || touchRun;
}

/* ---------------- input: chuột / chạm ---------------- */
const isTouch = TOUCH;
if (isTouch) document.body.classList.add('touch');
const joyVec = { x: 0, y: 0, active: false };
let touchRun = false;

let dragging = false, dragMoved = 0, downTime = 0, lastX = 0, lastY = 0, activePointer = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointer = e.pointerId;
  dragging = true; dragMoved = 0; downTime = performance.now();
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== activePointer) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  cam.yaw -= dx * 0.0045;
  cam.pitch = clamp(cam.pitch + dy * 0.003, 0.06, 1.25);
  if (S.cinematic && dragMoved > 8) { S.cinematic = false; document.body.classList.remove('cinematic'); }
});
addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointer) return;
  dragging = false; activePointer = null;
  if (dragMoved < 7 && performance.now() - downTime < 350) tapPick(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('wheel', (e) => {
  cam.dist = clamp(cam.dist * (1 + e.deltaY * 0.001), 4, 17);
  e.preventDefault();
}, { passive: false });

// joystick
const joyEl = $('joy'), knobEl = joyEl.querySelector('.knob');
let joyPointer = null;
joyEl.addEventListener('pointerdown', (e) => { joyPointer = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) joyMove(e); });
joyEl.addEventListener('pointerup', (e) => {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null; joyVec.active = false; joyVec.x = joyVec.y = 0;
  knobEl.style.transform = 'translate(-50%,-50%)';
});
function joyMove(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy), max = r.width / 2 - 18;
  if (len > max) { dx *= max / len; dy *= max / len; }
  joyVec.x = dx / max; joyVec.y = dy / max; joyVec.active = true;
  knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
// nút cảm ứng
const bindBtn = (id, down, up) => {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { down(); e.preventDefault(); });
  if (up) el.addEventListener('pointerup', up);
};
bindBtn('tJump', () => { jumpQueued = true; });
bindBtn('tOink', () => playOink(player));
bindBtn('tEat', () => tryEat());
bindBtn('tRun', () => { touchRun = !touchRun; $('tRun').classList.toggle('on', touchRun); });

/* ---------------- chạm vào heo → nó bỏ chạy ---------------- */
const raycaster = new THREE.Raycaster();
function tapPick(cx, cy) {
  raycaster.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const targets = pigs.filter(p => !p.isPlayer).map(p => p.group);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.pig) o = o.parent;
    if (o && o.userData.pig) {
      const pig = o.userData.pig;
      pig.state = 'flee'; pig.stateT = rand(2, 3); pig.fleeFrom = player.pos.clone();
      sfx.squeal();
      const sp = textSprite(pick(['hự!', 'á á!', 'ơ kìa!', 'chạy đi!']));
      sp.position.copy(pig.group.position).add(new THREE.Vector3(0, 2.1 * pig.scale, 0));
      scene.add(sp);
      floaters.push({ sp, life: 1, vy: 1 });
    }
  }
}

/* ---------------- UI ---------------- */
let toastTimer = null;
function showToast(msg, dur = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}
$('selQuality').addEventListener('change', (e) => {
  S.quality = e.target.value;
  applyQuality();
  showToast('Chất lượng: ' + e.target.selectedOptions[0].text);
});
$('selWeather').addEventListener('change', (e) => {
  S.weather = e.target.value;
  sfx.setRain(S.sound && S.weather === 'rain');
  showToast({ clear: 'Trời nắng đẹp ☀️', cloudy: 'Trời nhiều mây ☁️', rain: 'Mưa rồi! Heo thích bùn lắm 🌧️' }[S.weather]);
});
$('selTime').addEventListener('change', (e) => {
  S.time = e.target.value;
  showToast({ cycle: 'Ngày đêm trôi qua…', morning: 'Sáng rồi, heo dậy ăn 🌅', noon: 'Trưa nắng 🌞', golden: 'Chiều vàng êm ả 🌾', sunset: 'Hoàng hôn buông 🌇', night: 'Đêm rồi, heo ngủ 💤' }[S.time]);
});
$('btnSound').addEventListener('click', () => {
  S.sound = !S.sound;
  const b = $('btnSound');
  b.textContent = S.sound ? 'Bật' : 'Tắt';
  b.classList.toggle('on', S.sound);
  if (S.sound) { sfx.ensure(); sfx.pop(); }
  sfx.setRain(S.sound && S.weather === 'rain');
});
function applyQuality() {
  const q = QUALITY[S.quality];
  renderer.setPixelRatio(Math.min(devicePixelRatio, q.px, SMALL ? 1.25 : 3));
  renderer.shadowMap.enabled = q.shadow;
  sun.castShadow = q.shadow;
  sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  buildGrass();
}
applyQuality();
$('selQuality').value = S.quality;
pigCountEl.textContent = pigs.length;

/* ---------------- vòng lặp chính ---------------- */
const clock = new THREE.Clock();
let frames = 0, fpsT = 0, fps = 0, birdT = rand(3, 8);
let introStep = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  grassUniforms.uTime.value = t;

  readKeys();
  playerUpdate(dt, t);
  for (const p of pigs) {
    if (!p.isPlayer) { updatePigAI(p, dt, t); updatePigAnim(p, dt, t); }
  }
  updateCamera(dt);
  updateSky(dt);
  updateRain(dt);

  // mây trôi
  for (const c of clouds) {
    c.g.position.x += c.speed * dt * 0.8;
    if (c.g.position.x > 160) c.g.position.x = -160;
  }
  // bươm bướm
  for (const b of butterflies) {
    const u = b.userData, k = t * u.w + u.ph;
    b.position.set(u.cx + Math.cos(k) * u.r, 0.9 + Math.sin(k * 2.3) * 0.35, u.cz + Math.sin(k * 0.9) * u.r);
    b.rotation.y = -k + Math.PI / 2;
    const flap = Math.sin(t * 18 + u.ph) * 0.95;
    u.wl.rotation.y = flap; u.wr.rotation.y = -flap;
  }
  // hạt bay
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.sp.position.y += f.vy * dt;
    f.sp.material.opacity = clamp(f.life * 1.6, 0, 1);
    if (f.life <= 0) { scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); floaters.splice(i, 1); }
  }
  for (const p of splashPool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.v.y -= 12 * dt;
    p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < 0.05) p.m.position.y = 0.05;
    p.m.scale.setScalar(clamp(p.life, 0.2, 1));
    if (p.life <= 0) p.m.visible = false;
  }
  // chim hót ban ngày
  if (S.sound && S.weather !== 'rain') {
    birdT -= dt;
    if (birdT <= 0) { birdT = rand(4, 10); const e = sunDir.y; if (e > 0.05) sfx.chirp(); }
  }

  // debug
  frames++; fpsT += dt;
  if (fpsT >= 0.5) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    if (S.debug) {
      debugEl.textContent = `${fps} fps · ${renderer.info.render.calls} calls · ${renderer.info.render.triangles.toLocaleString()} tris · ${pigs.length} heo`;
    }
  }
  // giới thiệu lúc mới vào
  if (introStep === 0 && t > 1.2) { introStep = 1; showToast('Chào mừng đến Trại Heo! Đi bằng ' + (isTouch ? 'cần điều khiển' : 'WASD') + ', kêu bằng ' + (isTouch ? 'nút Ụt ịt' : 'phím E') + ' 🐷', 4200); }
  else if (introStep === 1 && t > 6.5) { introStep = 2; showToast('Bấm E để ụt ịt — cả đàn heo sẽ chạy tới tìm bạn!', 4200); }
  else if (introStep === 2 && t > 12) { introStep = 3; showToast('Thử nhảy xuống vũng bùn nhé. Đói thì ra máng ăn bấm F. Chúc vui!', 4500); }

  renderer.render(scene, camera);
}
loop();

/* ---------------- khác ---------------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
setTimeout(() => loadingEl.classList.add('hide'), 500);
addEventListener('error', (e) => {
  showToast('Lỗi: ' + (e.message || 'không rõ') + ' — thử tải lại trang nhé', 6000);
});
