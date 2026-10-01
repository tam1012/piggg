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
const TIME_PRESET = { morning: 0.30, noon: 0.50, golden: 0.67, sunset: 0.735, night: 0.97 };
const DAY_LEN = 240; // giây cho 1 ngày đêm (chế độ cycle)
const timeState = { t: 0.34 };

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const loadingEl = $('loading'), toastEl = $('toast'), debugEl = $('debug');
const oinkCountEl = $('oinkCount'), pigCountEl = $('pigCount');

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: !SMALL, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
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
    c.setHSL(0.29 + (n - 0.5) * 0.035, 0.62, 0.38 + (n - 0.5) * 0.08, THREE.SRGBColorSpace);
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
    col.setHSL(rand(0.25, 0.32), rand(0.55, 0.72), rand(0.38, 0.52), THREE.SRGBColorSpace);
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
const NPC_NAMES = ['Lâm', 'Phan Anh', 'Đức', 'Thành', 'Trung', 'Đạt', 'Công', 'Dương', 'Huy'];
const BABY_NAMES = ['Ụt', 'Bông', 'Mực', 'Béo', 'Tí Nị', 'Sủi', 'Tofu', 'Xà Cừ', 'Muối', 'Chả', 'Nem', 'Bụi', 'Cục Mìn', 'Tẹt', 'Nhồi', 'Sủi Béo'];

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function makeNameTag(name) {
  const cv = document.createElement('canvas');
  let ctx = cv.getContext('2d');
  ctx.font = '800 40px system-ui, sans-serif';
  const tw = Math.ceil(ctx.measureText(name).width);
  cv.width = Math.max(160, tw + 64);
  cv.height = 84;
  ctx = cv.getContext('2d');

  // Đổ bóng mềm
  ctx.shadowColor = 'rgba(255, 94, 136, 0.28)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  // Nền kính mờ phớt hồng (Frosted Jelly Tag)
  roundRectPath(ctx, 4, 4, cv.width - 8, cv.height - 8, 32);
  const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(255, 235, 242, 0.88)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Viền trắng phản quang & phớt hồng
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(255, 150, 180, 0.65)';
  ctx.stroke();

  // Highlight bóng kính trên đỉnh
  roundRectPath(ctx, 8, 8, cv.width - 16, 26, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  // Chữ tên heo dễ thương
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#421a2b';
  ctx.fillText(name, cv.width / 2, cv.height / 2 + 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(cv.width / 140, cv.height / 140, 1);
  return sp;
}
function makeHat(type) {
  if (!type || type === 'none') return null;
  const g = new THREE.Group();

  if (type === 'nonla') {
    // Nón lá Việt Nam
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.26, 20), mat(0xdec37c));
    cone.position.set(0, 0.52, -0.02);
    cone.rotation.x = -0.15;
    cone.castShadow = true;
    g.add(cone);
    // Vành nón lá
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.015, 6, 20), mat(0xc9aa5f));
    rim.position.set(0, 0.39, 0.02);
    rim.rotation.x = Math.PI / 2 - 0.15;
    g.add(rim);
    // Quai nón hồng
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 6, 16, Math.PI), mat(0xff5e88));
    strap.position.set(0, 0.35, 0.04);
    strap.rotation.x = Math.PI / 2;
    g.add(strap);
  } else if (type === 'crown') {
    // Vương miện vàng
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.14, 14, 1, true), new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 90 }));
    base.position.set(0, 0.48, 0);
    g.add(base);
    // 5 đỉnh chóp vương miện
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 4), new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 90 }));
      spike.position.set(Math.cos(a) * 0.22, 0.58, Math.sin(a) * 0.22);
      g.add(spike);
      // Hạt ngọc đỏ trên đỉnh
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), new THREE.MeshPhongMaterial({ color: 0xff1e56, shininess: 100 }));
      gem.position.set(Math.cos(a) * 0.22, 0.65, Math.sin(a) * 0.22);
      g.add(gem);
    }
  } else if (type === 'glasses') {
    // Kính râm ngầu
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x111115, shininess: 110 });
    const frameMat = mat(0xffc107);
    for (const sx of [-0.21, 0.21]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.04), glassMat);
      lens.position.set(sx, 0.15, 0.48);
      g.add(lens);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.02), frameMat);
      frame.position.set(sx, 0.15, 0.47);
      g.add(frame);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.02), frameMat);
    bridge.position.set(0, 0.16, 0.48);
    g.add(bridge);
  } else if (type === 'ribbon') {
    // Nơ hồng công chúa
    const bowMat = mat(0xff4071);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), mat(0xff7399));
    knot.position.set(0, 0.5, 0.12);
    g.add(knot);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 4), bowMat);
      wing.position.set(sx * 0.13, 0.5, 0.12);
      wing.rotation.z = sx * (Math.PI / 2);
      g.add(wing);
    }
  } else if (type === 'flower') {
    // Bông hoa cài tai
    const petalMat = mat(0xfff066);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), petalMat);
      petal.position.set(0.32 + Math.cos(a) * 0.07, 0.38 + Math.sin(a) * 0.07, 0.22);
      petal.scale.set(1, 1, 0.5);
      g.add(petal);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mat(0xff5533));
    core.position.set(0.32, 0.38, 0.24);
    g.add(core);
  }

  g.userData.type = type;
  return g;
}

