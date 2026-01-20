import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    bgColor: 0x050505,
    primaryColor: 0x00ff2a, // Green
    accentColor: 0xffcc00, // Gold
    distortionStrength: 0.5,
    mouseSensitivity: 0.2
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor);
scene.fog = new THREE.Fog(CONFIG.bgColor, 20, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 12;

const renderer = new THREE.WebGLRenderer({ antialias: true }); // Better quality for Imperial look
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- THE ARTIFACT: IMPERIAL CORE ---
// A complex nested geometry representing the "Digital Chakra" / Control Core.

const coreGroup = new THREE.Group();
scene.add(coreGroup);

// 1. Central Emperor Sphere (Solid, Gold)
const sphereGeo = new THREE.IcosahedronGeometry(2, 4); // High detail
const sphereMat = new THREE.MeshStandardMaterial({
    color: CONFIG.accentColor,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0xaa4400,
    emissiveIntensity: 0.2
});
const centralCore = new THREE.Mesh(sphereGeo, sphereMat);
coreGroup.add(centralCore);

// 2. Inner Rotating Rings (Green Wireframe - The Surveillance Network)
const ringGeo1 = new THREE.TorusGeometry(3.5, 0.05, 16, 100);
const ringMat1 = new THREE.MeshBasicMaterial({ color: CONFIG.primaryColor, wireframe: true, transparent: true, opacity: 0.6 });
const innerRing = new THREE.Mesh(ringGeo1, ringMat1);
coreGroup.add(innerRing);

// 3. Outer Rotating Rings (Thicker, Gold - The Dominion)
const ringGeo2 = new THREE.TorusGeometry(5.0, 0.1, 16, 100);
const ringMat2 = new THREE.MeshStandardMaterial({
    color: CONFIG.accentColor,
    metalness: 1.0,
    roughness: 0.2
});
const outerRing = new THREE.Mesh(ringGeo2, ringMat2);
coreGroup.add(outerRing);

// 4. Orbital Satellites (Floating cubes)
const satGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const satMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const satellites = [];

for(let i=0; i<8; i++) {
    const sat = new THREE.Mesh(satGeo, satMat);
    const angle = (i / 8) * Math.PI * 2;
    sat.position.set(Math.cos(angle) * 7, Math.sin(angle) * 7, 0);
    sat.userData = { angle: angle, speed: 0.5 + Math.random() * 0.5, radius: 7 };
    coreGroup.add(sat);
    satellites.push(sat);
}


// LIGHTING
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(CONFIG.accentColor, 5, 50);
pointLight.position.set(5, 5, 10);
scene.add(pointLight);

const coreLight = new THREE.PointLight(0xff0000, 2, 20);
coreGroup.add(coreLight); // Light emanating from core


// BACKGROUND GRID (Floor)
const gridHelper = new THREE.GridHelper(200, 50, 0x111111, 0x0a0a0a);
gridHelper.position.y = -10;
scene.add(gridHelper);


// --- POST PROCESSING ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 1. Film Pass (Surveillance Grain - Cleaner than Glitch)
const filmPass = new FilmPass(0.35, 0.025, 648, false);
composer.addPass(filmPass);

// 2. Custom "Surveillance" Shader (Subtle chromatic aberration, night vision tint)
const SurveillanceShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "time": { value: 0.0 },
        "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;

            // Subtle Lens Distortion
            vec2 dist = uv - 0.5;
            float r2 = dot(dist, dist);
            uv += dist * (r2 * 0.05); // Mild fisheye

            // Chromatic Aberration (Static)
            float shift = 0.002;
            vec4 r = texture2D(tDiffuse, uv + vec2(shift, 0.0));
            vec4 g = texture2D(tDiffuse, uv);
            vec4 b = texture2D(tDiffuse, uv - vec2(shift, 0.0));

            vec3 color = vec3(r.r, g.g, b.b);

            // Night Vision Green Tint
            color *= vec3(0.8, 1.1, 0.9);

            // Scanlines
            float scan = sin(uv.y * 800.0 + time * 2.0) * 0.05;
            color -= scan;

            // Vignette
            float vig = 1.0 - smoothstep(0.4, 1.2, length(vUv - 0.5) * 1.5);
            color *= vig;

            gl_FragColor = vec4(color, 1.0);
        }
    `
};

const surveillancePass = new ShaderPass(SurveillanceShader);
composer.addPass(surveillancePass);


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // 1. Rotate the Whole Group
    coreGroup.rotation.y = elapsedTime * 0.1;

    // 2. Animate Rings (Opposite directions for complexity)
    innerRing.rotation.x = elapsedTime * 0.5;
    innerRing.rotation.y = elapsedTime * 0.2;

    outerRing.rotation.x = -elapsedTime * 0.3;
    outerRing.rotation.z = elapsedTime * 0.1;

    // 3. Pulse Core
    const pulse = 1.0 + Math.sin(elapsedTime * 2.0) * 0.05;
    centralCore.scale.set(pulse, pulse, pulse);

    // 4. Animate Satellites
    satellites.forEach(sat => {
        sat.userData.angle += sat.userData.speed * 0.02;
        sat.position.x = Math.cos(sat.userData.angle) * sat.userData.radius;
        sat.position.z = Math.sin(sat.userData.angle) * sat.userData.radius;
        sat.rotation.x += 0.05;
        sat.rotation.y += 0.05;
    });

    // Update Post Processing
    surveillancePass.uniforms.time.value = elapsedTime;

    composer.render();
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    surveillancePass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});


// --- UI LOGIC (Text Scramble & Windows) ---
// Note: We need to match the new Data Attributes from index.html

// Scramble Effect
class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        this.originalText = el.innerText;
        this.frameRequest = null;
        this.frame = 0;
        this.queue = [];
        this.update = this.update.bind(this);

        el.addEventListener('mouseenter', () => {
            this.setText(el.getAttribute('data-original') || this.originalText);
        });
    }

    setText(newText) {
        const oldText = this.el.innerText;
        const length = Math.max(oldText.length, newText.length);
        const promise = new Promise((resolve) => this.resolve = resolve);

        this.queue = [];
        for (let i = 0; i < length; i++) {
            const from = oldText[i] || '';
            const to = newText[i] || '';
            const start = Math.floor(Math.random() * 20); // Faster scramble
            const end = start + Math.floor(Math.random() * 20);
            this.queue.push({ from, to, start, end });
        }

        cancelAnimationFrame(this.frameRequest);
        this.frame = 0;
        this.update();
        return promise;
    }

    update() {
        let output = '';
        let complete = 0;

        for (let i = 0, n = this.queue.length; i < n; i++) {
            let { from, to, start, end, char } = this.queue[i];

            if (this.frame >= end) {
                complete++;
                output += to;
            } else if (this.frame >= start) {
                if (!char || Math.random() < 0.28) {
                    char = this.randomChar();
                    this.queue[i].char = char;
                }
                output += `<span class="dud">${char}</span>`;
            } else {
                output += from;
            }
        }

        this.el.innerHTML = output;

        if (complete === this.queue.length) {
            this.resolve();
        } else {
            this.frameRequest = requestAnimationFrame(this.update);
            this.frame++;
        }
    }

    randomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
}

document.querySelectorAll('.nav-item').forEach(el => new TextScramble(el));
const title = document.querySelector('h1.glitch-text');
if(title) {
    const fx = new TextScramble(title);
    setTimeout(() => fx.setText("SAMRAAT REVANTH"), 1000);
}


// Window Manager
class WindowManager {
    constructor() {
        this.zIndex = 100;

        // Setup Close Buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const win = e.target.closest('.hacker-window');
                this.closeWindow(win);
            });
        });

        // Setup Dragging
        document.querySelectorAll('.hacker-window').forEach(win => {
            const header = win.querySelector('.window-header');
            header.addEventListener('mousedown', (e) => this.startDrag(e, win));
            win.addEventListener('mousedown', () => win.style.zIndex = ++this.zIndex);
        });

        // Setup Nav Links (Using data-target)
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                if(targetId) this.openWindow(targetId);
            });
        });
    }

    openWindow(id) {
        const win = document.getElementById(id);
        if(win) {
            // Close others if we want single-window focus (optional, but cleaner)
            // document.querySelectorAll('.hacker-window').forEach(w => w.classList.remove('visible'));

            win.classList.remove('hidden');
            requestAnimationFrame(() => {
                win.classList.add('visible');
                win.style.zIndex = ++this.zIndex;
            });
        }
    }

    closeWindow(win) {
        win.classList.remove('visible');
        setTimeout(() => win.classList.add('hidden'), 300);
    }

    startDrag(e, win) {
        e.preventDefault();
        win.classList.add('dragging');
        win.style.zIndex = ++this.zIndex;

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = win.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        win.style.transform = 'none'; // Disable translate centering during drag
        win.style.left = startLeft + 'px';
        win.style.top = startTop + 'px';

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            win.style.left = (startLeft + dx) + 'px';
            win.style.top = (startTop + dy) + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            win.classList.remove('dragging');
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
}

new WindowManager();

animate();
