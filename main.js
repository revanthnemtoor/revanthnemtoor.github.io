import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    bgColor: 0xFDFBF7, // Ivory
    goldColor: 0xD4AF37,
    ambientLight: 0xffffff,
    bloomStrength: 0.4,
    bloomRadius: 0.5,
    bloomThreshold: 0.85
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor);
// White fog to blend the floor into the ivory background
scene.fog = new THREE.Fog(CONFIG.bgColor, 10, 40);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- THE GOLDEN MONUMENT (Abstract Bust) ---

const bustGroup = new THREE.Group();
scene.add(bustGroup);

// Material: Polished Gold
// We use a CubeCamera for reflections to make it look expensive
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
bustGroup.add(cubeCamera);

const goldMat = new THREE.MeshStandardMaterial({
    color: CONFIG.goldColor,
    metalness: 1.0,
    roughness: 0.15,
    envMap: cubeRenderTarget.texture,
    envMapIntensity: 1.0
});

// Constructing the "Abstract Emperor"
// 1. Head (Sphere)
const headGeo = new THREE.SphereGeometry(1.8, 64, 64);
const head = new THREE.Mesh(headGeo, goldMat);
head.position.y = 1.5;
head.castShadow = true;
bustGroup.add(head);

// 2. Neck (Cylinder)
const neckGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.5, 32);
const neck = new THREE.Mesh(neckGeo, goldMat);
neck.position.y = -0.5;
neck.castShadow = true;
bustGroup.add(neck);

// 3. Shoulders (Box/Trapezoid via Cylinder)
const shoulderGeo = new THREE.CylinderGeometry(1.0, 3.5, 2.0, 4); // 4 sides = abstract block
const shoulder = new THREE.Mesh(shoulderGeo, goldMat);
shoulder.rotation.y = Math.PI / 4;
shoulder.position.y = -2.0;
shoulder.castShadow = true;
bustGroup.add(shoulder);

// 4. Crown/Halo (Torus)
const haloGeo = new THREE.TorusGeometry(2.5, 0.1, 16, 100);
const halo = new THREE.Mesh(haloGeo, goldMat);
halo.position.y = 2.0;
halo.position.z = -0.5;
halo.rotation.x = -Math.PI / 6;
bustGroup.add(halo);

// 5. Rays of the Sun (Spikes behind)
const spikeGeo = new THREE.ConeGeometry(0.1, 4, 8);
for(let i=0; i<12; i++) {
    const spike = new THREE.Mesh(spikeGeo, goldMat);
    const angle = (i / 12) * Math.PI * 2;
    spike.position.y = 1.5 + Math.sin(angle) * 3;
    spike.position.x = Math.cos(angle) * 3;
    spike.position.z = -1.0;
    // Point towards center
    spike.lookAt(0, 1.5, 0);
    spike.rotateX(Math.PI/2);
    bustGroup.add(spike);
}


// --- LIGHTING (Divine Studio) ---

// Ambient
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

// Key Light (Warm Sun)
const sunLight = new THREE.DirectionalLight(0xfffaed, 2.0);
sunLight.position.set(5, 10, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0001;
scene.add(sunLight);

// Fill Light (Soft Gold)
const fillLight = new THREE.PointLight(CONFIG.goldColor, 1.0);
fillLight.position.set(-5, 0, 5);
scene.add(fillLight);

// Rim Light (Bright White for edge definition)
const rimLight = new THREE.SpotLight(0xffffff, 5.0);
rimLight.position.set(0, 5, -10);
rimLight.lookAt(0, 0, 0);
scene.add(rimLight);


// --- POST PROCESSING (Ethereal Glow) ---
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    CONFIG.bloomStrength,
    CONFIG.bloomRadius,
    CONFIG.bloomThreshold
);
composer.addPass(bloomPass);


// --- INTERACTION ---
let scrollPercent = 0;

// Listen to scroll to rotate/move the bust
document.addEventListener('scroll', () => {
    scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
});

// Mouse Parallax
let mouseX = 0;
let mouseY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) * 0.0005;
    mouseY = (e.clientY - window.innerHeight / 2) * 0.0005;
});


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 1. Idle Rotation (Majestic)
    bustGroup.rotation.y = Math.sin(time * 0.2) * 0.1;

    // 2. Scroll Interaction (The Bust turns to face the user or look away)
    // As we scroll down, maybe the camera moves down too
    // camera.position.y = -scrollPercent * 5;

    // Actually, let's have the bust follow the scroll slightly
    bustGroup.position.y = scrollPercent * 2;

    // 3. Mouse Parallax
    camera.position.x += (mouseX * 5 - camera.position.x) * 0.05;
    camera.position.y += (-mouseY * 5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    // Update Reflections
    bustGroup.visible = false;
    cubeCamera.update(renderer, scene);
    bustGroup.visible = true;

    composer.render();
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
