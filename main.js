import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// --- VISUAL SETUP (THREE.JS) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);
scene.fog = new THREE.Fog(0xf0f0f0, 10, 50);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);


// --- PHYSICS SETUP (CANNON.JS) ---
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

// Materials
const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.3,
    restitution: 0.7, // Bouncy
});
world.addContactMaterial(defaultContactMaterial);


// --- OBJECTS ---
const objectsToUpdate = [];

// 1. Floor
const floorGeo = new THREE.PlaneGeometry(100, 100);
const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.8
});
const floorMesh = new THREE.Mesh(floorGeo, floorMat);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

const floorBody = new CANNON.Body({
    mass: 0, // Static
    shape: new CANNON.Plane(),
});
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(floorBody);


// Helper: Create Box
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const createBox = (width, height, depth, position) => {
    // Three.js
    const mesh = new THREE.Mesh(
        boxGeo,
        new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            metalness: 0.1,
            roughness: 0.5
        })
    );
    mesh.scale.set(width, height, depth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    scene.add(mesh);

    // Cannon.js
    const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5));
    const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        shape: shape,
        material: defaultMaterial
    });
    world.addBody(body);

    objectsToUpdate.push({ mesh, body });
};

// Create initial stack
for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
        createBox(1, 1, 1, { x: (i - 2.5) * 1.1, y: 0.5 + j * 1.1, z: 0 });
    }
}


// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);


// --- INTERACTION ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Invisible plane for dragging
const dragPlane = new THREE.Plane();
const dragPlaneNormal = new THREE.Vector3(0, 0, 1); // Will be updated to face camera

let constraintBody = null;
let mouseConstraint = null;

// Dummy body for the mouse
const shape = new CANNON.Sphere(0.1);
const jointBody = new CANNON.Body({ mass: 0 });
jointBody.addShape(shape);
jointBody.collisionFilterGroup = 0;
jointBody.collisionFilterMask = 0;
world.addBody(jointBody);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Move joint body if dragging
    if (mouseConstraint) {
        raycaster.setFromCamera(mouse, camera);
        const ray = new THREE.Ray(raycaster.ray.origin, raycaster.ray.direction);

        // Find intersection with the drag plane
        const target = new THREE.Vector3();
        ray.intersectPlane(dragPlane, target);

        if (target) {
            jointBody.position.set(target.x, target.y, target.z);
            mouseConstraint.update();
        }
    }
});

window.addEventListener('mousedown', () => {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    for (const visibleMesh of intersects) {
        // Find matching physics body
        const object = objectsToUpdate.find(obj => obj.mesh === visibleMesh.object);
        if (object) {
            addMouseConstraint(object.body.position.x, object.body.position.y, object.body.position.z, object.body);

            // Update drag plane to point at camera from object pos
            dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), visibleMesh.point);
            break;
        }
    }
});

window.addEventListener('mouseup', () => {
    removeMouseConstraint();
});

function addMouseConstraint(x, y, z, body) {
    jointBody.position.set(x, y, z);
    const pivot = new CANNON.Vec3(0, 0, 0); // Local pivot
    // We actually need global pivot to local... simplified:
    // Just attach to body center for now for simplicity

    mouseConstraint = new CANNON.PointToPointConstraint(body, new CANNON.Vec3(0, 0, 0), jointBody, new CANNON.Vec3(0, 0, 0));
    world.addConstraint(mouseConstraint);
}

function removeMouseConstraint() {
    if (mouseConstraint) {
        world.removeConstraint(mouseConstraint);
        mouseConstraint = null;
    }
}


// --- ANIMATION ---
const clock = new THREE.Clock();
let oldElapsedTime = 0;

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;

    // Update Physics
    world.step(1 / 60, deltaTime, 3);

    // Update Mesh Positions
    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.body.position);
        object.mesh.quaternion.copy(object.body.quaternion);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
