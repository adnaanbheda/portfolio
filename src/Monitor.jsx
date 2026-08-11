import { Html, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, useMemo, useRef } from "react";
import { Euler, Quaternion, Vector3 } from "three";

// drei's <Html transform> converts CSS px to world units with a fixed factor of
// 40 (see getObjectCSSMatrix: 1 / ((distanceFactor || 10) / 400)). Using it
// exactly means `scale` maps pixelWidth 1:1 onto the target world width.
const HTML_TRANSFORM_FACTOR = 40;

// The `screen` node in monitor.glb is the whole front panel (its X extent is
// identical to the body mesh's), so the raw bounding box includes the bezels.
// These trim it down to the glass; tune visually if the model is swapped.
const ACTIVE_AREA_WIDTH = 0.97;
const ACTIVE_AREA_HEIGHT = 0.92;
// The chin is taller than the top bezel, so the glass centre sits above the
// panel centre. Fraction of panel height to lift the content by.
const ACTIVE_AREA_Y_OFFSET = 0.015;

// Reused scratch objects for the per-frame facing check (avoid per-frame allocs).
const scratchQuat = new Quaternion();
const scratchLocalQuat = new Quaternion();
const scratchEuler = new Euler();
const scratchNormal = new Vector3();
const scratchPos = new Vector3();
const scratchToCamera = new Vector3();

const Monitor = forwardRef(({ iframeSrc, ...props }, ref) => {
  const { nodes, materials } = useGLTF("/monitor.glb");
  const iframeRef = useRef(null);
  const screenMeshRef = useRef(null);
  const wasFacingCamera = useRef(true);
  const canvasWidth = useThree((state) => state.size.width);

  const src = iframeSrc || 'https://open.spotify.com/embed/playlist/37i9dQZEVXcZb9ak6F5ysH?utm_source=generator'

  // Calculate sizing based on the screen's geometry
  const scalingData = useMemo(() => {
    const screenNode = nodes.screen;
    if (!screenNode || !screenNode.geometry) {
        return { 
            scale: 0.1, 
            pixelWidth: 1440, 
            pixelHeight: 800, 
            position: [0,0,0], 
            rotation: [0,0,0],
            visualWidth: 1,
            visualHeight: 1
        };
    }

    const geometry = screenNode.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    
    // Geometry dimensions
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;
    const depth = box.max.z - box.min.z;
    
    // Geometry Center
    const centerX = (box.min.x + box.max.x) / 2;
    const centerY = (box.min.y + box.max.y) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;

    // Detect if geometry is flat on XZ plane (common in some exports). When it
    // is, the panel's vertical axis is Z and the plane has to be stood upright.
    const isFlat = height < 0.01;
    const logicalHeight = isFlat ? depth : height;

    // Trim the bezels off the raw panel box so the iframe only covers glass.
    const visualWidth = width * ACTIVE_AREA_WIDTH;
    const visualHeight = logicalHeight * ACTIVE_AREA_HEIGHT;
    const yShift = logicalHeight * ACTIVE_AREA_Y_OFFSET;

    const rotation = isFlat ? [Math.PI / 2, Math.PI, 0] : [0, 0, 0];
    const position = isFlat
        ? [centerX, centerY + 0.05, centerZ + yShift]
        : [centerX, centerY + yShift, centerZ + 0.02];

    const pixelWidth = canvasWidth < 1080 ? 720 : 1080;
    const scale = (visualWidth / pixelWidth) * HTML_TRANSFORM_FACTOR;

    return {
        scale,
        pixelWidth,
        pixelHeight: Math.round((pixelWidth * visualHeight) / visualWidth),
        position,
        rotation,
        visualWidth,
        visualHeight
    };
  }, [nodes, canvasWidth]);

  // WebKit doesn't reliably honour CSS backface-visibility on a composited
  // iframe inside a 3D-transformed ancestor (same class of bug as the
  // Html-clip workaround above), so the screen stays visible through the
  // monitor case when orbiting behind it. Compute facing manually instead
  // and toggle the DOM node directly (no React re-render).
  useFrame((state) => {
    const mesh = screenMeshRef.current;
    const wrapper = iframeRef.current?.parentElement;
    if (!mesh || !wrapper) return;

    const worldQuat = mesh.getWorldQuaternion(scratchQuat);
    const localQuat = scratchLocalQuat.setFromEuler(scratchEuler.set(...scalingData.rotation));
    const normal = scratchNormal.set(0, 0, 1).applyQuaternion(worldQuat.multiply(localQuat));

    const worldPos = mesh.localToWorld(scratchPos.set(...scalingData.position));
    const toCamera = scratchToCamera.copy(state.camera.position).sub(worldPos);

    const facingCamera = normal.dot(toCamera) > 0;
    if (facingCamera !== wasFacingCamera.current) {
      wrapper.style.visibility = facingCamera ? "visible" : "hidden";
      wasFacingCamera.current = facingCamera;
    }
  });

  const handleCanPlay = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage({ action: 'play' }, '*');
      } catch (e) {}
    }
  };

  return (
    <group {...props} dispose={null} ref={ref}>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={0.333}>
        <group rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <group position={[0.001, 51.2, 0.581]} rotation={[-Math.PI / 2, 0, 0]} scale={12.898}>
            <mesh ref={screenMeshRef} geometry={nodes.screen.geometry} material={materials['Material.001']}>
              <Html
                  transform
                  scale={scalingData.scale}
                  position={scalingData.position}
                  rotation={scalingData.rotation}
                  style={{
                      width: scalingData.pixelWidth,
                      height: scalingData.pixelHeight,
                      position: 'relative',
                      overflow: 'hidden',
                      // WebKit ignores overflow:hidden for a composited child
                      // (the iframe, promoted by mixBlendMode) inside a 3D
                      // transformed ancestor. A mask forces the clip to apply.
                      WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                      isolation: 'isolate',
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                  }}
              >
                  <iframe
                      ref={iframeRef}
                      src={src}
                      style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          opacity: 0.6,
                          mixBlendMode: 'screen',
                      }}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      onCanPlay={handleCanPlay}
                      onPointerOver={props.onPointerOver}
                  />
                  <div
                      style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundImage: 'url(/screen-dirt.webp)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          opacity: 0.1,
                          pointerEvents: 'none',
                          mixBlendMode: 'overlay',
                      }}
                  />
              </Html>
              
              {/* Reflective Layer using MeshReflectorMaterial */}
              <mesh position={[scalingData.position[0], scalingData.position[1], scalingData.position[2]]} rotation={scalingData.rotation}>
                 <planeGeometry args={[scalingData.visualWidth, scalingData.visualHeight]} />
                 <MeshReflectorMaterial
                    blur={[300, 100]}
                    resolution={1024}
                    mixBlur={1}
                    mixStrength={80} 
                    roughness={0.1}
                    depthScale={1.2}
                    minDepthThreshold={0.4}
                    maxDepthThreshold={1.4}
                    color="white"
                    metalness={0.9} 
                    mirror={1}
                 />
              </mesh>
            </mesh>
            <mesh geometry={nodes['ug650f-b_Material_0'].geometry} material={materials['Material.001']} />
          </group>
        </group>
      </group>
    </group>
  );
});

export default Monitor;

useGLTF.preload && useGLTF.preload("/monitor.glb");
