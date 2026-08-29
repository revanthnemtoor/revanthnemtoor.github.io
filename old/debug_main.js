import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

// --- CONFIG ---
const WIDTH = 128; // Texture width. Total particles = 128 * 128 = 16384
const PARTICLES = WIDTH * WIDTH;

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0); // Paper white

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 400;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- GPGPU SETUP ---
const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

if (!renderer.capabilities.isWebGL2) {
    gpuCompute.setDataType(THREE.HalfFloatType);
}

const dtPosition = gpuCompute.createTexture();
const dtVelocity = gpuCompute.createTexture();
const positionVariable = gpuCompute.addVariable("texturePosition", `
    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 pos = texture2D( texturePosition, uv );
        vec4 vel = texture2D( textureVelocity, uv );
        
        pos.xyz += vel.xyz; // Apply velocity
        
        gl_FragColor = pos;
    }
`, dtPosition);

const velocityVariable = gpuCompute.addVariable("textureVelocity", `
    uniform float time;
    uniform vec2 mouse;
    uniform float mousePressed;
    
    // Simplex Noise (Standard Chunk)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec4 pos = texture2D( texturePosition, uv );
        vec4 vel = texture2D( textureVelocity, uv );
        
        // Attraction to Mouse
        vec3 target = vec3(mouse * 150.0, 0.0); // Scale mouse to world space
        vec3 dir = target - pos.xyz;
        float dist = length(dir);
        
        // Flow Field (Curl Noise-ish via offset noise)
        float n1 = snoise(pos.xy * 0.01 + time * 0.5);
        float n2 = snoise(pos.xy * 0.01 + time * 0.5 + 100.0);
        float n3 = snoise(pos.xz * 0.01 + time * 0.5);
        
        vec3 flow = vec3(n1, n2, n3) * 0.5;
        
        // Forces
        vec3 attraction = normalize(dir) * (5000.0 / (dist * dist + 100.0)); // Gravity-like
        if(mousePressed > 0.5) attraction *= -2.0; // Repel on click

        vel.xyz += attraction * 0.1;
        vel.xyz += flow * 0.05;
        
        // Damping (Air Friction)
        vel.xyz *= 0.96;
        
        // Center return (keep them on screen if lost)
        if(length(pos.xyz) > 300.0) {
            vel.xyz -= normalize(pos.xyz) * 0.5;
        }

        gl_FragColor = vel;
    }
`, dtVelocity);

gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

// Initialize Data
const positionArray = dtPosition.image.data;
const velocityArray = dtVelocity.image.data;

for (let i = 0; i < PARTICLES; i++) {
    const x = Math.random() * 200 - 100;
    const y = Math.random() * 200 - 100;
    const z = Math.random() * 200 - 100;
    positionArray[i * 4 + 0] = x;
    positionArray[i * 4 + 1] = y;
    positionArray[i * 4 + 2] = z;
    positionArray[i * 4 + 3] = 1; // W component

    velocityArray[i * 4 + 0] = 0;
    velocityArray[i * 4 + 1] = 0;
    velocityArray[i * 4 + 2] = 0;
    velocityArray[i * 4 + 3] = 0;
}

const error = gpuCompute.init();
if (error !== null) {
    console.error(error);
}


// --- TEXTURE ATLAS GENERATION ---
// Create a canvas with all letters A-Z, 0-9 drawn on it
const atlasSize = 512;
const canvas = document.createElement('canvas');
canvas.width = atlasSize;
canvas.height = atlasSize;
const ctx = canvas.getContext('2d');
ctx.font = 'bold 48px "Playfair Display", serif';
ctx.fillStyle = '#000000'; // Black text
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Grid 10x10 = 100 chars max
const cols = 10;
const rows = 10;
const cell = atlasSize / cols;
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?&@#";

// Store UV offsets for each particle
const uvOffsets = new Float32Array(PARTICLES * 2);

for (let i = 0; i < PARTICLES; i++) {
    const charIndex = Math.floor(Math.random() * chars.length);
    const col = charIndex % cols;
    const row = Math.floor(charIndex / cols);

    // UV coordinates (0-1)
    uvOffsets[i * 2 + 0] = col / cols;
    uvOffsets[i * 2 + 1] = 1.0 - (row / rows) - (1.0 / rows); // Flip Y?? Check later.
}

