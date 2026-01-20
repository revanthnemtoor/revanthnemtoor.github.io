import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2.5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 5;


// --- SHADER CODE ---
// Simplex Noise 3D - by Ian McEwan, Ashima Arts.
const noiseChunk = `
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
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

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
`;


// --- PLANET MESH ---
const planetGeometry = new THREE.SphereGeometry(1, 128, 128); // High detail
const planetMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float time;
        uniform vec3 sunDirection;

        ${noiseChunk}

        void main() {
            // Normalize inputs
            vec3 norm = normalize(vNormal);
            vec3 sunDir = normalize(sunDirection);

            // Generate Terrain Noise (FBM - Fractal Brownian Motion)
            float noise = 0.0;
            float amp = 0.5;
            float freq = 2.0;
            for(int i = 0; i < 5; i++) {
                noise += snoise(vPosition * freq + time * 0.01) * amp;
                amp *= 0.5;
                freq *= 2.0;
            }
            
            // Define Colors
            vec3 waterColorDeep = vec3(0.0, 0.05, 0.2);
            vec3 waterColorShallow = vec3(0.0, 0.2, 0.5);
            vec3 sandColor = vec3(0.76, 0.7, 0.5);
            vec3 grassColor = vec3(0.1, 0.5, 0.1);
            vec3 rockColor = vec3(0.3, 0.3, 0.3);
            vec3 snowColor = vec3(1.0, 1.0, 1.0);

            vec3 color = vec3(0.0);
            float roughness = 1.0;

            // Biome logic based on noise height
            if(noise < -0.05) {
                // Ocean
                color = mix(waterColorDeep, waterColorShallow, (noise + 0.5) * 2.0);
                roughness = 0.2; // Shiny water
            } else if(noise < 0.0) {
                // Beach
                color = sandColor;
            } else if(noise < 0.2) {
                // Forest
                color = grassColor;
            } else if(noise < 0.35) {
                // Mountain
                color = rockColor;
            } else {
                // Snow
                color = snowColor;
            }

            // Lighting (Lambert + Specular)
            float diff = max(dot(norm, sunDir), 0.0);
            
            // Ocean Specular
            float specular = 0.0;
            if(noise < -0.05) {
                vec3 viewDir = normalize(-vPosition); // Simplified view dir
                vec3 reflectDir = reflect(-sunDir, norm);
                specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            }

            // Day/Night Cycle side
            vec3 dayColor = color * diff + vec3(specular);
            
            // City Lights on dark side (Night)
            // Only on land (noise > -0.05)
            vec3 nightLights = vec3(0.0);
            if(noise > -0.05 && diff < 0.2) {
                float lightNoise = snoise(vPosition * 20.0); // High freq noise for cities
                if(lightNoise > 0.6) {
                    nightLights = vec3(1.0, 0.8, 0.4) * (1.0 - diff * 5.0); // Ease out light at dusk
                }
            }

            vec3 finalColor = dayColor + nightLights;
            
            // Atmosphere rim on planet surface
            float fresnel = pow(1.0 - dot(norm, vec3(0,0,1)), 3.0) * 0.5;
            finalColor += vec3(0.0, 0.3, 0.6) * fresnel;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `,
    uniforms: {
        time: { value: 0 },
        sunDirection: { value: new THREE.Vector3(1.0, 0.5, 1.0) }
    }
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
scene.add(planet);


// --- ATMOSPHERE GLOW ---
const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        void main() {
            float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
            gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity * 1.5;
        }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true
});

const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 64), atmosphereMaterial);
scene.add(atmosphere);


// --- STARS (Background) ---
const starsGeometry = new THREE.BufferGeometry();
const starsCount = 5000;
const starsPos = new Float32Array(starsCount * 3);

for (let i = 0; i < starsCount * 3; i++) {
    starsPos[i] = (Math.random() - 0.5) * 100;
}

starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);


// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate Planet
    planet.rotation.y = elapsedTime * 0.05;

    // Update Shader Time
    planetMaterial.uniforms.time.value = elapsedTime;

    // Update Coordinates UI
    const randCoord1 = (Math.random() * 100).toFixed(2);
    const randCoord2 = (Math.random() * 100).toFixed(2);
    if (Math.random() > 0.9) {
        document.getElementById('coords').innerText = `${randCoord1} | ${randCoord2}`;
    }

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
