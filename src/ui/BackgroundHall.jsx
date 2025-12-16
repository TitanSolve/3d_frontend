import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default function BackgroundHall({ onLoadComplete }) {
  const mountRef = useRef(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0f14, 800, 4000);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);
    // Move the camera much higher while keeping distance
    camera.position.set(25, 140, 1600);
    let targetRotation = { x: 0, y: 0 };
    let currentRotation = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    const initialPosition = new THREE.Vector3(25, 140, 1600);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'background-hall-canvas';
    mountRef.current.appendChild(renderer.domElement);

    // Softer lighting to create atmospheric background
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    const hemi = new THREE.HemisphereLight(0x8899aa, 0x101520, 0.35);
    const dir = new THREE.DirectionalLight(0xffffff, 0.35);
    dir.position.set(8, 15, 10);
    scene.add(ambient, hemi, dir);

    // Simulate progress if server doesn't send Content-Length
    let simulatedProgress = 0;
    const progressInterval = setInterval(() => {
      if (!isLoaded && simulatedProgress < 90) {
        simulatedProgress += Math.random() * 15;
        if (simulatedProgress > 90) simulatedProgress = 90;
        setLoadProgress(simulatedProgress);
      }
    }, 200);

    const loader = new GLTFLoader();
    loader.load(
      '/assets/hall/hintze_hall.glb',
      (gltf) => {
        clearInterval(progressInterval);
        setLoadProgress(100);
        
        const root = gltf.scene;
        // Make the hall extremely large for Chapter 0 backdrop
        // 100x bigger than the previous 0.20 -> 20.0, but to ensure huge presence use 100.0
        root.scale.set(100.0, 100.0, 100.0);
        // Apply captured rotation values (updated)
        root.rotation.set(-4.7, 3.15, 0);
        root.position.set(0, 0, 0);
        scene.add(root);
        
        // Trigger fade out animation
        setTimeout(() => {
          setIsFadingOut(true);
          // Remove component after animation completes
          setTimeout(() => {
            setIsLoaded(true);
            onLoadComplete?.();
          }, 2000);
        }, 300);
      },
      (xhr) => {
        // Use real progress if available
        if (xhr.lengthComputable) {
          clearInterval(progressInterval);
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          setLoadProgress(percentComplete);
        }
      },
      (error) => {
        clearInterval(progressInterval);
        console.error('Failed to load hall model:', error);
      }
    );

    const clock = new THREE.Clock();
    let raf;
    // Reuse temporaries to avoid GC churn
    const _lookDir = new THREE.Vector3(0, 0, -1);
    const _axisX = new THREE.Vector3(1, 0, 0);
    const _axisY = new THREE.Vector3(0, 1, 0);

    function animate() {
      raf = requestAnimationFrame(animate);
      // Velocity-based smooth interpolation
      const stiffness = 0.18; // springiness
      const damping = 0.12;   // friction
      // X axis
      let dx = targetRotation.x - currentRotation.x;
      rotationVelocity.x += dx * stiffness;
      rotationVelocity.x *= (1 - damping);
      currentRotation.x += rotationVelocity.x;
      // Y axis
      let dy = targetRotation.y - currentRotation.y;
      rotationVelocity.y += dy * stiffness;
      rotationVelocity.y *= (1 - damping);
      currentRotation.y += rotationVelocity.y;
      // Clamp both axes to ±20° (π/9 radians)
      const maxAngle = Math.PI / 9;
      currentRotation.x = Math.max(-maxAngle, Math.min(maxAngle, currentRotation.x));
      currentRotation.y = Math.max(-maxAngle, Math.min(maxAngle, currentRotation.y));
      // Camera stays in place, only rotates look direction
      camera.position.copy(initialPosition);
      // Calculate look direction (reuse vector)
      _lookDir.set(0, 0, -1);
      _lookDir.applyAxisAngle(_axisX, currentRotation.y);
      _lookDir.applyAxisAngle(_axisY, currentRotation.x);
      const targetLook = initialPosition.clone().add(_lookDir);
      camera.lookAt(targetLook);
      renderer.render(scene, camera);
    }
    animate();

    // Camera rotation via mousemove disabled for chapter 0 (static background)
    // If rotation is desired in future, re-enable by attaching a mousemove listener

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      // mousemove listener intentionally not attached
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <div ref={mountRef} className="background-hall" />
      {!isLoaded && (
          <div className={`loading-overlay ${isFadingOut ? 'fade-out' : ''}`}>
            <div className="loading-container">
              <img src="/assets/images/loading-logo.jfif" alt="Loading" className="loading-logo" />
              <div className="loading-text">Loading..</div>
              <div className="progress-bar-wrapper">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${loadProgress}%` }}
                />
                <div 
                  className="loading-percent"
                  style={{ right: `${100 - loadProgress}%` }}
                >
                  {Math.round(loadProgress)}%
                </div>
              </div>
            </div>
          </div>
      )}
    </>
  );
}
