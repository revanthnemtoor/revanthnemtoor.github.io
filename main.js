import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000c0d); // Deep Dark Teal
scene.fog = new THREE.FogExp2(0x000c0d, 0.03); // Dense atmosphere

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 5, 20);

const renderer = new THREE.WebGLRenderer({ antialias: false }); // Post-proc handles AA feel
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- CUSTOM SHADER MATERIAL (WIND) ---
// We inject code into MeshStandardMaterial to animate vertices
const windMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffaa,
    emissive: 0x004433,
    roughness: 0.4,
    metalness: 0.1,
    flatShading: true,
});

windMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.time = { value: 0 };

    // Add time uniform
    shader.vertexShader = `
        uniform float time;
        // Simplex Noise Function
        // (Simplified for brevity, or use sine waves)
        float sinNoise(vec2 p) {
            return sin(p.x) * sin(p.y);
        }
    ` + shader.vertexShader;

    // Modify position
    const token = '#include <begin_vertex>';
    const customTransform = `
        vec3 transformed = vec3( position );
        
        // Simple wind sway based on height (position.y)
        float sway = position.y * position.y * 0.5; // Top moves more
        transformed.x += sin(time * 2.0 + position.z * 0.5 + instanceMatrix[3][0]) * sway * 0.2;
        transformed.z += cos(time * 1.5 + position.x * 0.5 + instanceMatrix[3][2]) * sway * 0.2;
    `;

    shader.vertexShader = shader.vertexShader.replace(token, customTransform);
    windMaterial.userData.shader = shader;
};


// --- INSTANCED FOLIAGE ---
// Create a simple grass/fern blade geometry
const bladeGeo = new THREE.ConeGeometry(0.2, 4, 3);
bladeGeo.translate(0, 2, 0); // Pivot at bottom

const count = 3000;
const foliage = new THREE.InstancedMesh(bladeGeo, windMaterial, count);

const dummy = new THREE.Object3D();
const color = new THREE.Color();

for (let i = 0; i < count; i++) {
    // Random Position on floor
    const r = Math.pow(Math.random(), 0.5) * 40; // Bias towards center? No, spread out
    const theta = Math.random() * Math.PI * 2;
    dummy.position.x = r * Math.cos(theta);
    dummy.position.z = r * Math.sin(theta);
    dummy.position.y = 0;

    // Random Scale
    const s = Math.random() * 0.5 + 0.5;
    dummy.scale.set(s, s * (Math.random() * 0.5 + 0.8), s);

    // Random Rotation
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.rotation.x = (Math.random() - 0.5) * 0.5; // Slight tilt
    dummy.rotation.z = (Math.random() - 0.5) * 0.5;

    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);

    // Random Colors (Teal to Blue to Purple)
    color.setHSL(Math.random() * 0.2 + 0.4, 0.8, 0.5);
    foliage.setColorAt(i, color);
}

foliage.instanceMatrix.needsUpdate = true;
scene.add(foliage);


// --- GROUND ---
const groundGeo = new THREE.PlaneGeometry(200, 200, 64, 64);
// Displace ground slightly here or just keep flat dark
const groundMat = new THREE.MeshStandardMaterial({
    color: 0x000506,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);


// --- FIREFLIES ---
const firefliesGeo = new THREE.BufferGeometry();
const fireflyCount = 200;
const fireflyPos = new Float32Array(fireflyCount * 3);

for (let i = 0; i < fireflyCount * 3; i++) {
    fireflyPos[i] = (Math.random() - 0.5) * 50;
    if (i % 3 === 1) fireflyPos[i] = Math.random() * 10; // Y height 0-10
}

firefliesGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPos, 3));
const fireflyMat = new THREE.PointsMaterial({
    color: 0xccff00, // Lime
    size: 0.2,
    transparent: true,
    opacity: 0.8
});
const fireflies = new THREE.Points(firefliesGeo, fireflyMat);
scene.add(fireflies);


// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0x112233, 2.0));

// Glowing Orb simulating a moon/light source
const light = new THREE.PointLight(0x00ffaa, 50, 100);
light.position.set(10, 20, 10);
scene.add(light);


// --- POST PROCESSING ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 1.2;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);


// --- ANIMATION ---
const clock = new THREE.Clock(); // Unused here but good for consistency
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.001;

    // Update Wind Shader Time
    if (windMaterial.userData.shader) {
        windMaterial.userData.shader.uniforms.time.value = time;
    }

    // Animate Fireflies (Noise movement)
    const positions = fireflies.geometry.attributes.position.array;
    for (let i = 0; i < fireflyCount; i++) {
        // Simple Sine wave movement
        positions[i * 3] += Math.sin(time + i) * 0.02;     // X
        positions[i * 3 + 1] += Math.cos(time * 0.5 + i) * 0.01; // Y
        positions[i * 3 + 2] += Math.sin(time * 0.8 + i * 2) * 0.02; // Z
    }
    fireflies.geometry.attributes.position.needsUpdate = true;

    // Subtle Camera Movement
    camera.position.x = Math.sin(time * 0.1) * 10;
    camera.position.z = Math.cos(time * 0.1) * 10 + 20; // Orbit
    camera.lookAt(0, 5, 0);

    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
