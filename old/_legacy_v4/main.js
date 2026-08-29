import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.03); // Deep fog for infinity feel

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.enableZoom = false; // Keep the user in the "zone"

// Objects
const geometry = new THREE.IcosahedronGeometry(10, 2);
const material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    wireframe: true,
    roughness: 0.1,
    metalness: 1.0,
    emissive: 0x00f3ff,
    emissiveIntensity: 0.2
});

const mainSphere = new THREE.Mesh(geometry, material);
scene.add(mainSphere);

// Floating Particles
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2000;
const posArray = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100; // Spread heavily
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({
    size: 0.05,
    color: 0xbc13fe,
    transparent: true,
    opacity: 0.8,
});

const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

// Inner Core
const coreGeometry = new THREE.OctahedronGeometry(4, 0);
const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.1
});
const core = new THREE.Mesh(coreGeometry, coreMaterial);
scene.add(core);


// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00f3ff, 200, 100);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0xbc13fe, 200, 100);
pointLight2.position.set(-10, -10, -10);
scene.add(pointLight2);


// Interactive Mouse Effect
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
}
window.addEventListener('mousemove', onMouseMove, false);


// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate objects
    mainSphere.rotation.y += 0.002;
    mainSphere.rotation.x += 0.001;

    core.rotation.y -= 0.004;
    core.rotation.z += 0.002;

    // Wave effect for particles
    particlesMesh.rotation.y = -elapsedTime * 0.05;
    particlesMesh.rotation.x = elapsedTime * 0.02;

    // Pulse effect
    const scale = 1 + Math.sin(elapsedTime * 2) * 0.02;
    mainSphere.scale.set(scale, scale, scale);

    // Mouse Interaction (Distortion)
    // Simple look-at or slight pan based on mouse
    const targetX = mouse.x * 2;
    const targetY = mouse.y * 2;

    mainSphere.rotation.y += 0.05 * (targetX - mainSphere.rotation.y);
    mainSphere.rotation.x += 0.05 * (targetY - mainSphere.rotation.x);

    controls.update();
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
