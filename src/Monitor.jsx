import { Html, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import { forwardRef, useMemo, useRef } from "react";

const Monitor = forwardRef(({ iframeSrc, ...props }, ref) => {
  const { nodes, materials } = useGLTF("/monitor.glb");
  const iframeRef = useRef(null);
  
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

    let rotation = [0, 0, 0];
    let position = [centerX, centerY, centerZ + 0.02]; 
    let logicalHeight = height;

    // Detect if geometry is flat on XZ plane (common in some exports)
    if (height < 0.01) { 
        rotation = [Math.PI / 2, Math.PI, 0]; 
        position = [centerX, centerY + 0.05, centerZ];
        logicalHeight = depth; 
    } 
    
    const pixelWidth = 1440; 
    const SCALE_MULTIPLIER = 39; 
    
    const scale = (width / pixelWidth) * SCALE_MULTIPLIER;
    
    return {
        scale,
        pixelWidth,
        pixelHeight: (pixelWidth * logicalHeight) / width, 
        position,
        rotation,
        visualWidth: width,
        visualHeight: logicalHeight
    };
  }, [nodes]);

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
            <mesh geometry={nodes.screen.geometry} material={materials['Material.001']}>
              <Html
                  transform
                  scale={scalingData.scale}
                  position={scalingData.position}
                  rotation={scalingData.rotation}
                  style={{
                      width: scalingData.pixelWidth,
                      height: scalingData.pixelHeight,
                  }}
              >
                  <iframe
                      ref={iframeRef}
                      src={src}
                      style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          display: 'block',
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
                          backgroundImage: 'url(/screen-dirt.png)',
                          backgroundSize: 'cover', // Stretch to cover without visible seams
                          backgroundPosition: 'center',
                          opacity: 0.1, // Slightly more visible
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
