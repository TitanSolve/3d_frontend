import React, { useMemo } from 'react';

export default function MiniMap({ chapters = [], cameraInfo, onSelectChapter, onClose }) {
  const width = 900;
  const height = 600;
  const padding = 80;

  const bounds = useMemo(() => {
    if (!chapters.length) return null;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of chapters) {
      if (!c?.position) continue;
      const { x, z } = c.position;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minZ) || !isFinite(maxZ)) return null;
    // Avoid zero-size ranges and add margin
    const marginX = (maxX - minX) * 0.1 || 5;
    const marginZ = (maxZ - minZ) * 0.1 || 5;
    if (minX === maxX) { minX -= 1; maxX += 1; }
    if (minZ === maxZ) { minZ -= 1; maxZ += 1; }
    return { minX: minX - marginX, maxX: maxX + marginX, minZ: minZ - marginZ, maxZ: maxZ + marginZ };
  }, [chapters]);

  const mapPos = (pos) => {
    if (!bounds || !pos) return { left: 0, top: 0 };
    const { minX, maxX, minZ, maxZ } = bounds;
    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const scale = Math.min(usableW / rangeX, usableH / rangeZ);
    // Center the content in the map
    const offsetX = (width - scale * rangeX) / 2;
    const offsetY = (height - scale * rangeZ) / 2;
    const x = offsetX + (pos.x - minX) * scale;
    const y = offsetY + (pos.z - minZ) * scale;
    return { left: x, top: y };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, pointerEvents: 'none' }}>
      {/* Rectangular map container */}
      <div style={{
        position: 'relative',
        width: width,
        height: height,
        pointerEvents: 'auto',
        background: 'rgba(15,23,42,0.14)',
        color: '#e4e5e7',
        borderRadius: '12px',
        border: 'none',
        boxShadow: '0 16px 42px rgba(15,23,42,0.35)',
        backdropFilter: 'blur(8px) saturate(140%)',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', fontWeight: 600, fontSize: 14, opacity: 0.95 }}>Mini-map</div>
        <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, fontSize: 16, background: 'transparent', color: '#e4e5e7', border: 'none', cursor: 'pointer', zIndex: 10 }}>✕</button>
        {/* Map area */}
        <div style={{ position: 'absolute', inset: padding }}>
          {/* checkpoints */}
          {chapters && chapters.map(cp => {
            if (!cp?.position) return null;
            const p = mapPos(cp.position);
            return (
              <div key={`${cp.source || 'base'}-${cp.id}`} style={{ position: 'absolute', transform: 'translate(-50%, -50%)', left: p.left, top: p.top }}>
                <button
                  title={`#${cp.id} ${cp.title}`}
                  onClick={(e) => { e.stopPropagation(); onSelectChapter && onSelectChapter(cp); }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: '2px solid rgba(255,255,255,0.9)',
                    background: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35), 0 0 0 2px rgba(0,0,0,0.25)'
                  }}
                />
                <div style={{ whiteSpace: 'nowrap', transform: 'translateY(6px) translateX(-50%)', fontSize: 12, opacity: 0.95, position: 'absolute', left: '50%', textAlign: 'center' }}>
                  {cp.title}
                </div>
              </div>
            );
          })}
          {/* Camera marker */}
          {cameraInfo?.position && bounds && (
            (() => {
              const p = mapPos(cameraInfo.position);
              return (
                <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', left: p.left, top: p.top }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: '2px solid #38bdf8',
                    background: 'rgba(56,189,248,0.25)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.35), 0 0 0 2px rgba(0,0,0,0.25)'
                  }} />
                  <div style={{ fontSize: 11, color: '#93c5fd', transform: 'translateY(6px) translateX(-50%)', position: 'absolute', left: '50%', textAlign: 'center' }}>You</div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
