import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const springValues = {
  damping: 30,
  stiffness: 100,
  mass: 2
};

export default function TiltEffect({
  children,
  rotateAmplitude = 5,
  scaleOnHover = 1,
  className = '',
  overlayContent = null,
  displayOverlayContent = true
}) {
  const ref = useRef(null);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const overlayOpacity = useSpring(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  function handleMouse(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();

    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
    if (!isMobile) {
      overlayOpacity.set(1);
    }
  }

  function handleMouseLeave() {
    if (!isMobile) {
      overlayOpacity.set(0);
    }
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      ref={ref}
      className={`relative w-full h-full [perspective:800px] ${className}`}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative w-full h-full [transform-style:preserve-3d]"
        style={{
          rotateX,
          rotateY,
          scale
        }}
      >
        {/* Background content */}
        <div className="relative w-full h-full [transform:translateZ(0)]">
          {children}
        </div>

        {/* Overlay content with separate 3D effect - always positioned */}
        {displayOverlayContent && overlayContent && (
          <motion.div 
            className="absolute inset-0 z-[2] will-change-transform [transform:translateZ(30px)] pointer-events-none"
            style={{ opacity: isMobile ? 1 : overlayOpacity }}
          >
            {overlayContent}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
