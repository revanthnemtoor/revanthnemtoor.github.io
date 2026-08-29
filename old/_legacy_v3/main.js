import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001); // Subtle deep fog

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 20;
camera.position.y = 5;
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" }); // Antialias off for post-processing performance
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.CineonToneMapping;
renderer.toneMappingExposure = 1.5;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Fade In
setTimeout(() => {
    document.getElementById('canvas-container').style.opacity = '1';
}, 100);

// --- GEOMETRY: The Nebula Clouds ---
const particleCount = 1500;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const sizes = new Float32Array(particleCount);

const colorPalette = [
    new THREE.Color('#ff0055'), // Pink/Red
    new THREE.Color('#0055ff'), // Blue
    new THREE.Color('#00ffaa'), // Cyan/Green
    new THREE.Color('#ffffff')  // White stars
];

for (let i = 0; i < particleCount; i++) {
    // Spiral distribution
    const radius = Math.random() * 30 + 5;
    const spinAngle = radius * 0.5;
    const branchAngle = (i % 3) * ((Math.PI * 2) / 3);

    const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 3;
    const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 3;
    const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 3;

    positions[i * 3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i * 3 + 1] = randomY * 2; // Flattened galaxy shape
    positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    // Mixed colors based on radius
    const mixedColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = mixedColor.r;
    colors[i * 3 + 1] = mixedColor.g;
    colors[i * 3 + 2] = mixedColor.b;

    sizes[i] = Math.random() * 2;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

// Custom Shader Material for glowy dots
const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
        uniform float time;
        uniform float uPixelRatio;
        attribute float size;
        varying vec3 vColor;
        
        void main() {
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            // Orbiting movement
            float angle = time * 0.1 * (1.0 / length(position.xz));
            float newX = position.x * cos(angle) - position.z * sin(angle);
            float newZ = position.x * sin(angle) + position.z * cos(angle);
            
            vec4 newPos = modelViewMatrix * vec4(newX, position.y, newZ, 1.0);
            
            gl_PointSize = size * uPixelRatio * (50.0 / -newPos.z);
            gl_Position = projectionMatrix * newPos; // Use simplifiedorbit for visuals
        }
    `,
    fragmentShader: `
        varying vec3 vColor;
        
        void main() {
            // Circular particle
            float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
            if (distanceToCenter > 0.5) discard;
            
            // Soft glow gradient
            float strength = 0.05 / (distanceToCenter - 0.5); // Inverse glow? No, standard halo
            strength = 1.0 - (distanceToCenter * 2.0);
            strength = pow(strength, 3.0);

            gl_FragColor = vec4(vColor, strength);
        }
    `,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    transparent: true
});

const points = new THREE.Points(geometry, shaderMaterial);
scene.add(points);


// --- POST PROCESSING ---
const renderScene = new RenderPass(scene, camera);

// Resolution, Strength, Radius, Threshold
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.strength = 2.0;
bloomPass.radius = 0.5;
bloomPass.threshold = 0; // Bloom everything for maximum glow

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);


// Interaction
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Update Uniforms
    shaderMaterial.uniforms.time.value = elapsedTime;

    // Global rotation based on mouse
    scene.rotation.y = elapsedTime * 0.05 + (mouse.x * 0.1);
    scene.rotation.x = (mouse.y * 0.05);

    // Camera sway
    camera.position.x = Math.sin(elapsedTime * 0.2) * 2;
    camera.lookAt(0, 0, 0);

    // Render via Composer (not renderer)
    composer.render();
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
    shaderMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});

animate();
