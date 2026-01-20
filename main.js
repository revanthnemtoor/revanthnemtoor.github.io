import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

// --- CONFIGURATION ---
const CONFIG = {
    bgColor: 0x000000,
    wireframeColor: 0x00ff41, // Green
    distortionStrength: 1.0,
    mouseSensitivity: 0.5
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor);
// Add some fog to fade out distant grid lines
scene.fog = new THREE.Fog(CONFIG.bgColor, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15;

const renderer = new THREE.WebGLRenderer({ antialias: false }); // Disable AA for raw look
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- THE ARTIFACT (Custom Shader Material) ---
// We'll use a TorusKnot but deform it heavily in the vertex shader

const vertexShader = `
    uniform float time;
    uniform float noiseStrength;
    varying vec2 vUv;
    varying vec3 vNormal;

    // Simplex Noise (simplified)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vUv = uv;
        vNormal = normal;

        // Spike effect
        float noiseVal = snoise(position + time * 0.5);
        vec3 newPos = position + normal * noiseVal * noiseStrength;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
    }
`;

const fragmentShader = `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
        // Simple wireframe-ish glow
        float scanline = sin(vUv.y * 100.0 + time * 5.0) * 0.5 + 0.5;

        // Discard some pixels for a "decay" look
        if (mod(gl_FragCoord.x, 4.0) < 1.0) discard;
        if (mod(gl_FragCoord.y, 4.0) < 1.0) discard;

        gl_FragColor = vec4(0.0, 1.0, 0.25, 1.0); // Hacker Green
        gl_FragColor.rgb *= scanline + 0.5;
    }
`;

const artifactMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        noiseStrength: { value: 1.0 }
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    wireframe: true,
    transparent: true,
    side: THREE.DoubleSide
});

const artifactGeometry = new THREE.TorusKnotGeometry(4, 1.2, 128, 32);
const artifact = new THREE.Mesh(artifactGeometry, artifactMaterial);
scene.add(artifact);

// Background Grid (Retro Style)
const gridHelper = new THREE.GridHelper(100, 50, 0x111111, 0x111111);
gridHelper.position.y = -10;
scene.add(gridHelper);


// --- POST PROCESSING (The Hacked Broadcast) ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// 1. Film Pass (Static/Grain)
const filmPass = new FilmPass(0.8, 0.2, 512, false);
composer.addPass(filmPass);

// 2. Custom "Digital Glitch" Shader
const GlitchShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "time": { value: 0.0 },
        "uMouseSpeed": { value: 0.0 }, // 0 to 1
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
        uniform float uMouseSpeed;
        uniform vec2 resolution;
        varying vec2 vUv;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv;

            // RGB Shift (Chromatic Aberration) based on mouse speed
            float shiftStrength = 0.005 + uMouseSpeed * 0.05;

            // Jitter shift
            if (random(vec2(time, uv.y)) > 0.95) {
                shiftStrength += 0.02; // Random glitch spikes
            }

            vec4 r = texture2D(tDiffuse, uv + vec2(shiftStrength, 0.0));
            vec4 g = texture2D(tDiffuse, uv);
            vec4 b = texture2D(tDiffuse, uv - vec2(shiftStrength, 0.0));

            vec4 color = vec4(r.r, g.g, b.b, 1.0);

            // Scanline displacement (Tearing)
            float tear = 0.0;
            if (sin(uv.y * 10.0 + time * 10.0) > 0.9 + (1.0 - uMouseSpeed)*0.1) {
                tear = (random(vec2(uv.y, time)) - 0.5) * 0.5 * uMouseSpeed;
            }
            vec4 tearColor = texture2D(tDiffuse, uv + vec2(tear, 0.0));
            if (tear != 0.0) {
                 color = tearColor; // Replace with torn pixels
                 color.rgb += 0.1; // Brighten tear
            }

            // Scanlines (Dark bands)
            float scanline = sin(uv.y * resolution.y * 0.5);
            color.rgb -= abs(scanline) * 0.1;

            gl_FragColor = color;
        }
    `
};

const glitchPass = new ShaderPass(GlitchShader);
composer.addPass(glitchPass);


// --- INTERACTION ---
let mouseVelocity = 0;
const mouse = new THREE.Vector2();
const prevMouse = new THREE.Vector2();

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = clock.getDelta(); // This resets delta, careful using it with elapsedTime

    // Update Artifact
    artifactMaterial.uniforms.time.value = elapsedTime;

    // Calculate Mouse Speed (Instantaneous)
    const dist = mouse.distanceTo(prevMouse);
    // Decay velocity
    mouseVelocity += (dist * 20.0 - mouseVelocity) * 0.1;
    prevMouse.copy(mouse);

    // Artifact reacts to mouse speed (spikes more)
    artifactMaterial.uniforms.noiseStrength.value = 1.0 + mouseVelocity * 5.0;

    // Rotate Artifact
    artifact.rotation.x = elapsedTime * 0.2;
    artifact.rotation.y = elapsedTime * 0.5 + mouse.x * 0.5;

    // Update Post Processing
    glitchPass.uniforms.time.value = elapsedTime;
    glitchPass.uniforms.uMouseSpeed.value = Math.min(mouseVelocity, 1.0); // Cap at 1

    composer.render();
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    glitchPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- UI TEXT SCRAMBLE LOGIC ---
class TextScramble {
    constructor(el) {
        this.el = el;
        this.chars = '!<>-_\\/[]{}—=+*^?#________';
        this.originalText = el.innerText;
        this.frameRequest = null;
        this.frame = 0;
        this.queue = [];
        this.update = this.update.bind(this);

        // Listeners
        this.el.addEventListener('mouseenter', () => {
            this.setText(this.el.getAttribute('data-original') || this.originalText);
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
            const start = Math.floor(Math.random() * 40);
            const end = start + Math.floor(Math.random() * 40);
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

// Initialize Scramblers
const items = document.querySelectorAll('.nav-item');
items.forEach(el => {
    const fx = new TextScramble(el);
    el.addEventListener('mouseenter', () => fx.setText(el.getAttribute('data-original')));
});

const title = document.querySelector('h1.glitch-text');
if(title) {
    const fx = new TextScramble(title);
    // Auto trigger once on load
    setTimeout(() => fx.setText("REVANTH NEMTOOR"), 1000);
}

animate();
