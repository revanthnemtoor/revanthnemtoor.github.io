import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    bgColor: 0x080808,
    goldColor: 0xD4AF37,
    ambientLight: 0x404040,
    pointLightColor: 0xffffff,
    bloomStrength: 0.8, // Radiant glow
    bloomRadius: 0.5,
    bloomThreshold: 0.2
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor);
// Subtle fog to blend the floor into the void
scene.fog = new THREE.Fog(CONFIG.bgColor, 10, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- THE SOVEREIGN ORB (Imperial Centerpiece) ---

const orbGroup = new THREE.Group();
scene.add(orbGroup);

// 1. The Golden Sphere (The Emperor)
// High detail sphere
const orbGeo = new THREE.SphereGeometry(2.5, 64, 64);

// Gold Material
// To look real without an HDRI, we need high metalness and a "fake" reflection map or careful lighting.
// We'll use a CubeCamera to create real-time reflections of the scene (even if empty, it reflects lights).
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
orbGroup.add(cubeCamera);

const orbMat = new THREE.MeshStandardMaterial({
    color: CONFIG.goldColor,
    metalness: 1.0,
    roughness: 0.15,
    envMap: cubeRenderTarget.texture,
    envMapIntensity: 1.0
});

const orb = new THREE.Mesh(orbGeo, orbMat);
orb.castShadow = true;
orb.receiveShadow = true;
orbGroup.add(orb);


// 2. The Rings of Dominion (Orbiting the sphere)
// Thin, elegant gold rings
const ringMat = new THREE.MeshStandardMaterial({
    color: CONFIG.goldColor,
    metalness: 1.0,
    roughness: 0.1,
    side: THREE.DoubleSide
});

const rings = [];

// Horizontal Ring
const r1 = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.05, 16, 100), ringMat);
r1.rotation.x = Math.PI / 2; // Flat
orbGroup.add(r1);
rings.push(r1);

// Tilted Ring 1
const r2 = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.05, 16, 100), ringMat);
r2.rotation.x = Math.PI / 3;
r2.rotation.y = Math.PI / 6;
orbGroup.add(r2);
rings.push(r2);

// Tilted Ring 2
const r3 = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.05, 16, 100), ringMat);
r3.rotation.x = -Math.PI / 3;
r3.rotation.y = -Math.PI / 6;
orbGroup.add(r3);
rings.push(r3);


// --- LIGHTING (Dramatic Studio Setup) ---

// Ambient
const ambient = new THREE.AmbientLight(CONFIG.ambientLight, 0.5);
scene.add(ambient);

// Key Light (Warm Gold - Top Right)
const keyLight = new THREE.SpotLight(CONFIG.goldColor, 200);
keyLight.position.set(10, 10, 10);
keyLight.angle = Math.PI / 6;
keyLight.penumbra = 0.5;
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 1024;
keyLight.shadow.mapSize.height = 1024;
scene.add(keyLight);

// Rim Light (Cool White - Back Left) - to separate from background
const rimLight = new THREE.SpotLight(0xffffff, 100);
rimLight.position.set(-10, 5, -10);
rimLight.lookAt(0, 0, 0);
scene.add(rimLight);

// Fill Light (Soft - Bottom)
const fillLight = new THREE.PointLight(CONFIG.goldColor, 5, 20);
fillLight.position.set(0, -10, 5);
scene.add(fillLight);


// --- POST PROCESSING (Majestic Glow) ---
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Unreal Bloom for that "Holy" look
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold
);
composer.addPass(bloomPass);


// --- INTERACTION ---
let mouseX = 0;
let mouseY = 0;

window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.001;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.001;
});


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Rotate the Group slowly
    orbGroup.rotation.y = time * 0.05;

    // Rotate Rings independently
    r1.rotation.z = time * 0.1;
    r2.rotation.z = time * 0.15;
    r3.rotation.z = time * 0.08;

    // Gentle floating
    orbGroup.position.y = Math.sin(time * 0.5) * 0.2;

    // Mouse Interaction (Parallax)
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    // Update Reflections
    orb.visible = false; // Hide sphere so it doesn't reflect itself awkwardly
    cubeCamera.update(renderer, scene);
    orb.visible = true;

    composer.render();
}


// --- UI MANAGER (Modal Logic) ---

class ImperialUI {
    constructor() {
        this.overlay = document.getElementById('modal-overlay');
        this.modals = document.querySelectorAll('.proclamation-card');
        this.buttons = document.querySelectorAll('.nav-btn');
        this.closeButtons = document.querySelectorAll('.close-btn');

        this.init();
    }

    init() {
        // Open Modal
        this.buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                this.openModal(targetId);
            });
        });

        // Close Modal
        this.closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeAll());
        });

        // Click Overlay to Close
        this.overlay.addEventListener('click', () => this.closeAll());
    }

    openModal(id) {
        // Close any open ones first
        this.modals.forEach(m => m.classList.add('hidden'));

        const modal = document.getElementById(id);
        if (modal) {
            this.overlay.classList.remove('hidden');
            modal.classList.remove('hidden');
        }
    }

    closeAll() {
        this.overlay.classList.add('hidden');
        this.modals.forEach(m => m.classList.add('hidden'));
    }
}

new ImperialUI();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
