import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gsap } from 'gsap';

// Hosted GLB in GitHub Release (avoids LFS limits on Pages)
const HALL_URL = 'https://github.com/TitanSolve/3d_frontend/releases/download/v1.0.0/hintze_hall.glb';

export default function ExhibitionHall({ onLoadComplete, onProgress, setGetCameraInfo, setCameraMove, onCheckpointSaved, allChapters, onNearbyCheckpoint, destinationCheckpoint, onCameraInfo }) {
  const canvasRef = useRef(null);
  const cameraRef = useRef();
  const PROXIMITY_DISTANCE = 40; // distance threshold to detect arrival at any checkpoint
  const PROXIMITY_CHECK_MS = 200; // check proximity every 0.2 seconds
  // Recording state refs so effects at top-level can access them
  const recordingRef = useRef(false);
  const animationPointsRef = useRef([]);
  const lastAnimSampleRef = useRef(0);
  // Sampling interval in milliseconds for recording animation points
  const ANIM_SAMPLE_MS = 100; // 100ms by default (0.1s) — change to smaller value for smoother recordings
  const prevCheckpointIdRef = useRef(1);
  const nextCheckpointIdRef = useRef(null);
  const animationIdRef = useRef(1);
  const suppressEulerUntilRef = useRef(0);
  const lastNearbyCheckpointIdRef = useRef(null); // Track last reported checkpoint to avoid redundant updates
  const lastProximityCheckRef = useRef(0); // Track last proximity check time

  useEffect(() => {
    // Basic scene to load GLTF from assets/hall
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0f14, 800, 4000);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 40000);
    cameraRef.current = camera;
    // Expose camera move function to parent (App)
    if (setCameraMove) {
      setCameraMove((action, pos, dir) => {
        if (action === 'forward' || action === 'backward') {
          // Move a fixed distance in the current look direction
          const moveDistance = 20;
          const moveDir = new THREE.Vector3();
          camera.getWorldDirection(moveDir);
          if (action === 'backward') moveDir.negate();
          camera.position.addScaledVector(moveDir, moveDistance);
        } else if (action === 'set' && pos && dir) {
          camera.position.set(pos.x, pos.y, pos.z);
          camera.lookAt(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
          // Sync internal yaw/pitch to match the camera's resulting rotation
          // This avoids the animate() loop overwriting the lookAt orientation.
          pitch = camera.rotation.x;
          yaw = camera.rotation.y;
          // Briefly suppress the Euler override to let the change settle
          suppressEulerUntilRef.current = performance.now() + 200;
        }
      });
    }
    // Expose camera info getter for checkpoint
    if (setGetCameraInfo) {
      setGetCameraInfo(() => () => {
        const pos = cameraRef.current.position;
        // Camera direction: get world direction
        const dir = new THREE.Vector3();
        cameraRef.current.getWorldDirection(dir);
        return {
          position: { x: pos.x, y: pos.y, z: pos.z },
          direction: { x: dir.x, y: dir.y, z: dir.z }
        };
      });
    }
    // Start at a reasonable position
    camera.position.set(25, 140, 1600);
    let velocity = new THREE.Vector3();
    // Animation recording state (stored in refs)
    // local aliases for convenience
    // Note: keep refs in outer scope so other top-level effects can access them
    // ...existing code...
    let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, moveUp = false, moveDown = false;
    let pitch = 0, yaw = 0;
    let pointerLocked = false;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Keep pixel ratio at 1 to avoid GPU/CPU overload on high-DPI displays
    renderer.setPixelRatio(1);
    // Disable expensive features
    renderer.shadowMap.enabled = false;
    renderer.sortObjects = false;
    canvasRef.current.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.6);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 5);
    scene.add(ambient, hemi, dir);

    const loader = new GLTFLoader();
    // Load GLB format
    loader.load(
      HALL_URL,
      (gltf) => {
        const root = gltf.scene;
        root.scale.set(100.0, 100.0, 100.0); // Match Chapter 0 backdrop scale
        // Apply captured rotation for consistent orientation (updated)
        root.rotation.set(-4.7, 3.15, 0);
        scene.add(root);

        // After model loads, fly the camera forward to a framed front view
        // Fly to a higher vantage while keeping a reasonable distance
        const targetPos = new THREE.Vector3(25, 140, 1600);
        gsap.to(camera.position, {
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          duration: 1.4,
          ease: 'power3.inOut',
          onUpdate: () => {
            // Keep looking slightly towards the center of the scene
            camera.lookAt(0, 2, 0);
          },
          onComplete: () => {
            if (onLoadComplete) onLoadComplete();
          }
        });
      },
      (xhr) => {
        // Progress
        if (xhr.lengthComputable && onProgress) {
          const percent = (xhr.loaded / xhr.total) * 100;
          onProgress(Math.max(0, Math.min(100, percent)));
        } else if (onProgress) {
          // Simulate progress if not computable
          onProgress(50);
        }
      },
      (err) => {
        console.error('Failed to load hall GLB:', err);
        if (onLoadComplete) onLoadComplete();
        if (onProgress) onProgress(100);
      }
    );

    const clock = new THREE.Clock();
    let raf;
    // Throttle rendering to reduce CPU/GPU usage
    const TARGET_FPS = 30;
    const MIN_FRAME_TIME = 1000 / TARGET_FPS;
    let lastRenderTime = performance.now();
    // Pause rendering when tab is hidden
    const isPausedRef = { current: false };
    function onVisibilityChange() {
      isPausedRef.current = document.hidden;
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Pre-allocated temporaries to avoid per-frame GC churn
    const _moveDir = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _euler = new THREE.Euler();

    function animate() {
      raf = requestAnimationFrame(animate);
      if (isPausedRef.current) return;
      const now = performance.now();
      if (now - lastRenderTime < MIN_FRAME_TIME) return;
      lastRenderTime = now;
      const dt = Math.min(clock.getDelta(), 0.1);
      // Flying first-person movement - always enabled for keyboard input
      let moved = false;
      // Build movement direction in camera space (reuse temp)
      _moveDir.set(0, 0, 0);
      if (moveForward) _moveDir.z -= 1;
      if (moveBackward) _moveDir.z += 1;
      if (moveLeft) _moveDir.x -= 1;
      if (moveRight) _moveDir.x += 1;
      if (moveUp) _moveDir.y += 1;
      if (moveDown) _moveDir.y -= 1;
      if (_moveDir.lengthSq() > 0) {
        _moveDir.normalize();
        // Move in the direction the camera is facing (including up/down)
        _euler.set(pitch, yaw, 0, 'YXZ');
        _moveDir.applyEuler(_euler);
        const speed = 250 * dt;
        camera.position.addScaledVector(_moveDir, speed);
        moved = true;
      }
      // Check proximity to ALL checkpoints every 0.2 seconds in real-time
      const nowMs = performance.now();
      if (nowMs - lastProximityCheckRef.current >= PROXIMITY_CHECK_MS) {
        lastProximityCheckRef.current = nowMs;
        
        if (onNearbyCheckpoint && allChapters && allChapters.length > 0) {
          const camPos = camera.position;
          let nearestCheckpoint = null;
          let nearestDist = PROXIMITY_DISTANCE;
          
          // Find the nearest checkpoint within proximity distance
          for (let i = 0; i < allChapters.length; i++) {
            const cp = allChapters[i];
            if (!cp.position) continue;
            
            const dx = camPos.x - cp.position.x;
            const dy = camPos.y - cp.position.y;
            const dz = camPos.z - cp.position.z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestCheckpoint = cp;
            }
          }
          
          // Report the nearest checkpoint with visibility flag directly
          const newId = nearestCheckpoint ? nearestCheckpoint.id : null;
          if (newId !== lastNearbyCheckpointIdRef.current) {
            lastNearbyCheckpointIdRef.current = newId;
            // Pass both checkpoint and visibility boolean
            onNearbyCheckpoint(nearestCheckpoint, nearestCheckpoint ? true : false);
          }
        }
      }
      // Animation recording: sample every 0.2s if moving or direction changed
      if (recordingRef.current) {
        const now = performance.now();
        if (now - lastAnimSampleRef.current > ANIM_SAMPLE_MS) {
          lastAnimSampleRef.current = now;
          // Save camera position and direction (avoid clone)
          const pos = camera.position;
          camera.getWorldDirection(_dir);
          // Only store position and direction — timestamp is not persisted
          animationPointsRef.current.push({
            position: { x: pos.x, y: pos.y, z: pos.z },
            direction: { x: _dir.x, y: _dir.y, z: _dir.z }
          });
        }
      }
      // Apply look (reuse euler) — only when pointer locked or not suppressed by external set()
      const nowMsLook = performance.now();
      if (pointerLocked || nowMsLook > suppressEulerUntilRef.current) {
        _euler.set(pitch, yaw, 0, 'YXZ');
        camera.rotation.copy(_euler);
      }
      // Report camera info to parent if requested
      if (onCameraInfo) {
        const pos = camera.position;
        camera.getWorldDirection(_dir);
        onCameraInfo({
          position: { x: pos.x, y: pos.y, z: pos.z },
          direction: { x: _dir.x, y: _dir.y, z: _dir.z }
        });
      }
      renderer.render(scene, camera);
    }
    animate();

    // Listen for checkpoint save event by calling the setter provided by App
    if (onCheckpointSaved) {
      onCheckpointSaved((newCheckpointId) => {
        // Finalize and save animation if recording
        if (recordingRef.current && animationPointsRef.current.length > 1) {
          nextCheckpointIdRef.current = newCheckpointId;
          // Get animation list from localStorage
          let anims = [];
          try { anims = JSON.parse(localStorage.getItem('animations.txt') || '[]'); } catch { anims = []; }
          // Assign unique animationId
          const maxId = anims.reduce((max, a) => Math.max(max, a.animationId || 0), 0);
          animationIdRef.current = maxId + 1;
          anims.push({
            animationId: animationIdRef.current,
            prevCheckpointId: prevCheckpointIdRef.current,
            nextCheckpointId: nextCheckpointIdRef.current,
            points: animationPointsRef.current
          });
          localStorage.setItem('animations.txt', JSON.stringify(anims));
          // Prepare for next animation
          prevCheckpointIdRef.current = newCheckpointId;
          animationPointsRef.current = [];
        }
        // Start new recording
        recordingRef.current = true;
        lastAnimSampleRef.current = performance.now();
      });
    }

    // Pointer lock for mouse look
    function onPointerDown() {
      if (!pointerLocked) {
        renderer.domElement.requestPointerLock();
      }
    }
    function onPointerLockChange() {
      pointerLocked = document.pointerLockElement === renderer.domElement;
    }
    function onMouseMove(e) {
      if (!pointerLocked) return;
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;
      yaw -= movementX * 0.002;
      pitch -= movementY * 0.002;
      pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
    }
    function onKeyDown(e) {
      switch (e.code) {
        case 'ArrowUp': moveForward = true; break;
        case 'ArrowDown': moveBackward = true; break;
        case 'ArrowLeft': moveLeft = true; break;
        case 'ArrowRight': moveRight = true; break;
        case 'PageUp': moveUp = true; break;
        case 'PageDown': moveDown = true; break;
      }
    }
    function onKeyUp(e) {
      switch (e.code) {
        case 'ArrowUp': moveForward = false; break;
        case 'ArrowDown': moveBackward = false; break;
        case 'ArrowLeft': moveLeft = false; break;
        case 'ArrowRight': moveRight = false; break;
        case 'PageUp': moveUp = false; break;
        case 'PageDown': moveDown = false; break;
      }
    }
    renderer.domElement.addEventListener('click', onPointerDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('click', onPointerDown);
      renderer.dispose();
      canvasRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="exhibition-canvas" ref={canvasRef} />;
}