function setPigHat(pig, type) {
  if (pig.hat) {
    pig.head.remove(pig.hat);
    pig.hat.traverse(o => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
    pig.hat = null;
  }
  pig.hatType = type || 'none';
  const hat = makeHat(type);
  if (hat) {
    pig.hat = hat;
    pig.head.add(hat);
  }
}

function setPigName(pig, name) {
  pig.name = name;
  if (pig.tag) {
    pig.group.remove(pig.tag);
    pig.tag.material.map.dispose();
    pig.tag.material.dispose();
  }
  pig.tag = makeNameTag(name);
  pig.tag.position.y = 2.08;
  pig.group.add(pig.tag);
}

function textSprite(text, color = '#ffffff', outline = 'rgba(255, 94, 136, 0.75)') {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d');
  ctx.font = '900 48px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = outline;
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

  // đốm (35% heo có đốm)
  const extraPaint = [];
  if (Math.random() < 0.35) {
    for (let i = 0; i < randInt(2, 4); i++) {
      const sm = mat(darker);
      extraPaint.push(sm);
      const spot = new THREE.Mesh(new THREE.SphereGeometry(rand(0.1, 0.17), 8, 6), sm);
      const a = rand(0, Math.PI * 2);
      spot.position.set(Math.cos(a) * 0.72, rand(0.7, 1.3), rand(-0.7, 0.7));
      spot.scale.set(1, 0.55, 1);
      g.add(spot);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 1.3, 1.05);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), mat(body));
  skull.scale.set(0.96, 0.88, 0.96);
  skull.castShadow = true;
  head.add(skull);

  // Mũi heo tròn xoe
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 14), mat(dark));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.05, 0.5);
  head.add(snout);
  for (const sx of [-0.065, 0.065]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), mat(0x99485e));
    nostril.position.set(sx, -0.05, 0.6);
    nostril.scale.set(0.9, 1.3, 0.8);
    head.add(nostril);
  }

  // Mắt heo long lanh (Anime / Chibi style highlight)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1f161a });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-0.21, 0.21]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), eyeMat);
    eye.position.set(sx, 0.15, 0.43);
    head.add(eye);

    // Điểm sáng lớn
    const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), glintMat);
    glint1.position.set(sx + (sx > 0 ? 0.018 : -0.01), 0.175, 0.485);
    head.add(glint1);

    // Điểm sáng nhỏ phụ
    const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), glintMat);
    glint2.position.set(sx + (sx > 0 ? -0.012 : 0.018), 0.13, 0.485);
    head.add(glint2);
  }

  // Má hồng đào (Cute Blush)
  const blushMat = mat(0xff7d95, { transparent: true, opacity: 0.75 });
  for (const sx of [-0.32, 0.32]) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), blushMat);
    blush.position.set(sx, 0.02, 0.38);
    blush.scale.set(1.2, 0.65, 0.4);
    head.add(blush);
  }

  // Tai vểnh đáng yêu với lòng tai hồng nhạt
  for (const sx of [-0.26, 0.26]) {
    const em = mat(dark);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 5), em);
    extraPaint.push(em);
    ear.position.set(sx, 0.38, 0.02);
    ear.rotation.set(-0.35, 0, sx > 0 ? -0.45 : 0.45);
    ear.castShadow = true;
    head.add(ear);

    // Lòng tai hồng phấn
    const earInner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), mat(0xffbed0));
    earInner.position.set(sx, 0.37, 0.05);
    earInner.rotation.set(-0.35, 0, sx > 0 ? -0.45 : 0.45);
    head.add(earInner);
  }
  g.add(head);

  const legs = [];
  for (const [lx, lz] of [[-0.4, 0.58], [0.4, 0.58], [-0.4, -0.6], [0.4, -0.6]]) {
    const lm = mat(dark);
    extraPaint.push(lm);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.52, 8), lm);
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
    paintable: [bodyMesh.material, skull.material, tail.material, ...extraPaint],
    paintDark: [snout.material],
    scale, bodyColor: '#' + new THREE.Color(body).getHexString(),
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
  let savedName = 'Heo Ú';
  try { savedName = localStorage.getItem('pigName') || 'Heo Ú'; } catch (e) { /* bỏ qua */ }
  setPigName(player, savedName);
  let savedHat = 'nonla';
  try { savedHat = localStorage.getItem('pigHat') || 'nonla'; } catch (e) { /* bỏ qua */ }
  setPigHat(player, savedHat);
}
function spawnNpc(i) {
  const pig = makePig({ scale: rand(0.85, 1.05) });
  const a = (i / 7) * Math.PI * 2;
  setPigPos(pig, clamp(Math.cos(a) * 16, YARD.x0 + 2, YARD.x1 - 2), clamp(Math.sin(a) * 12, YARD.z0 + 2, YARD.z1 - 2));
  pig.state = 'wander'; pig.stateT = rand(0, 3);
  scene.add(pig.group);
  pigs.push(pig);
  setPigName(pig, NPC_NAMES[i % NPC_NAMES.length]);
  // Tặng ngẫu nhiên nón cho 1 vài bé heo NPC cho sinh động
  if (Math.random() < 0.45) {
    const npcHat = pick(['nonla', 'crown', 'glasses', 'ribbon', 'flower']);
    setPigHat(pig, npcHat);
  }
}
spawnPlayer();
for (let i = 0; i < NPC_NAMES.length; i++) spawnNpc(i);
window.__pig = () => player; // hook debug
window.__dbg = () => ({ collect, seek, ball, pigs, race, get digScore() { return digScore; } }); // hook debug (truy cập muộn)

