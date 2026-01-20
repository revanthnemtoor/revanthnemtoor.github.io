import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- CONFIGURATION ---
const CONFIG = {
    bgColor: 0x050505,
    coreColor: 0xff0055,
    cubeColor: 0x00aaff,
    textColor: 0xffffff,
    gravity: 0,
    damping: 0.1,
    bloomStrength: 1.5,
    bloomRadius: 0.5,
    bloomThreshold: 0.2,
    coreThreshold: 4 // Distance to trigger
};

// --- GLOBAL STATE ---
const state = {
    activeSection: null, // 'ABOUT', 'WORK', 'CONTACT'
    isDragging: false,
    font: null
};

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.bgColor);
scene.fog = new THREE.FogExp2(CONFIG.bgColor, 0.02);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 25);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.CineonToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- PHYSICS SETUP ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.1,
    restitution: 0.5,
});
world.addContactMaterial(defaultContactMaterial);

// --- ASSETS ---
const fontLoader = new FontLoader();
fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
    state.font = font;
});

// --- OBJECTS ---
let meshes = []; // Visual meshes
let bodies = []; // Physics bodies
let objectsToUpdate = []; // Sync list

// CORE
const coreGeometry = new THREE.IcosahedronGeometry(2, 4);
const coreMaterial = new THREE.MeshBasicMaterial({
    color: CONFIG.coreColor,
    wireframe: true,
    transparent: true,
    opacity: 0.3
});
const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
scene.add(coreMesh);

const coreGlowGeo = new THREE.IcosahedronGeometry(1.5, 2);
const coreGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const coreGlowMesh = new THREE.Mesh(coreGlowGeo, coreGlowMat);
coreMesh.add(coreGlowMesh);

// CUBES FACTORY
const boxGeo = new THREE.BoxGeometry(2, 2, 2);

function createDataCube(x, y, z, label) {
    const mat = new THREE.MeshLambertMaterial({
        color: CONFIG.cubeColor,
        emissive: 0x0044aa,
        emissiveIntensity: 0.5
    });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    const body = new CANNON.Body({
        mass: 5,
        position: new CANNON.Vec3(x, y, z),
        shape: shape,
        material: defaultMaterial,
        linearDamping: 0.5,
        angularDamping: 0.5
    });

    // Random Spin
    body.angularVelocity.set(Math.random(), Math.random(), Math.random());
    world.addBody(body);

    const object = { mesh, body, label, type: 'cube' };
    objectsToUpdate.push(object);
    meshes.push(mesh);
    bodies.push(body);

    addLabelToMesh(mesh, label);
    return object;
}

function addLabelToMesh(parentMesh, text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;

    ctx.font = 'Bold 80px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });

    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.z = 1.01;
    parentMesh.add(labelMesh);

    const labelMeshBack = labelMesh.clone();
    labelMeshBack.rotation.y = Math.PI;
    labelMeshBack.position.z = -1.01;
    parentMesh.add(labelMeshBack);
}

// Spawn Initial Cubes
function spawnCubes() {
    createDataCube(-6, 3, 0, "ABOUT");
    createDataCube(6, -2, 2, "WORK");
    createDataCube(0, 6, -2, "CONTACT");
}
spawnCubes();

// --- INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const planeIntersectPoint = new THREE.Vector3();
let mouseConstraint = null;

const mouseBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    position: new CANNON.Vec3(0, 0, 0),
    shape: new CANNON.Sphere(0.1)
});
world.addBody(mouseBody);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (state.isDragging && mouseConstraint) {
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(dragPlane, planeIntersectPoint);
        mouseBody.position.set(planeIntersectPoint.x, planeIntersectPoint.y, planeIntersectPoint.z);
    }
});

window.addEventListener('mousedown', (e) => {
    // Check if we hit a "Back" button (not physics based usually)
    raycaster.setFromCamera(mouse, camera);
    const textHits = raycaster.intersectObjects(scene.children.filter(o => o.userData.isBackButton));
    if (textHits.length > 0) {
        resetExperience();
        return;
    }

    // Physics Drag
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
        const hit = hits[0];
        const object = objectsToUpdate.find(obj => obj.mesh === hit.object || obj.mesh === hit.object.parent);
        
        if (object && object.type === 'cube') {
            document.body.style.cursor = 'grabbing';
            state.isDragging = true;
            
            // Setup Drag Plane facing camera
            dragPlane.setFromNormalAndCoplanarPoint(
                camera.getWorldDirection(new THREE.Vector3()),
                hit.point
            );

            mouseBody.position.copy(hit.point);
            
            // Constraint
            const localPivot = new CANNON.Vec3(
                hit.point.x - object.body.position.x,
                hit.point.y - object.body.position.y,
                hit.point.z - object.body.position.z
            );
            
            mouseConstraint = new CANNON.PointToPointConstraint(mouseBody, new CANNON.Vec3(0,0,0), object.body, localPivot);
            world.addConstraint(mouseConstraint);
        }
    }
});

window.addEventListener('mouseup', () => {
    document.body.style.cursor = 'grab';
    state.isDragging = false;
    if (mouseConstraint) {
        world.removeConstraint(mouseConstraint);
        mouseConstraint = null;
    }
});

// --- LOGIC: Collision & Reveal ---
function checkCollisions() {
    if (state.activeSection) return; // Already active

    for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
        const obj = objectsToUpdate[i];
        if (obj.type !== 'cube') continue;

        const distance = obj.body.position.distanceTo(new CANNON.Vec3(0, 0, 0));
        
        // VISUAL FEEDBACK: Core glow increases as object gets closer
        if (distance < 8) {
             coreGlowMesh.scale.setScalar(1 + (8-distance)*0.1);
        }

        // TRIGGER
        if (distance < CONFIG.coreThreshold) {
            triggerSection(obj);
            return; // Stop checking collisions as state has changed
        }
    }
}

