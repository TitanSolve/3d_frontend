import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import TitleIntro from './TitleIntro';
import ExhibitionHall from './ExhibitionHall';
import CheckpointModal from './CheckpointModal';
import MiniMap from './MiniMap';
// (removed duplicate useRef import)
// import { writeFile, readFile } from '../utils/fs-helpers';
import BackgroundHall from './BackgroundHall';
import chaptersData from '../../chapters.json';
import animationsData from '../../animations.json';
import './animations.css';


gsap.registerPlugin(ScrollTrigger);

// Helper to get camera info from ExhibitionHall
let getCameraInfo = null;

// Custom hook for typewriter effect
function useTypewriterEffect(text, speed = 50) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      setIsComplete(false);
      return;
    }

    setDisplayedText('');
    setIsComplete(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.substring(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayedText, isComplete };
}


export default function App() {
  // Ref to notify ExhibitionHall of checkpoint saves
  const checkpointSavedRef = useRef(null);
  // Ref to allow CheckpointModal to trigger camera movement in ExhibitionHall
  const cameraMoveRef = useRef(null);
  const mountRef = useRef(null);
  const [chapter, setChapter] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chapter1Loading, setChapter1Loading] = useState(false);
  const [chapter1Progress, setChapter1Progress] = useState(0);
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [pendingCheckpoint, setPendingCheckpoint] = useState(null);
  // Playback interval used when stepping through saved animation points (ms)
  const PLAYBACK_INTERVAL_MS = 100; // 100ms default; lower = smoother playback
  // Chapter navigation state
  const [allChapters, setAllChapters] = useState([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  // Auto touring removed
  const [nearbyCheckpoint, setNearbyCheckpoint] = useState(null); // proximity-based detection
  const [proximityDialogVisible, setProximityDialogVisible] = useState(false);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(false);
  
  // Typewriter effect for dialog content
  const titleTypewriter = useTypewriterEffect(nearbyCheckpoint?.title || '', 15);
  const commentTypewriter = useTypewriterEffect(nearbyCheckpoint?.comment || '', 10);
  // Listen for Enter key in Chapter 1 to open checkpoint modal
  useEffect(() => {
    // Load base chapters from imported JSON file and mark them
    const baseChapters = chaptersData.map(ch => ({ ...ch, source: 'base' }));
    
    // Load user-created checkpoints from localStorage
    let userCheckpoints = [];
    try {
      const stored = localStorage.getItem('userCheckpoints');
      if (stored) {
        userCheckpoints = JSON.parse(stored).map(ch => ({ ...ch, source: 'user' }));
      }
    } catch (e) {
      console.error('Failed to load user checkpoints:', e);
    }
    
    // Merge base chapters with user checkpoints
    setAllChapters([...baseChapters, ...userCheckpoints]);
    setCurrentChapterIdx(0);
  }, [showCheckpointModal]);

  useEffect(() => {
    if (chapter !== 1) return;
    function onKeyDown(e) {
      if (e.key === 'Enter' && !showCheckpointModal) {
        if (getCameraInfo) {
          setPendingCheckpoint(getCameraInfo());
          setShowCheckpointModal(true);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chapter, showCheckpointModal]);
  // Animation playback for chapter navigation
  function playAnimationBetweenChapters(fromIdx, toIdx) {
    return new Promise(resolve => {
      if (!allChapters.length) return resolve(false);
      if (isAnimating) return resolve(false);
      const from = allChapters[fromIdx];
      const to = allChapters[toIdx];
      if (!from || !to) return resolve(false);
    // Get animations from animations.json (file) first, fallback to localStorage
    let anims = Array.isArray(animationsData) ? animationsData : [];
    if (!anims.length) {
      const animsRaw = localStorage.getItem('animations.txt') || '[]';
      try { anims = JSON.parse(animsRaw); } catch { anims = []; }
    }
    // Try forward animation first
    let anim = anims.find(a => a.prevCheckpointId === from.id && a.nextCheckpointId === to.id);
    let points = null;
    if (anim && Array.isArray(anim.points) && anim.points.length) {
      points = anim.points;
    } else {
      // Try reverse animation (play it backwards)
      const rev = anims.find(a => a.prevCheckpointId === to.id && a.nextCheckpointId === from.id);
      if (rev && Array.isArray(rev.points) && rev.points.length) {
        points = rev.points.slice().reverse();
      }
    }
      if (!points) return resolve(false);

      // Animate camera using ExhibitionHall's cameraMoveRef
      let i = 0;
      setIsAnimating(true);
      function step() {
        if (i >= points.length) {
          setIsAnimating(false);
          return resolve(true);
        }
        const pt = points[i];
        if (cameraMoveRef.current) {
          cameraMoveRef.current('set', pt.position, pt.direction);
        }
          i++;
        setTimeout(step, PLAYBACK_INTERVAL_MS);
      }
      step();
    });
  }

  function handleNextChapter() {
    if (!allChapters.length || isAnimating) return;
    const nextIdx = (currentChapterIdx + 1) % allChapters.length;
    // keep existing behaviour: start anim and set idx immediately
    playAnimationBetweenChapters(currentChapterIdx, nextIdx);
    setCurrentChapterIdx(nextIdx);
  }
  function handlePrevChapter() {
    if (!allChapters.length || isAnimating) return;
    const prevIdx = (currentChapterIdx - 1 + allChapters.length) % allChapters.length;
    playAnimationBetweenChapters(currentChapterIdx, prevIdx);
    setCurrentChapterIdx(prevIdx);
  }

  // Move camera backward a fixed step (used by Prev button as a movement control)
  function handleMoveBackward() {
    if (isAnimating) return;
    if (cameraMoveRef.current) cameraMoveRef.current('backward');
  }
  function handleDownloadAnimations() {
    const data = localStorage.getItem('animations.txt') || '[]';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animations.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Auto Touring removed

  // Save checkpoint - add to chapters list and save to localStorage
  function handleCheckpointSave({ title, comment }) {
    setShowCheckpointModal(false);
    if (!pendingCheckpoint) return;
    
    // Find the highest ID in current chapters
    const lastId = allChapters.length > 0 ? Math.max(...allChapters.map(ch => ch.id)) : 0;
    const id = lastId + 1;
    
    const { position, direction } = pendingCheckpoint;
    
    // Create new checkpoint object
    const newCheckpoint = {
      id,
      title,
      comment,
      position: {
        x: parseFloat(position.x.toFixed(4)),
        y: parseFloat(position.y.toFixed(4)),
        z: parseFloat(position.z.toFixed(4))
      },
      direction: {
        x: parseFloat(direction.x.toFixed(4)),
        y: parseFloat(direction.y.toFixed(4)),
        z: parseFloat(direction.z.toFixed(4))
      }
    };
    
    // Add to current chapters
    const updatedChapters = [...allChapters, newCheckpoint];
    setAllChapters(updatedChapters);
    
    // Save only user-created checkpoints to localStorage
    let userCheckpoints = [];
    try {
      const stored = localStorage.getItem('userCheckpoints');
      if (stored) {
        userCheckpoints = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load existing user checkpoints:', e);
    }
    userCheckpoints.push(newCheckpoint);
    localStorage.setItem('userCheckpoints', JSON.stringify(userCheckpoints, null, 2));
    
    setPendingCheckpoint(null);
    
    // Notify ExhibitionHall to finalize and save animation
    if (checkpointSavedRef.current) {
      checkpointSavedRef.current(id);
    }
  }

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 5, 2);
    scene.add(dir);

    const clock = new THREE.Clock();
    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    setSceneReady(true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const handleEnter = () => {
    gsap.to('.title-intro', { duration: 0.6, opacity: 0, ease: 'power2.inOut', onComplete: () => {
      setChapter1Progress(0);
      setChapter1Loading(true);
      setChapter(1);
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        window.scrollTo(0, 0);
      }
    }});
  };

  return (
    <div className="app-root" ref={mountRef}>
      {sceneReady && chapter === 0 && <BackgroundHall onLoadComplete={() => setIsLoading(false)} />}
      {chapter === 0 && !isLoading && <TitleIntro onEnter={handleEnter} />}
      {chapter === 1 && sceneReady && (
        <>
          {chapter1Loading && (
            <div className="loading-overlay">
              <div className="loading-container">
                <img src="/assets/images/loading-logo.jfif" alt="Loading" className="loading-logo" />
                <div className="loading-text">Loading..</div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${chapter1Progress}%` }} />
                  <div className="loading-percent" style={{ right: `${100 - chapter1Progress}%` }}>{Math.round(chapter1Progress)}%</div>
                </div>
              </div>
            </div>
          )}
          <ExhibitionHall 
            onLoadComplete={() => setChapter1Loading(false)}
            onProgress={p => setChapter1Progress(p)}
            setGetCameraInfo={fn => { getCameraInfo = fn; }}
            setCameraMove={fn => { cameraMoveRef.current = fn; }}
            onCheckpointSaved={fn => { checkpointSavedRef.current = fn; }}
            allChapters={allChapters}
            onNearbyCheckpoint={(checkpoint, isVisible) => {
              setNearbyCheckpoint(checkpoint);
              // Only show proximity dialog if pause dialog is not visible
              setProximityDialogVisible(isVisible);
            }}
            onCameraInfo={(info) => setCameraInfo(info)}
          />
          {/* Mini-map launcher */}
          <button
            onClick={() => setIsMiniMapOpen(true)}
            title="Open mini-map"
            style={{ position: 'fixed', top: 12, right: 12, zIndex: 2100, borderRadius: 999, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#e4e5e7', padding: '8px 10px', backdropFilter: 'blur(6px)', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,23,42,0.28)' }}
          >
            🗺️ Mini-map
          </button>
          {/* Top-left HUD: camera position/direction and checkpoint list */}
          <div style={{ position: 'fixed', top: 10, left: 10, zIndex: 3000, pointerEvents: 'none', display: 'none' }}>
            <div style={{
              pointerEvents: 'auto',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto',
              fontSize: 12,
              lineHeight: 1.5,
              color: '#e4e5e7',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(6px) saturate(120%)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              padding: '10px 12px',
              boxShadow: '0 8px 24px rgba(15,23,42,0.18)'
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Camera</div>
              {cameraInfo ? (
                <>
                  <div>pos: x {cameraInfo.position.x.toFixed(2)}, y {cameraInfo.position.y.toFixed(2)}, z {cameraInfo.position.z.toFixed(2)}</div>
                  <div>dir: x {cameraInfo.direction.x.toFixed(3)}, y {cameraInfo.direction.y.toFixed(3)}, z {cameraInfo.direction.z.toFixed(3)}</div>
                </>
              ) : (
                <div>pos: -, dir: -</div>
              )}
              <div style={{ fontWeight: 600, marginTop: 10, marginBottom: 6 }}>Checkpoints</div>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {allChapters && allChapters.length ? allChapters.map((cp) => (
                  <div key={`${cp.source || 'base'}-${cp.id}`} style={{ opacity: 0.9 }}>
                    #{cp.id} {cp.title} — x {cp.position.x.toFixed(2)}, y {cp.position.y.toFixed(2)}, z {cp.position.z.toFixed(2)}
                  </div>
                )) : (
                  <div>no checkpoints</div>
                )}
              </div>
            </div>
          </div>
          <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000, display: 'flex', gap: 12 }}>
            <button
              onClick={handlePrevChapter}
              disabled={isAnimating}
              className="nav-button nav-button-prev"
            >
              ⟲ Prev
            </button>
            <button
              onClick={handleNextChapter}
              disabled={isAnimating}
              className="nav-button nav-button-next"
            >
              Next ⟳
            </button>
            {/* Auto Touring buttons hidden */}
            {/* Pause controls hidden */}
          </div>
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'none' }}>
            <button onClick={handleDownloadAnimations} className="nav-button nav-button-export">📥 Export</button>
          </div>
          {/* Proximity dialog (when camera is near any checkpoint) - only dialog logic now */}
          {proximityDialogVisible && nearbyCheckpoint && (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2000 }}>
              <div
                className="dialog-entrance-animation"
                style={{
                  pointerEvents: 'auto',
                  minWidth: 300,
                  maxWidth: '42%',
                  background: 'rgba(255,255,255,0.02)',
                  color: '#0f172a',
                  padding: 18,
                  borderRadius: 10,
                  backdropFilter: 'blur(3px) saturate(120%)',
                  boxShadow: '0 12px 32px rgba(15,23,42,0.22)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'left',
                  position: 'absolute',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  right: 28
                }}
              >
                <div style={{ fontSize: 18, lineHeight: 1.6, color: '#e4e5e7ff', minHeight: '1.6em' }}>
                  {titleTypewriter.displayedText}
                  {!titleTypewriter.isComplete && <span style={{ animation: 'blink 0.7s infinite' }}>|</span>}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: '#e4e5e7ff', marginTop: 8, minHeight: '3.2em' }}>
                  {commentTypewriter.displayedText}
                  {!commentTypewriter.isComplete && <span style={{ animation: 'blink 0.7s infinite' }}>|</span>}
                </div>
              </div>
            </div>
          )}
          <CheckpointModal 
            open={showCheckpointModal}
            onSubmit={handleCheckpointSave}
            onCancel={() => setShowCheckpointModal(false)}
            onMoveForward={() => cameraMoveRef.current && cameraMoveRef.current('forward')}
            onMoveBackward={() => cameraMoveRef.current && cameraMoveRef.current('backward')}
          />
          {isMiniMapOpen && (
            <MiniMap
              chapters={allChapters}
              cameraInfo={cameraInfo}
              onSelectChapter={(cp) => {
                if (cameraMoveRef.current) {
                  cameraMoveRef.current('set', cp.position, cp.direction);
                }
                setCurrentChapterIdx(allChapters.findIndex(c => c.id === cp.id) || 0);
                setIsMiniMapOpen(false);
              }}
              onClose={() => setIsMiniMapOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