/* ---------------- va chạm ---------------- */
function resolveCollisions(pos, prev) {
  // chuồng (AABB) — luôn đẩy heo ra mặt gần nhất, không bao giờ kẹt bên trong
  const bx = pos.x - BARN.x, bz = pos.z - BARN.z;
  if (Math.abs(bx) < BARN.hx + 0.35 && Math.abs(bz) < BARN.hz + 0.35) {
    const penX = BARN.hx + 0.35 - Math.abs(bx);
    const penZ = BARN.hz + 0.35 - Math.abs(bz);
    if (penX <= penZ) pos.x = BARN.x + (bx >= 0 ? 1 : -1) * (BARN.hx + 0.35);
    else pos.z = BARN.z + (bz >= 0 ? 1 : -1) * (BARN.hz + 0.35);
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
  fart() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(72, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.45);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 190;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.6, t + 0.05);
    gn.gain.setValueAtTime(0.6, t + 0.28);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(flt).connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.52);
  },
  collect() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1420, t + 0.12);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.2);
  },
  fanfare() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure();
    [523, 659, 784, 1047].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gn).connect(this.master);
      osc.start(t); osc.stop(t + 0.24);
    });
  },
  party() {
    if (!S.sound || !this.ctx) return;
    this.fanfare();
    const ctx = this.ensure();
    for (let i = 0; i < 5; i++) {
      const t = ctx.currentTime + 0.15 + i * 0.12;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(0.05);
      const flt = ctx.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = rand(1500, 3500);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.25, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(flt).connect(gn).connect(this.master);
      src.start(t);
    }
  },
  kick() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.5, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.15);
  },
  whistle() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2100, t);
    osc.frequency.setValueAtTime(2600, t + 0.12);
    osc.frequency.setValueAtTime(2100, t + 0.26);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(gn).connect(this.master);
    osc.start(t); osc.stop(t + 0.44);
  },
  shutter() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure();
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.07;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf(0.03);
      const flt = ctx.createBiquadFilter();
      flt.type = 'highpass'; flt.frequency.value = 2000;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.35, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      src.connect(flt).connect(gn).connect(this.master);
      src.start(t);
    }
  },
  bubble() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure();
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const f = rand(400, 750);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.08);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.001, t);
      gn.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gn).connect(this.master);
      osc.start(t); osc.stop(t + 0.1);
    }
  },
  dig() {
    if (!S.sound || !this.ctx) return;
    const ctx = this.ensure(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf(0.18);
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 450;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.4, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(flt).connect(gn).connect(this.master);
    src.start(t);
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
  // Nhạc nền BGM Kalimba đồng quê êm dịu, sinh bằng WebAudio
  bgm: {
    timer: null,
    step: 0,
    // Pentatonic F major / D minor trong trẻo (F4, G4, A4, C5, D5, E5, F5)
    notes: [349.23, 392.00, 440.00, 523.25, 587.33, 659.25, 698.46],
    pattern: [
      0, 2, 3, 2,  4, 3, 2, 0,
      1, 3, 4, 3,  5, 4, 3, 1,
      0, 2, 4, 5,  4, 3, 2, 1,
      0, -1, 2, -1, 3, 2, 0, -1
    ],
    playNote(freq) {
      if (freq <= 0 || !sfx.ctx) return;
      const ctx = sfx.ctx, t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      // Hài âm thứ 2 tạo độ nẩy đặc trưng của phím đàn Kalimba
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.76, t);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(0.09, t + 0.015);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const gn2 = ctx.createGain();
      gn2.gain.setValueAtTime(0.0001, t);
      gn2.gain.linearRampToValueAtTime(0.03, t + 0.008);
      gn2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gn).connect(sfx.master);
      osc2.connect(gn2).connect(sfx.master);
      osc.start(t); osc.stop(t + 0.95);
      osc2.start(t); osc2.stop(t + 0.3);
    },
    tick() {
      if (!S.sound) return;
      const idx = this.pattern[this.step % this.pattern.length];
      if (idx >= 0 && idx < this.notes.length) {
        this.playNote(this.notes[idx]);
      }
      this.step++;
    },
    start() {
      if (this.timer) return;
      this.step = 0;
      this.timer = setInterval(() => this.tick(), 240);
    },
    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
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

/* ---------------- bong bóng xà phòng ao nước ---------------- */
const BUBBLE_N = 36;
const bubbleMat = new THREE.MeshPhongMaterial({
  color: 0xffffff, transparent: true, opacity: 0.65,
  shininess: 120, specular: 0xffb8d2, depthWrite: false
});
const bubbles = [];
{
  const bGeo = new THREE.SphereGeometry(0.18, 12, 10);
  for (let i = 0; i < BUBBLE_N; i++) {
    const m = new THREE.Mesh(bGeo, bubbleMat.clone());
    m.visible = false;
    scene.add(m);
    bubbles.push({ m, life: 0, maxLife: 1, v: new THREE.Vector3(), baseScale: 1 });
  }
}
function spawnBubbles(x, y, z, n = 16) {
  let used = 0;
  for (const b of bubbles) {
    if (b.life > 0) continue;
    b.m.position.set(x + rand(-0.6, 0.6), y + rand(0, 0.3), z + rand(-0.6, 0.6));
    b.v.set(rand(-0.6, 0.6), rand(1.2, 2.8), rand(-0.6, 0.6));
    b.maxLife = b.life = rand(1.2, 2.4);
    b.baseScale = rand(0.6, 1.4);
    b.m.scale.setScalar(b.baseScale);
    b.m.visible = true;
    if (++used >= n) break;
  }
}
function updateBubbles(dt, t) {
  for (const b of bubbles) {
    if (b.life <= 0) continue;
    b.life -= dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.position.x += Math.sin(t * 3 + b.m.position.y) * 0.4 * dt;
    b.v.y = Math.max(0.5, b.v.y - 0.2 * dt);
    const progress = 1 - b.life / b.maxLife;
    b.m.material.opacity = (1 - progress * 0.7) * 0.75;
    b.m.scale.setScalar(b.baseScale * (1 + progress * 0.5));
    if (b.life <= 0) b.m.visible = false;
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
const C_NIGHT_TOP = new THREE.Color(0x0d1a38), C_NIGHT_HOR = new THREE.Color(0x24365a);
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
  moon.intensity = smoothstep(0.08, -0.22, e) * 0.8 * (S.weather === 'clear' ? 1 : 0.35);
  moon.position.copy(player.pos).addScaledVector(sunDir, -80);
  hemi.intensity = 0.34 + dayI * 0.31;

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
  if (pig.frozen) {
    // heo đang đua: tốc độ do updateRace điều khiển, không được triệt tiêu
    if (!pig.racing) pig.speed = damp(pig.speed, 0, 10, dt);
    return;
  }
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
  } else if (pig.state === 'dance') {
    tx = null;
    pig.yaw += dt * 3.4;
    if (Math.random() < dt * 2.5) pig.group.position.y = 0.3;
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
    g.position.y += Math.abs(Math.sin(pig.walkPhase)) * 0.08 * amp * 2;
    // Độ nhún squish & stretch đàn hồi cho cơ thể mũm mĩm
    pig.bodyMesh.scale.y = 0.95 + Math.sin(pig.walkPhase * 2) * 0.04;
    pig.bodyMesh.scale.x = 1.22 - Math.sin(pig.walkPhase * 2) * 0.03;
    pig.head.rotation.z = Math.sin(pig.walkPhase) * 0.06; // lắc lư đầu nhẹ theo nhịp
  } else {
    for (const l of pig.legs) l.rotation.x = damp(l.rotation.x, 0, 10, dt);
    pig.bodyMesh.scale.x = damp(pig.bodyMesh.scale.x, 1.22, 6, dt);
    pig.head.rotation.z = damp(pig.head.rotation.z, 0, 6, dt);
  }
  // đuôi + thở
  pig.tail.rotation.z = Math.sin(t * (pig.isBaby ? 6 : 3.8) + pig.seed) * 0.45;
  if (!moving) {
    pig.bodyMesh.scale.y = 0.95 + Math.sin(t * 2.5 + pig.seed) * 0.02;
  }
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
  // heo vàng lấp lánh
  if (pig.isGold && Math.random() < dt * 2.5) sparkle(pig.pos.x, 1.2 * pig.scale, pig.pos.z, 0xffe680, 1);
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
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // screen-right thật của camera
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
      else if (inPond) {
        spawnSplash(player.pos.x, 0.2, player.pos.z, 16, 0x7db4dd); sfx.splash();
        if (player.mudLevel > 0.05) {
          player.mudLevel = 0;
          spawnBubbles(player.pos.x, 0.4, player.pos.z, 24);
          sfx.bubble();
          sparkle(player.pos.x, 1.2, player.pos.z, 0xffffff, 14);
          showToast('Tắm ao sạch bong kin kít! 🫧✨');
        }
      }
      else sfx.oink(0.7, 0.15);
    }
    player.pos.y = gy; player.vy = 0; player.grounded = true;
  } else player.grounded = false;

  // Lội ao khi đang có bùn cũng tự sủi bọt rửa sạch
  if (inPond && player.mudLevel > 0.05 && Math.random() < dt * 4) {
    player.mudLevel = Math.max(0, player.mudLevel - dt * 1.5);
    spawnBubbles(player.pos.x, 0.25, player.pos.z, 4);
    sfx.bubble();
    if (player.mudLevel === 0) showToast('Đã gột sạch bùn rồi! 🫧');
  }
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
  setPigName(baby, pick(BABY_NAMES));
  sfx.pop();
  playOink(baby, 0.9);
  showToast('Heo con "' + baby.name + '" vừa chào đời! 🐷 (' + (babies + 1) + ' heo con)');
  pigCountEl.textContent = pigs.length;
}