function triggerSection(object) {
    state.activeSection = object.label;
    const explosionPos = object.body.position.clone();

    // 1. Remove All Cubes
    objectsToUpdate.forEach(obj => {
        if (obj.mesh) scene.remove(obj.mesh);
        if (obj.body) world.removeBody(obj.body);
    });
    objectsToUpdate = [];
    meshes = [];

    // 2. Explosion Effect
    createExplosion(explosionPos);

    // 3. Spawn Content
    setTimeout(() => {
        spawnContent(object.label);
    }, 500);
}

function createExplosion(pos) {
    const particleCount = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for(let i=0; i<particleCount; i++) {
        positions[i*3] = pos.x + (Math.random()-0.5)*2;
        positions[i*3+1] = pos.y + (Math.random()-0.5)*2;
        positions[i*3+2] = pos.z + (Math.random()-0.5)*2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: CONFIG.cubeColor, size: 0.2, transparent: true });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animate removal
    const tl = { t: 0 };
    // Simple animation loop handler for particles could be added, but for now let's just fade them out in loop
    particles.userData = { life: 1.0, velocity: [] };
    for(let i=0; i<particleCount; i++) {
        particles.userData.velocity.push(
            new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).multiplyScalar(0.5)
        );
    }
    objectsToUpdate.push({ type: 'particles', mesh: particles });
}

function spawnContent(section) {
    if (!state.font) return;

    let textStr = "";
    if (section === "ABOUT") textStr = "REVANTH NEMTOOR\nVisual Engineer\nCreative Dev";
    if (section === "WORK") textStr = "PROJECT ALPHA\nPROJECT BETA\nPROJECT GAMMA";
    if (section === "CONTACT") textStr = "HELLO@NEMTOOR.COM\n@REVANTH_DEV";

    const textGeo = new TextGeometry(textStr, {
        font: state.font,
        size: 1,
        height: 0.2,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.02,
        bevelOffset: 0,
        bevelSegments: 5
    });

    textGeo.center();
    const textMat = new THREE.MeshNormalMaterial(); // Iridescent look
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.position.set(0, 0, 0);
    scene.add(textMesh);

    // Add "RESET" Orb
    const resetGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const resetMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const resetMesh = new THREE.Mesh(resetGeo, resetMat);
    resetMesh.position.set(0, -5, 0);
    resetMesh.userData = { isBackButton: true };
    scene.add(resetMesh);

    addLabelToMesh(resetMesh, "RESET");

    objectsToUpdate.push({ type: 'static', mesh: textMesh });
    objectsToUpdate.push({ type: 'static', mesh: resetMesh });
}

function resetExperience() {
    state.activeSection = null;

    // Clear Scene
    objectsToUpdate.forEach(obj => {
        if(obj.mesh) scene.remove(obj.mesh);
        if(obj.body) world.removeBody(obj.body);
    });
    objectsToUpdate = [];
    meshes = [];

    // Respawn
    spawnCubes();
}


// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 2);
pointLight.position.set(10, 10, 10);
scene.add(pointLight);
const coreLight = new THREE.PointLight(CONFIG.coreColor, 5, 20);
coreMesh.add(coreLight);

// --- POST PROCESSING ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.strength = CONFIG.bloomStrength;
bloomPass.radius = CONFIG.bloomRadius;
bloomPass.threshold = CONFIG.bloomThreshold;
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- LOOP ---
const clock = new THREE.Clock();
let oldElapsedTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    world.step(1 / 60, deltaTime, 3);

    checkCollisions();

    // Update Objects
    for (let i = objectsToUpdate.length - 1; i >= 0; i--) {
        const obj = objectsToUpdate[i];

        if (obj.type === 'cube') {
            obj.mesh.position.copy(obj.body.position);
            obj.mesh.quaternion.copy(obj.body.quaternion);

            // Gentle float if not dragged
            // obj.body.applyForce(new CANNON.Vec3(0, Math.sin(elapsedTime)*0.1, 0), obj.body.position);
        }
        else if (obj.type === 'particles') {
            // Particle Animation
            const positions = obj.mesh.geometry.attributes.position.array;
            for(let j=0; j < positions.length/3; j++) {
                positions[j*3] += obj.mesh.userData.velocity[j].x;
                positions[j*3+1] += obj.mesh.userData.velocity[j].y;
                positions[j*3+2] += obj.mesh.userData.velocity[j].z;
            }
            obj.mesh.geometry.attributes.position.needsUpdate = true;
            obj.mesh.userData.life -= 0.02;
            obj.mesh.material.opacity = obj.mesh.userData.life;
            if(obj.mesh.userData.life <= 0) {
                scene.remove(obj.mesh);
                objectsToUpdate.splice(i, 1);
            }
        }
        else if (obj.type === 'static') {
            obj.mesh.rotation.y = Math.sin(elapsedTime * 0.5) * 0.1;
        }
    }

    // Core Animation
    coreMesh.rotation.y += 0.01;
    coreMesh.rotation.z += 0.005;
    if (!state.activeSection) {
        const pulse = 1 + Math.sin(elapsedTime * 2) * 0.1;
        coreMesh.scale.set(pulse, pulse, pulse);
    } else {
        coreMesh.scale.setScalar(0.1); // Shrink core when reading
    }

    composer.render();
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