// Draw atlas
for (let i = 0; i < chars.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.fillText(chars[i], col * cell + cell / 2, row * cell + cell / 2 + 5); // +5 tweak baseline
}

const atlasTexture = new THREE.CanvasTexture(canvas);
atlasTexture.magFilter = THREE.LinearFilter;
atlasTexture.minFilter = THREE.LinearFilter;


// --- PARTICLES MESH ---
// We render InstancedMesh NOT using InstancedMesh class but raw ShaderMaterial on InstancedBufferGeometry
// because we need to read position from texture.

const geometry = new THREE.PlaneGeometry(6, 6); // Each letter size
const instancedGeometry = new THREE.InstancedBufferGeometry();
instancedGeometry.index = geometry.index;
instancedGeometry.attributes.position = geometry.attributes.position;
instancedGeometry.attributes.uv = geometry.attributes.uv;

// Add reference index to look up texture position (0 to WIDTH*WIDTH)
const references = new Float32Array(PARTICLES * 2);
for (let i = 0; i < PARTICLES; i++) {
    const x = (i % WIDTH) / WIDTH;
    const y = Math.floor(i / WIDTH) / WIDTH;
    references[i * 2] = x;
    references[i * 2 + 1] = y;
}

instancedGeometry.setAttribute('reference', new THREE.InstancedBufferAttribute(references, 2));
instancedGeometry.setAttribute('uvOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2));

const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        texturePosition: { value: null },
        textureVelocity: { value: null },
        atlas: { value: atlasTexture },
        cellSize: { value: 1.0 / cols } // For UV math
    },
    vertexShader: `
        uniform sampler2D texturePosition;
        attribute vec2 reference;
        attribute vec2 uvOffset;
        varying vec2 vUv;
        varying vec2 vUvOffset;
        
        void main() {
            vec4 pos = texture2D( texturePosition, reference );
            
            // Align to camera (Billboard)
            // Cheap billboard: just add position to vertex position?
            // Proper billboard: 
            vec4 mvPosition = modelViewMatrix * vec4( pos.xyz, 1.0 );
            
            // This billboard method keeps size constant in pixels roughly? No.
            // Standard billboard:
            mvPosition.xy += position.xy;
            
            gl_Position = projectionMatrix * mvPosition;
            
            vUv = uv;
            vUvOffset = uvOffset;
        }
    `,
    fragmentShader: `
        uniform sampler2D atlas;
        uniform float cellSize;
        varying vec2 vUv;
        varying vec2 vUvOffset;
        
        void main() {
            // Map 0-1 UV of quad to sub-cell in atlas
            vec2 atlasUV = vUvOffset + vUv * cellSize;
            
            vec4 color = texture2D( atlas, atlasUV );
            if ( color.a < 0.1 ) discard; // Alpha test
            
            // Invert colors? Atlas has black text on transparent/white.
            // If canvas is transparent, alpha is high on text.
            // Canvas fillStyle was black. So text is black (0,0,0,1).
            // Background was transparent (0,0,0,0).
            
            // So color.a is 1.0 on text.
            // We want Black text.
            gl_FragColor = vec4(0.0, 0.0, 0.0, color.a);
        }
    `,
    transparent: true,
    depthWrite: false, // Text overlaps nicely
    side: THREE.DoubleSide
});

const particles = new THREE.Mesh(instancedGeometry, particleMaterial);
scene.add(particles);


// --- INTERACTION ---
const mouse = new THREE.Vector2();
let mousePressed = 0;

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('mousedown', () => { mousePressed = 1; });
window.addEventListener('mouseup', () => { mousePressed = 0; });


// --- ANIMATION ---
const clock = new THREE.Clock(); // Unused in shader currently but good practice

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.001;

    // Update GPGPU
    velocityVariable.material.uniforms["time"].value = time;
    velocityVariable.material.uniforms["mouse"].value = mouse;
    velocityVariable.material.uniforms["mousePressed"].value = mousePressed;

    gpuCompute.compute();

    // Update Material
    particleMaterial.uniforms["texturePosition"].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    particleMaterial.uniforms["textureVelocity"].value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;

    renderer.render(scene, camera);
}

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

animate();