/* ---------------- ủi đất tìm kho báu ---------------- */
let digCd = 0;
const DIG_ITEMS = [
  { name: 'Cà rốt giòn ngọt', icon: '🥕', type: 'carrot', prob: 0.65 },
  { name: 'Đồng xu vàng lấp lánh', icon: '🪙', type: 'coin', prob: 0.18 },
  { name: 'Nấm ma thuật phát sáng', icon: '🍄', type: 'shroom', prob: 0.12 },
  { name: 'Chú giun đất nghịch ngợm', icon: '🐛', type: 'worm', prob: 0.05 },
];
let digScore = 0;

function doDig() {
  if (digCd > 0) return;
  digCd = 1.2;
  sfx.dig();

  // Vị trí trước mũi heo
  const fx = player.pos.x + Math.sin(player.yaw) * 0.9;
  const fz = player.pos.z + Math.cos(player.yaw) * 0.9;

  // Hạt đất và cỏ văng tung tóe
  spawnSplash(fx, 0.15, fz, 16, 0x6e4d2a);
  spawnSplash(fx, 0.25, fz, 8, 0x4a8c38);

  // Đầu heo gật xuống ủi đất
  player.head.rotation.x = 0.55;
  setTimeout(() => { if (player) player.head.rotation.x = 0; }, 350);

  // Chọn vật phẩm
  const r = Math.random();
  let cum = 0, item = DIG_ITEMS[0];
  for (const it of DIG_ITEMS) {
    cum += it.prob;
    if (r <= cum) { item = it; break; }
  }

  // Tạo sprite vật phẩm bay lên khỏi mặt đất
  const sp = textSprite(item.icon, '#ffffff');
  sp.scale.set(0.7, 0.7, 1);
  sp.position.set(fx, 0.4, fz);
  scene.add(sp);
  floaters.push({ sp, life: 1.4, vy: 1.2 });

  if (item.type === 'carrot') {
    sfx.crunch();
    spawnHearts(player.pos.x, 1.6, player.pos.z, 2);
    digScore += 1;
    showToast(`Ủi trúng ${item.icon} ${item.name}! Ngon tuyệt vời!`);
  } else if (item.type === 'coin') {
    sfx.pop();
    sparkle(fx, 0.8, fz, 0xffd700, 14);
    digScore += 5;
    showToast(`Đào được ${item.icon} ${item.name}! (+5 xu)`);
  } else if (item.type === 'shroom') {
    sfx.bubble();
    sparkle(fx, 0.8, fz, 0xff40bb, 14);
    player.vy = 6.5; // nhún nảy tưng tưng
    showToast(`Ăn trúng ${item.icon} ${item.name}! Nhảy tưng tưng! 🍄✨`);
  } else {
    sfx.squeal();
    showToast(`Đào trúng ${item.icon} ${item.name}! Nó bò mất tiêu rồi!`);
  }
}

/* ---------------- troll: xịt hơi ---------------- */
function doFart() {
  const bx = player.pos.x - Math.sin(player.yaw) * 0.9;
  const bz = player.pos.z - Math.cos(player.yaw) * 0.9;
  spawnSplash(bx, 0.45, bz, 12, 0xa8d65a);
  sfx.fart();
  let escaped = 0;
  for (const p of pigs) {
    if (p.isPlayer) continue;
    if (p.pos.distanceTo(player.pos) < 6) {
      p.state = 'flee'; p.stateT = rand(1.5, 2.5); p.fleeFrom = player.pos.clone();
      escaped++;
    }
  }
  showToast(pick(['Ực… xin lỗi cả nhà 🤢', 'Một phát, cả đàn tán loạn! 💨', escaped + ' con heo bỏ chạy vì mùi 😂']));
}

/* ---------------- đổi tên + màu heo của bạn ---------------- */
function renamePlayer() {
  openColorModal();
}

/* ---------------- input: bàn phím ---------------- */
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
  if (e.code === 'KeyE') playOink(player);
  if (e.code === 'KeyB') spawnBaby();
  if (e.code === 'KeyF') tryEat();
  if (e.code === 'KeyG') doFart();
  if (e.code === 'KeyV') doDig();
  if (e.code === 'KeyR') startRace();
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 7) playNote(n - 1);
  }
  if (e.code === 'KeyP') startParty();
  if (e.code === 'KeyH') togglePhoto();
  if (e.code === 'KeyT') startSeek();
  if (photoMode && e.code === 'Enter') capturePhoto();
  if (e.code === 'Escape' && photoMode) togglePhoto(false);
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
  // đang đếm ngược đua heo thì đứng yên tại vạch xuất phát
  if (race.active && race.state === 'countdown') { x = 0; z = 0; }
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
bindBtn('tDig', () => doDig());
bindBtn('tRace', () => { $('moreActions')?.classList.remove('open'); startRace(); });
bindBtn('tOink', () => playOink(player));
bindBtn('tEat', () => { $('moreActions')?.classList.remove('open'); tryEat(); });
bindBtn('tFart', () => { $('moreActions')?.classList.remove('open'); doFart(); });
bindBtn('tParty', () => { $('moreActions')?.classList.remove('open'); startParty(); });
bindBtn('tPhoto', () => { $('moreActions')?.classList.remove('open'); capturePhoto(); });
bindBtn('tSeek', () => { $('moreActions')?.classList.remove('open'); startSeek(); });
bindBtn('tPiano', () => { $('moreActions')?.classList.remove('open'); document.body.classList.toggle('piano'); });
bindBtn('tRun', () => { touchRun = !touchRun; $('tRun')?.classList.toggle('on', touchRun); });
const moreActionsEl = $('moreActions');
if ($('tMoreBtn')) {
  $('tMoreBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    moreActionsEl?.classList.toggle('open');
  });
}

