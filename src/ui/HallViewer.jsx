import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default function HallViewer() {
  const mountRef = useRef(null);
  const modelRef = useRef(null);
  // Seed with captured rotation values (updated)
  const rotationRef = useRef({ x: -4.7, y: 3.15, z: 0 });
  const isPointerDown = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 20000);
    // Move higher for inspection of the large model
    camera.position.set(10, 30, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'viewer-canvas';
    mountRef.current.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(6, 10, 6);
    scene.add(ambient, dir);

    const loader = new GLTFLoader();
    loader.load('/assets/hall/hintze_hall.glb', (gltf) => {
      const root = gltf.scene;
      root.scale.set(8.0, 8.0, 8.0);
      root.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z);
      scene.add(root);
      modelRef.current = root;
    });

    const clock = new THREE.Clock();
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const onPointerDown = (e) => {
      isPointerDown.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      isPointerDown.current = false;
    };
    const onPointerMove = (e) => {
      if (!isPointerDown.current || !modelRef.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      // Map mouse movement to rotation deltas
      const rotSpeed = 0.005;
      rotationRef.current.y += dx * rotSpeed; // yaw
      rotationRef.current.x += dy * rotSpeed; // pitch
      modelRef.current.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);

    const saveRotation = () => {
      const { x, y, z } = rotationRef.current;
      const content = `x=${x.toFixed(6)}\ny=${y.toFixed(6)}\nz=${z.toFixed(6)}\n`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rotate.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    const btn = document.createElement('button');
    btn.textContent = 'Save Rotation';
    btn.className = 'save-rotation-btn';
    btn.style.position = 'absolute';
    btn.style.right = '20px';
    btn.style.bottom = '20px';
    btn.style.zIndex = '5';
    btn.addEventListener('click', saveRotation);
    mountRef.current.appendChild(btn);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
      mountRef.current?.removeChild(btn);
    };
  }, []);

  return <div ref={mountRef} className="hall-viewer" />;
}
