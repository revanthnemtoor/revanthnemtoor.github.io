import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.FogExp2(0x881111, 0.02); // Deep Crimson Fog

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 20); // Camera slightly elevated

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- THE MONUMENT (Instanced City) ---
const buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.9,
    metalness: 0.1, // Matte concrete
});

// Create 2000 buildings
const count = 2000;
const mesh = new THREE.InstancedMesh(buildingGeometry, buildingMaterial, count);
mesh.castShadow = true;
mesh.receiveShadow = true;

const dummy = new THREE.Object3D();
const gridWidth = 40; // Buildings per side
const spacing = 4;   // Spacing between buildings

for (let i = 0; i < count; i++) {
    // Generate scale first
    const height = Math.random() * 8 + 2; // Tall monoliths
    const width = Math.random() * 2 + 1;

    // Position: Two massive blocks tied by a central avenue
    let x = (Math.random() - 0.5) * 100;
    // Push buildings away from center avenue
    if (Math.abs(x) < 5) x += (x > 0 ? 5 : -5);

    const z = (Math.random() - 0.5) * 200; // Deep depth

    dummy.position.set(x, height / 2, z);
    dummy.rotation.y = 0; // Strict facing alignment (Order)
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
}

scene.add(mesh);

// Floor
const floorGeometry = new THREE.PlaneGeometry(500, 500);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.8,
    metalness: 0.5
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);


// --- THE ETERNAL SUN ---
const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 10, -100); // Far away center
scene.add(sun);

// Lighting
const dirLight = new THREE.DirectionalLight(0xffaa00, 5); // Golden Sun Light
dirLight.position.set(0, 20, -50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft fill
scene.add(ambientLight);

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Infinite Dolly Effect
    const speed = 5;
    const loopLength = 20; // Needs to match pattern roughly for seamlessness, or just fly forever

    // Instead of moving camera locally which breaks fog, we move the world?
    // No, simpler: Move camera forward, when z < -50, reset to 0? No, instanced mesh is static.
    // Let's just fly slowly forward forever into the fog.
    camera.position.z -= 0.1;

    // Add subtle camera shake (The March of Millions)
    camera.position.y = 5 + Math.sin(elapsedTime * 10) * 0.05;

    // Sun stays relative? No, let's approach it.
    // If we get too close, we reset.
    if (camera.position.z < -80) {
        camera.position.z = 20;
    }

    // Keep Sun fixed relative to camera for "Godlike" feeling?
    // No, static sun is more imposing.

    renderer.render(scene, camera);
}

// Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