/* ---------------- chạm vào heo → nó bỏ chạy ---------------- */
const raycaster = new THREE.Raycaster();
function tapPick(cx, cy) {
  raycaster.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), camera);
  const hits = raycaster.intersectObjects(pigs.map(p => p.group), true);
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.pig) o = o.parent;
    if (o && o.userData.pig) {
      const pig = o.userData.pig;
      if (pig.isPlayer) { renamePlayer(); return; }
      pig.state = 'flee'; pig.stateT = rand(2, 3); pig.fleeFrom = player.pos.clone();
      sfx.squeal();
      const sp = textSprite(pick(['hự!', 'á á!', 'ơ kìa!', 'chạy đi!']));
      sp.position.copy(pig.group.position).add(new THREE.Vector3(0, 2.5 * pig.scale, 0));
      scene.add(sp);
      floaters.push({ sp, life: 1, vy: 1 });
      showToast(pig.name + ' hoảng hồn bỏ chạy 😂');
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
  if (S.sound) {
    sfx.ensure();
    sfx.pop();
    sfx.bgm.start();
  } else {
    sfx.bgm.stop();
  }
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

/* =========================================================
   MỞ RỘNG VUI VUI: táo vàng, trứng vàng, đàn piano, tiệc,
   chụp ảnh, đổi màu, trốn tìm, đá táo
   ========================================================= */
const questEl = $('quest'), flashEl = $('flash');
const colorModal = $('colorModal'), nameInput = $('nameInput'), swatchesEl = $('swatches');
let questT = 0;

// ---------- pháo giấy ----------
const CONF_N = 150;
const confetti = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.15, 0.2),
  new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  CONF_N
);
confetti.frustumCulled = false;
scene.add(confetti);
const confItems = [];
for (let i = 0; i < CONF_N; i++) confItems.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), ry: rand(0, 3), rx: rand(0, 3), active: false });
const confM4 = new THREE.Matrix4(), confQ = new THREE.Quaternion(), confE = new THREE.Euler();
const confColor = new THREE.Color();
const CONF_COLS = [0xf2889f, 0xffd76b, 0x7db4dd, 0x9fd65a, 0xc39bf2, 0xff8c5a, 0xffffff];
function burstConfetti(x, y, z) {
  let k = 0;
  for (const it of confItems) {
    it.p.set(x + rand(-1.2, 1.2), y + rand(0, 2.5), z + rand(-1.2, 1.2));
    it.v.set(rand(-3.5, 3.5), rand(0.5, 4), rand(-3.5, 3.5));
    it.ry = rand(0, 3); it.rx = rand(0, 3);
    it.active = true;
    confColor.setHex(CONF_COLS[k % CONF_COLS.length]);
    confetti.setColorAt(k, confColor);
    k++;
  }
  if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
}
function updateConfetti(dt, t) {
  for (let i = 0; i < CONF_N; i++) {
    const it = confItems[i];
    if (it.active) {
      it.v.y = Math.max(it.v.y - 3 * dt, -2);
      it.p.addScaledVector(it.v, dt);
      it.p.x += Math.sin(t * 2.5 + it.ry) * dt * 1.2;
      if (it.p.y < 0.06) it.active = false;
      confE.set(it.rx + t * 2, it.ry + t * 3, 0);
      confQ.setFromEuler(confE);
      confM4.compose(it.p, confQ, new THREE.Vector3(1, 1, 1));
    } else confM4.makeScale(0, 0, 0);
    confetti.setMatrixAt(i, confM4);
  }
  confetti.instanceMatrix.needsUpdate = true;
}

// ---------- táo vàng + trứng vàng ----------
const collect = { apples: [], appleGot: 0, eggs: [], eggGot: 0, goldUnlocked: false };
const sparkle = (x, y, z, color = 0xffd34d, n = 10) => spawnSplash(x, y, z, n, color);

function makeFruitMesh(kind) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(kind === 'egg' ? 0.24 : 0.23, 14, 12),
    kind === 'egg'
      ? new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0x664400, shininess: 90 })
      : new THREE.MeshPhongMaterial({ color: 0xffc12e, emissive: 0x442b00, shininess: 70 })
  );
  if (kind === 'egg') body.scale.set(1, 1.35, 1);
  g.add(body);
  if (kind === 'apple') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), mat(0x6b4526));
    stem.position.y = 0.26;
    g.add(stem);
  }
  return g;
}
function randomSpot(minR = 6, maxR = 58) {
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2), r = rand(minR, maxR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inBarn(x, z, 1.7) || inCircle(x, z, POND, 1.15) || inEllipse(x, z, MUD, 1.2)) continue;
    let ok = true;
    for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.8) ok = false;
    if (ok) return new THREE.Vector2(x, z);
  }
  return new THREE.Vector2(20, -5);
}
function spawnApples() {
  for (const a of collect.apples) scene.remove(a.mesh);
  collect.apples = [];
  collect.appleGot = 0;
  for (let i = 0; i < 6; i++) {
    const pt = randomSpot();
    const mesh = makeFruitMesh('apple');
    mesh.position.set(pt.x, 0.55, pt.y);
    scene.add(mesh);
    collect.apples.push({ mesh, got: false, ph: rand(0, 9) });
  }
  updateQuest();
}
const EGG_SPOTS = [
  new THREE.Vector2(0.8, -25.8), new THREE.Vector2(24.8, 12), new THREE.Vector2(26.9, -21.9),
  new THREE.Vector2(-26.9, -21.7), new THREE.Vector2(14.2, -23.2), new THREE.Vector2(-32, 24),
  new THREE.Vector2(33, 16),
];
function spawnEggs() {
  const spots = EGG_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  for (const pt of spots) {
    const mesh = makeFruitMesh('egg');
    mesh.position.set(pt.x, 0.42, pt.y);
    scene.add(mesh);
    collect.eggs.push({ mesh, got: false, ph: rand(0, 9) });
  }
}
function spawnGoldenPig() {
  const gp = makePig({ scale: 0.95, body: 0xffc93c });
  setPigPos(gp, clamp(player.pos.x + 2, YARD.x0 + 2, YARD.x1 - 2), clamp(player.pos.z, YARD.z0 + 2, YARD.z1 - 2));
  gp.state = 'follow'; gp.stateT = 99999;
  gp.isGold = true;
  scene.add(gp.group);
  pigs.push(gp);
  setPigName(gp, 'Heo Vàng');
  pigCountEl.textContent = pigs.length;
}
function updateCollectibles(dt, t) {
  let dirty = false;
  for (const a of collect.apples) {
    if (a.got) continue;
    a.mesh.position.y = 0.55 + Math.sin(t * 2 + a.ph) * 0.08;
    a.mesh.rotation.y += dt * 1.5;
    if (a.mesh.position.distanceTo(player.pos) < 1.35) {
      a.got = true; a.mesh.visible = false;
      collect.appleGot++;
      sparkle(a.mesh.position.x, 0.7, a.mesh.position.z);
      sfx.collect();
      dirty = true;
      if (collect.appleGot >= 6) {
        burstConfetti(player.pos.x, 2, player.pos.z);
        sfx.party();
        showToast('Săn đủ 6 táo vàng! Vòng mới sau 3 giây 🍎');
        setTimeout(spawnApples, 3000);
      }
    }
  }
  for (const e of collect.eggs) {
    if (e.got) continue;
    e.mesh.position.y = 0.42 + Math.sin(t * 2 + e.ph) * 0.07;
    e.mesh.rotation.y += dt;
    if (e.mesh.position.distanceTo(player.pos) < 1.4) {
      e.got = true; e.mesh.visible = false;
      collect.eggGot++;
      sparkle(e.mesh.position.x, 0.6, e.mesh.position.z, 0xffe680, 14);
      sfx.fanfare();
      dirty = true;
      if (collect.eggGot >= 3) {
        collect.goldUnlocked = true;
        spawnGoldenPig();
        burstConfetti(player.pos.x, 2.5, player.pos.z);
        showToast('Đủ 3 trứng vàng! Heo Vàng xuất hiện 🐷✨ và mở màu vàng cho heo của bạn');
      } else showToast('Trộm vía! Trứng vàng ' + collect.eggGot + '/3 🥚');
    }
  }
  if (dirty) updateQuest();
}

