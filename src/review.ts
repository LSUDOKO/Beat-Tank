/**
 * Dev-only asset review sheet (gate C): /review.html?glb=/assets-raw/VH_DECKHOUND_neon.glb[&parts=1]
 * Renders 4 studio angles of one GLB in a 2×2 grid and prints triangle count, bounds and part list.
 * parts=1 tints every mesh a different colour to check part-split boundaries.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const W = 1600, H = 1000;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2d36');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45; // closer to in-game exposure
const key = new THREE.DirectionalLight('#fff4e0', 1.8); key.position.set(5, 8, 6); scene.add(key);
scene.add(new THREE.HemisphereLight('#cfe0ff', '#40384a', 0.6));
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: '#3a3e4a', roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(q.get('glb')!);
const obj = gltf.scene;
const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
const s = 3 / Math.max(size.x, size.y, size.z);
obj.scale.setScalar(s); obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
scene.add(obj);
let tris = 0; const parts: string[] = [];
obj.traverse((o) => {
  const m = o as THREE.Mesh; if (!m.isMesh) return;
  tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  const pb = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  parts.push(`${parts.length}: ${m.name || '(mesh)'}  ${pb.toArray().map((v) => (v / s).toFixed(2)).join('×')}`);
  if (q.has('parts')) m.material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(parts.length * 0.13 % 1, 0.75, 0.55), roughness: 0.5 });
});
document.getElementById('info')!.textContent = `${q.get('glb')}\ntris ${tris | 0}   bounds ${size.toArray().map((v) => v.toFixed(2)).join(' × ')}\n${parts.length} meshes\n${parts.slice(0, 14).join('\n')}`;

const cam = new THREE.PerspectiveCamera(32, (W / 2) / (H / 2), 0.1, 100);
const views = [[1, 0.45, 1], [-1, 0.45, 1], [1.4, 0.15, 0], [-0.4, 0.5, -1.2]];
views.forEach(([x, y, z], i) => {
  const vx = (i % 2) * W / 2, vy = (1 - Math.floor(i / 2)) * H / 2;
  renderer.setViewport(vx, vy, W / 2, H / 2); renderer.setScissor(vx, vy, W / 2, H / 2);
  cam.position.set(x, y, z).normalize().multiplyScalar(7.2).add(new THREE.Vector3(0, 1.2, 0)); cam.lookAt(0, 1, 0);
  renderer.render(scene, cam);
});
document.title = 'ready';
