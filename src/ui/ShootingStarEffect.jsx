import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ShootingStarEffect: overlays a canvas and draws shooting stars on mouse move
export default function ShootingStarEffect() {
  const mountRef = useRef(null);
  const starSystem = useRef();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // transparent
    mountRef.current.appendChild(renderer.domElement);

    // Star geometry
    const starCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const velocities = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = Math.random() * 10 - 5;
      positions[i * 3 + 1] = Math.random() * 10 - 5;
      positions[i * 3 + 2] = Math.random() * -5;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    starSystem.current = { geometry, velocities, starCount };

    let animationId;
    function animate() {
      animationId = requestAnimationFrame(animate);
      // Animate stars
      for (let i = 0; i < starCount; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];
        // Fade out and reset
        velocities[i * 3] *= 0.98;
        velocities[i * 3 + 1] *= 0.98;
        velocities[i * 3 + 2] *= 0.98;
        if (Math.abs(velocities[i * 3]) < 0.001 && Math.abs(velocities[i * 3 + 1]) < 0.001) {
          positions[i * 3] = Math.random() * 10 - 5;
          positions[i * 3 + 1] = Math.random() * 10 - 5;
          positions[i * 3 + 2] = Math.random() * -5;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
    animate();

    function handleMouseMove(e) {
      // Convert mouse to NDC
      const x = (e.clientX / width) * 2 - 1;
      const y = -(e.clientY / height) * 2 + 1;
      // Find a star to shoot
      for (let i = 0; i < starCount; i++) {
        if (Math.abs(velocities[i * 3]) < 0.001 && Math.abs(velocities[i * 3 + 1]) < 0.001) {
          positions[i * 3] = x * 5;
          positions[i * 3 + 1] = y * 5;
          positions[i * 3 + 2] = 0;
          velocities[i * 3] = (Math.random() - 0.5) * 0.2;
          velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
          velocities[i * 3 + 2] = -0.05 - Math.random() * 0.1;
          break;
        }
      }
    }
    window.addEventListener('mousemove', handleMouseMove);

    function onResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }} />;
}