// ---------- đàn heo piano ----------
const NOTES = [1, 1.122, 1.26, 1.335, 1.498, 1.682, 1.888];
function playNote(i) {
  if (i < 0 || i > 6) return;
  sfx.oink(NOTES[i] * 1.05, 0.9);
  const sp = textSprite(pick(['♪', '♫']), '#f8c1d0', 'rgba(30,20,25,.5)');
  sp.position.copy(player.group.position).add(new THREE.Vector3(rand(-0.3, 0.3), 2.3, 0));
  scene.add(sp);
  floaters.push({ sp, life: 1, vy: 0.8 });
  player.oinkT = 0.25;
}

// ---------- tiệc pháo giấy ----------
function startParty() {
  burstConfetti(player.pos.x, 3, player.pos.z);
  sfx.party();
  for (const p of pigs) { p.state = 'dance'; p.stateT = rand(7, 9); }
  showToast('TIỆC ỤT ỊT! 🎉 Cả đàn nhảy múa!');
}

// ---------- chụp ảnh ----------
let photoMode = false;
function togglePhoto(force) {
  photoMode = force !== undefined ? force : !photoMode;
  document.body.classList.toggle('photo', photoMode);
  if (photoMode) showToast('Enter: chụp · H: thoát', 2600);
}
function capturePhoto() {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const W = 1280, H = Math.round((1280 * src.height) / src.width) + 90;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff7f9';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(src, 25, 25, W - 50, H - 115);
  ctx.strokeStyle = '#f2889f'; ctx.lineWidth = 6;
  ctx.strokeRect(25, 25, W - 50, H - 115);
  ctx.fillStyle = '#e0557f';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐷 TRẠI HEO', W / 2, H - 42);
  ctx.fillStyle = '#b3bcc9';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('heomi.tam1012.site', W / 2, H - 16);
  const a = document.createElement('a');
  a.download = 'trai-heo-' + Date.now() + '.png';
  a.href = cv.toDataURL('image/png');
  a.click();
  sfx.shutter();
  flashEl.classList.add('go');
  setTimeout(() => flashEl.classList.remove('go'), 350);
  togglePhoto(false);
}

// ---------- trốn tìm ----------
const seek = { active: false, t: 0, found: 0, list: [] };
const SEEK_SPOTS = [
  new THREE.Vector2(0.6, 21.8), new THREE.Vector2(-7, -23), new THREE.Vector2(13.4, -22.6),
  new THREE.Vector2(26.6, -21.4), new THREE.Vector2(-26.6, -21.4), new THREE.Vector2(-32.5, 12),
  new THREE.Vector2(32.5, 8),
];
function startSeek() {
  if (seek.active) { showToast('Đang chơi trốn tìm rồi, tìm đi đã! 🔍'); return; }
  if (pigs.length >= 24) { showToast('Trại đông quá, không còn chỗ trốn 😅'); return; }
  const spots = SEEK_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  seek.active = true; seek.t = 35; seek.found = 0; seek.list = [];
  for (const pt of spots) {
    const b = makePig({ scale: 0.48 });
    setPigPos(b, pt.x, pt.y);
    b.frozen = true;
    b.state = 'idle'; b.stateT = 999;
    scene.add(b.group);
    pigs.push(b);
    setPigName(b, pick(BABY_NAMES));
    seek.list.push(b);
  }
  sfx.chirp();
  showToast('3 heo con trốn quanh trại! Tìm trong 35 giây 🔍');
  updateQuest();
}
function endSeek(win) {
  seek.active = false;
  for (const b of seek.list) {
    if (b.frozen) {
      b.frozen = false;
      b.state = 'follow'; b.stateT = rand(6, 10);
    }
  }
  if (win) {
    burstConfetti(player.pos.x, 2.5, player.pos.z);
    sfx.party();
    showToast('Giỏi quá! Tìm đủ cả 3 heo con 🎉 (chúng ở lại trại luôn)');
  } else showToast('Hết giờ! Tìm được ' + seek.found + '/3 — chơi lại bằng phím T nhé');
  updateQuest();
}
function updateSeek(dt) {
  if (!seek.active) return;
  seek.t -= dt;
  for (const b of seek.list) {
    if (b.frozen && b.pos.distanceTo(player.pos) < 1.8) {
      b.frozen = false;
      b.state = 'follow'; b.stateT = rand(6, 10);
      seek.found++;
      sfx.fanfare();
      sparkle(b.pos.x, 1, b.pos.z, 0xfff0a0, 8);
      showToast('Tìm thấy "' + b.name + '" rồi! (' + seek.found + '/3)');
    }
  }
  if (seek.found >= 3) endSeek(true);
  else if (seek.t <= 0) endSeek(false);
}

// ---------- đua heo ----------
const race = {
  active: false,
  state: 'idle', // 'countdown', 'running', 'finished'
  timer: 0,
  racers: [],
  finishZ: -13.5, // trước cửa chuồng, KHÔNG nằm trong footprint chuồng
  winner: null,
};

function startRace() {
  if (race.active) return;
  race.active = true;
  race.state = 'countdown';
  race.timer = 3.6;
  race.winner = null;

  // Lấy player + 4 heo NPC ngẫu nhiên
  const npcs = pigs.filter(p => !p.isPlayer && !p.isBaby);
  const selectedNpc = npcs.sort(() => Math.random() - 0.5).slice(0, 4);
  race.racers = [player, ...selectedNpc];

  // Xếp hàng ở vạch xuất phát
  const startZ = 15;
  const startX = [-6, -3, 0, 3, 6];
  race.racers.forEach((p, idx) => {
    setPigPos(p, startX[idx], startZ);
    p.yaw = Math.PI; // quay về phía bắc (chuồng)
    p.speed = 0;
    p.frozen = true;
    p.racing = true; // AI nhường quyền điều khiển cho updateRace
    p.raceSpeed = p.isPlayer ? 0 : rand(3.8, 5.8);
  });

  showToast('ĐUA HEO! Chuẩn bị… 🏁', 1200);
  sfx.chirp();
}

function updateRace(dt, t) {
  if (!race.active) return;

  if (race.state === 'countdown') {
    const prevInt = Math.ceil(race.timer);
    race.timer -= dt;
    const curInt = Math.ceil(race.timer);
    if (curInt !== prevInt && curInt > 0) {
      sfx.pop();
      showToast(`${curInt}… 🏁`, 900);
    }
    if (race.timer <= 0) {
      race.state = 'running';
      // giữ frozen: AI đứng yên, updateRace tự chạy các heo tới đích
      sfx.whistle();
      showToast('XUẤT PHÁT! CHẠY ĐI! 🏃💨', 1500);
    }
  } else if (race.state === 'running') {
    // Di chuyển các heo NPC về đích
    for (const p of race.racers) {
      if (p.isPlayer) continue;
      p.pos.z -= p.raceSpeed * dt;
      p.speed = p.raceSpeed;
      p.yaw = Math.PI;
    }

    // Kiểm tra con nào cán đích trước
    for (const p of race.racers) {
      if (p.pos.z <= race.finishZ) {
        race.winner = p;
        race.state = 'finished';
        burstConfetti(p.pos.x, 2, p.pos.z);
        sfx.fanfare();
        const winName = p.isPlayer ? 'BẠN' : p.name;
        showToast(`🏆 ${winName} ĐÃ VỀ NHẤT! CHÚC MỪNG! 🎉`, 4500);
        setTimeout(() => {
          race.active = false;
          race.racers.forEach(r => {
            r.state = 'wander';
            r.stateT = rand(2, 5);
            r.frozen = false;
            r.racing = false;
          });
        }, 5000);
        break;
      }
    }
  }
}

