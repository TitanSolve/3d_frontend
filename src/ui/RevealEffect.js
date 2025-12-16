import * as THREE from 'three';

// Simple Simplex Noise implementation
class SimplexNoise {
  constructor() {
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
                  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
                  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    this.p = [];
    for(let i=0; i<256; i++) {
      this.p[i] = Math.floor(Math.random()*256);
    }
    this.perm = [];
    for(let i=0; i<512; i++) {
      this.perm[i]=this.p[i & 255];
    }
  }
  
  dot(g, x, y, z, w) {
    return g[0]*x + g[1]*y + g[2]*z;
  }
  
  noise4D(x, y, z, w) {
    const n0 = this.dot(this.grad3[(this.perm[(Math.floor(x) & 255)] + Math.floor(y)) & 255], x - Math.floor(x), y - Math.floor(y), z - Math.floor(z), w);
    return n0 * 0.5 + 0.5;
  }
}

export function initLoadingBackground() {
  const canvas = document.getElementById('loading-background');
  if (!canvas) return null;

  const conf = {
    fov: 75,
    cameraZ: 60,
    xyCoef: 50,
    zCoef: 10,
    lightIntensity: 0.9,
    light1Color: 0x0E09DC,
    light2Color: 0x1CD1E1,
    light3Color: 0x18C02C,
    light4Color: 0xee3bcf,
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const camera = new THREE.PerspectiveCamera(conf.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = conf.cameraZ;

  const scene = new THREE.Scene();
  const simplex = new SimplexNoise();

  const mouse = new THREE.Vector2(0, 0);

  // Calculate plane size
  const vFOV = camera.fov * Math.PI / 180;
  const height = 2 * Math.tan(vFOV / 2) * Math.abs(conf.cameraZ);
  const width = height * camera.aspect;

  // Create wave plane
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(width, height, Math.floor(width / 2), Math.floor(height / 2));
  const plane = new THREE.Mesh(geo, mat);
  plane.rotation.x = -Math.PI / 2 - 0.2;
  plane.position.y = -25;
  scene.add(plane);

  // Create colored moving lights
  const r = 30;
  const y = 10;
  const lightDistance = 500;

  const light1 = new THREE.PointLight(conf.light1Color, conf.lightIntensity, lightDistance);
  light1.position.set(0, y, r);
  scene.add(light1);

  const light2 = new THREE.PointLight(conf.light2Color, conf.lightIntensity, lightDistance);
  light2.position.set(0, -y, -r);
  scene.add(light2);

  const light3 = new THREE.PointLight(conf.light3Color, conf.lightIntensity, lightDistance);
  light3.position.set(r, y, 0);
  scene.add(light3);

  const light4 = new THREE.PointLight(conf.light4Color, conf.lightIntensity, lightDistance);
  light4.position.set(-r, y, 0);
  scene.add(light4);

  // Mouse tracking
  const handleMouseMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  document.addEventListener('mousemove', handleMouseMove);

  // Animate wave plane
  function animatePlane() {
    const gArray = plane.geometry.attributes.position.array;
    const time = Date.now() * 0.0002;
    for (let i = 0; i < gArray.length; i += 3) {
      gArray[i + 2] = simplex.noise4D(
        gArray[i] / conf.xyCoef,
        gArray[i + 1] / conf.xyCoef,
        time,
        mouse.x + mouse.y
      ) * conf.zCoef;
    }
    plane.geometry.attributes.position.needsUpdate = true;
  }

  // Animate lights
  function animateLights() {
    const time = Date.now() * 0.001;
    const d = 50;
    light1.position.x = Math.sin(time * 0.1) * d;
    light1.position.z = Math.cos(time * 0.2) * d;
    light2.position.x = Math.cos(time * 0.3) * d;
    light2.position.z = Math.sin(time * 0.4) * d;
    light3.position.x = Math.sin(time * 0.5) * d;
    light3.position.z = Math.sin(time * 0.6) * d;
    light4.position.x = Math.sin(time * 0.7) * d;
    light4.position.z = Math.cos(time * 0.8) * d;
  }

  // Animation loop
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    animatePlane();
    animateLights();
    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    dispose: () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onResize);
      plane.geometry.dispose();
      plane.material.dispose();
      renderer.dispose();
    }
  };
}
