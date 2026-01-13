import { Html, useGLTF } from "@react-three/drei";
import { useRef } from "react";

export default function Monitor({ iframeSrc, ...props }) {
  const { scene } = useGLTF("monitor.glb");
  const iframeRef = useRef(null);

  const src = iframeSrc || 'https://open.spotify.com/embed/playlist/37i9dQZEVXcZb9ak6F5ysH?utm_source=generator'

  const handleCanPlay = () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage({ action: 'play' }, '*');
      } catch (e) {
        console.log('Cross-origin iframe, autoplay handled by iframe source');
      }
    }
  };

  return (
    <primitive object={scene} {...props}>
      <Html
        wrapperClass="htmlScreen"
        position={[0, 0.31, -0.12]}
        rotation={[0, -Math.PI, 0]}
        scale={0.3}
        distanceFactor={1}
        transform
        occlude
      >
        <iframe
          ref={iframeRef}
          data-testid="embed-iframe"
          src={src}
          width="560"
          height="315"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Embedded content"
          onCanPlay={handleCanPlay}
        />
      </Html>
    </primitive>
  );
}

useGLTF.preload && useGLTF.preload("monitor.glb");