// ---------- đom đóm mùa hè ban đêm ----------
const FIREFLY_N = 36;
const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xe6ff66 });
const fireflies = [];
{
  const fGeo = new THREE.SphereGeometry(0.045, 6, 5);
  for (let i = 0; i < FIREFLY_N; i++) {
    const m = new THREE.Mesh(fGeo, fireflyMat);
    m.visible = false;
    scene.add(m);
    fireflies.push({
      m,
      cx: rand(-28, 28), cz: rand(-22, 16),
      r: rand(1.5, 4.5), speed: rand(0.5, 1.2),
      ph: rand(0, Math.PI * 2),
      baseY: rand(0.6, 2.2)
    });
  }
}
function updateFireflies(dt, t) {
  // Chỉ hiện khi chiều muộn hoặc đêm
  const isNight = S.time === 'night' || (sunDir && sunDir.y < 0.12);
  for (const f of fireflies) {
    if (!isNight) {
      f.m.visible = false;
      continue;
    }
    f.m.visible = true;
    const ang = t * f.speed + f.ph;
    f.m.position.set(
      f.cx + Math.cos(ang) * f.r,
      f.baseY + Math.sin(t * 2.5 + f.ph) * 0.45,
      f.cz + Math.sin(ang) * f.r
    );
    // Nhấp nháy nhẹ
    const blink = Math.sin(t * 4 + f.ph);
    f.m.scale.setScalar(blink > 0 ? (0.6 + blink * 0.7) : 0.001);
  }
}

// ---------- bóng thoại emoji biểu cảm ----------
let bubbleTimer = 0;
const PIG_EMOJIS = ['💤', '🍎', '🌽', '💖', '🎵', '🌸', '✨', '💨', '😋', '🥳'];
function updateEmojiBubbles(dt) {
  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    bubbleTimer = rand(3.5, 7.5);
    const p = pick(pigs);
    if (!p) return;
    const isNight = S.time === 'night' || (sunDir && sunDir.y < 0.05);
    const emoji = isNight ? '💤' : pick(PIG_EMOJIS);
    const sp = textSprite(emoji, '#ffffff', 'rgba(255,140,170,0.8)');
    sp.scale.set(0.65, 0.65, 1);
    sp.position.copy(p.group.position).add(new THREE.Vector3(0, 2.2 * p.scale, 0));
    scene.add(sp);
    floaters.push({ sp, life: 1.6, vy: 0.6 });
  }
}

// ---------- đá táo ----------
const ball = { mesh: null, pos: new THREE.Vector3(0, 0, -4), v: new THREE.Vector3(), goals: 0, kickCd: 0 };
{
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), new THREE.MeshPhongMaterial({ color: 0xd93b3b, shininess: 60 }));
  body.castShadow = true;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), mat(0x6b4526));
  stem.position.y = 0.6;
  g.add(body, stem);
  scene.add(g);
  ball.mesh = g;
  const postMat = mat(0xf2f2f2);
  for (const pz of [-2.1, 2.1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), postMat);
    post.position.set(-29.7, 0.8, pz);
    post.castShadow = true;
    scene.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 8), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(-29.7, 1.6, 0);
  scene.add(bar);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  net.rotation.y = Math.PI / 2;
  net.position.set(-29.9, 0.75, 0);
  scene.add(net);
}
function updateBall(dt) {
  ball.kickCd -= dt;
  const d = Math.hypot(player.pos.x - ball.pos.x, player.pos.z - ball.pos.z);
  const pSpeed = Math.hypot(player.velX, player.velZ);
  if (d < 1.25 && pSpeed > 0.6 && ball.kickCd <= 0) {
    const dx = ball.pos.x - player.pos.x, dz = ball.pos.z - player.pos.z;
    const dd = Math.max(d, 0.01);
    const power = Math.max(3, pSpeed * 1.6);
    ball.v.x = (dx / dd) * power * 0.7 + player.velX * 0.7;
    ball.v.z = (dz / dd) * power * 0.7 + player.velZ * 0.7;
    ball.kickCd = 0.25;
    sfx.kick();
  }
  ball.pos.x += ball.v.x * dt;
  ball.pos.z += ball.v.z * dt;
  ball.v.multiplyScalar(Math.exp(-1.5 * dt));
  // hàng rào + cổng
  if (ball.pos.x < -29.5 && Math.abs(ball.pos.z) < YARD.z1) {
    if (Math.abs(ball.pos.z) < 2.1) {
      ball.goals++;
      sfx.whistle();
      burstConfetti(ball.pos.x, 1.5, ball.pos.z);
      showToast('VÀOOOO! ⚽ Tổng điểm: ' + ball.goals);
      ball.pos.set(0, 0, -4); ball.v.set(0, 0, 0);
    } else { ball.pos.x = -29.5; ball.v.x *= -0.65; }
  }
  if (ball.pos.x > YARD.x1 - 0.5 && Math.abs(ball.pos.z) < YARD.z1) { ball.pos.x = YARD.x1 - 0.5; ball.v.x *= -0.65; }
  if (ball.pos.z < YARD.z0 + 0.5 && Math.abs(ball.pos.x) < YARD.x1) { ball.pos.z = YARD.z0 + 0.5; ball.v.z *= -0.65; }
  if (ball.pos.z > YARD.z1 - 0.5 && Math.abs(ball.pos.x) < YARD.x1 && !(Math.abs(ball.pos.x) < YARD.gate)) { ball.pos.z = YARD.z1 - 0.5; ball.v.z *= -0.65; }
  // chuồng
  if (Math.abs(ball.pos.x - BARN.x) < BARN.hx + 0.55 && Math.abs(ball.pos.z - BARN.z) < BARN.hz + 0.55) {
    if (Math.abs(ball.pos.x - BARN.x) / BARN.hx > Math.abs(ball.pos.z - BARN.z) / BARN.hz) { ball.v.x *= -0.65; ball.pos.x = BARN.x + Math.sign(ball.pos.x - BARN.x) * (BARN.hx + 0.6); }
    else { ball.v.z *= -0.65; ball.pos.z = BARN.z + Math.sign(ball.pos.z - BARN.z) * (BARN.hz + 0.6); }
  }
  for (const c of colliders) {
    const dx = ball.pos.x - c.x, dz = ball.pos.z - c.z;
    const dd = Math.hypot(dx, dz), min = c.r + 0.55;
    if (dd < min && dd > 0.001) {
      ball.pos.x = c.x + (dx / dd) * min;
      ball.pos.z = c.z + (dz / dd) * min;
      const dot = (ball.v.x * dx + ball.v.z * dz) / (dd * dd);
      if (dot < 0) { ball.v.x -= 1.4 * dot * dx; ball.v.z -= 1.4 * dot * dz; }
    }
  }
  const rr = Math.hypot(ball.pos.x, ball.pos.z);
  if (rr > 125) { ball.pos.multiplyScalar(125 / rr); ball.v.multiplyScalar(-0.6); }
  ball.mesh.position.set(ball.pos.x, 0.55, ball.pos.z);
  const speed = ball.v.length();
  if (speed > 0.05) {
    const axis = new THREE.Vector3(ball.v.z, 0, -ball.v.x).normalize();
    ball.mesh.rotateOnWorldAxis(axis, (speed * dt) / 0.55);
  }
}

