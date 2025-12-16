# Immersive Cinematic UI

Development server

```bash
npm install
npm start
```

Assets
- GLTF models served from `/assets` via webpack-dev-server static config.
- Example path used: `/assets/hall/hintze_hall_gltf/scene.gltf`.

Notes
- Chapter 0 title overlay fades out to Chapter 1.
- Three.js GLTFLoader loads scene with ambient/hemi/directional lights and a small scale.
- Future steps: ScrollTrigger timeline, navigation UI, mini-map modal, raycast interactions.