// ---------- đổi màu + tên ----------
const PIG_COLORS = [
  ['Hồng', '#f2a3b3'], ['Đậm', '#e58aa0'], ['Cam', '#f2b26b'], ['Vàng 👑', '#ffc93c', 'gold'],
  ['Xanh lá', '#9fd65a'], ['Xanh dương', '#7db4dd'], ['Tím', '#c39bf2'], ['Nâu mực', '#a8846f'],
];
function setPigColor(pig, hex) {
  const c = new THREE.Color(hex);
  const dark = c.clone().multiplyScalar(0.78);
  for (const m of pig.paintable) m.color.copy(c);
  for (const m of pig.paintDark) m.color.copy(dark);
  pig.bodyColor = hex;
}
const HATS = [
  ['none', 'Trọc lóc', '❌'],
  ['nonla', 'Nón lá', '👒'],
  ['crown', 'Vương miện', '👑'],
  ['glasses', 'Kính râm', '🕶️'],
  ['ribbon', 'Nơ hồng', '🎀'],
  ['flower', 'Hoa cài', '🌸'],
];
const hatsEl = $('hats');
let tempHat = 'none';

function openColorModal() {
  nameInput.value = player.name === 'Heo Ú' ? '' : (player.name || '');
  [...swatchesEl.children].forEach(btn => btn.classList.toggle('sel', btn.dataset.c === player.bodyColor));
  tempHat = player.hatType || 'none';
  [...hatsEl.children].forEach(btn => btn.classList.toggle('sel', btn.dataset.h === tempHat));
  colorModal.classList.add('show');
}
function closeColorModal() { colorModal.classList.remove('show'); }
for (const [n, c, tag] of PIG_COLORS) {
  const b = document.createElement('button');
  b.className = 'sw';
  b.style.background = c;
  b.dataset.c = c;
  b.title = n;
  if (tag === 'gold') b.textContent = '👑';
  b.addEventListener('click', () => {
    if (tag === 'gold' && !collect.goldUnlocked) { showToast('Tìm đủ 3 trứng vàng để mở màu Heo Vàng 👑'); return; }
    setPigColor(player, c);
    [...swatchesEl.children].forEach(x => x.classList.toggle('sel', x === b));
  });
  swatchesEl.appendChild(b);
}
for (const [hId, hName, icon] of HATS) {
  const b = document.createElement('button');
  b.className = 'hat-opt';
  b.textContent = `${icon} ${hName}`;
  b.dataset.h = hId;
  b.addEventListener('click', () => {
    tempHat = hId;
    setPigHat(player, hId);
    [...hatsEl.children].forEach(x => x.classList.toggle('sel', x === b));
  });
  hatsEl.appendChild(b);
}

$('swSave').addEventListener('click', () => {
  const name = (nameInput.value.trim() || 'Heo Ú').slice(0, 12);
  setPigName(player, name);
  try {
    localStorage.setItem('pigName', name);
    localStorage.setItem('pigColor', player.bodyColor);
    localStorage.setItem('pigHat', player.hatType || 'none');
  } catch (e) { /* bỏ qua */ }
  closeColorModal();
  showToast('Xong! Nhìn xịn xò lắm ' + name + ' ơi 🐷✨');
});
$('swClose').addEventListener('click', () => {
  try {
    const savedHat = localStorage.getItem('pigHat') || 'none';
    setPigHat(player, savedHat);
  } catch (e) {}
  closeColorModal();
});
colorModal.addEventListener('click', (e) => { if (e.target === colorModal) closeColorModal(); });
try {
  let savedColor = null;
  try { savedColor = localStorage.getItem('pigColor'); } catch (e) { /* bỏ qua */ }
  // bản cũ lỡ lưu màu dưới dạng số (16237001) — quy về chuỗi hex
  if (savedColor && !savedColor.startsWith('#') && /^\d+$/.test(savedColor)) {
    savedColor = '#' + Number(savedColor).toString(16).padStart(6, '0');
  }
  if (savedColor) setPigColor(player, savedColor);
  const savedHat = localStorage.getItem('pigHat') || 'nonla'; // mặc định nón lá cho heo người chơi
  setPigHat(player, savedHat);
} catch (e) { /* bỏ qua */ }

// piano mobile: dựng 7 phím
const pianoEl = $('piano');
for (let i = 0; i < 7; i++) {
  const k = document.createElement('button');
  k.textContent = '♪';
  k.addEventListener('pointerdown', (e) => { playNote(i); e.preventDefault(); });
  pianoEl.appendChild(k);
}

// ---------- chip tiến độ ----------
function updateQuest() {
  let s = '🍎 ' + collect.appleGot + '/6 · 🥚 ' + collect.eggGot + '/3 · ⚽ ' + ball.goals + ' · 🥕 ' + digScore;
  if (seek.active) s += ' · 🔍 ' + Math.ceil(Math.max(seek.t, 0)) + 's (' + seek.found + '/3)';
  if (race.active) s += ' · 🏁 ' + (race.state === 'countdown' ? 'chờ…' : race.state === 'running' ? 'đang đua' : 'xong!');
  questEl.textContent = s;
}
spawnApples();
spawnEggs();
updateQuest();

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
  updateConfetti(dt, t);
  updateCollectibles(dt, t);
  updateBubbles(dt, t);
  if (digCd > 0) digCd -= dt;
  updateSeek(dt);
  updateRace(dt, t);
  updateFireflies(dt, t);
  updateEmojiBubbles(dt);
  updateBall(dt);
  questT += dt;
  if (questT > 0.2) { questT = 0; updateQuest(); }

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
  else if (introStep === 2 && t > 12) { introStep = 3; showToast('Bấm/chạm vào heo nào nó hoảng bỏ chạy; chạm vào chính mình để đặt tên 😆', 4500); }
  else if (introStep === 3 && t > 18) { introStep = 4; showToast('Săn táo vàng, tìm trứng, đá táo vào khung thành phía tây nhé!', 4200); }
  else if (introStep === 4 && t > 24) { introStep = 5; showToast('Còn phím 1-7 là đàn heo piano, P là tiệc, H là chụp ảnh 💨📸', 4500); }

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
