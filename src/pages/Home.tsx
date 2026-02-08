import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MousePointer } from "lucide-react";
import { useNavigate } from "react-router";

function ButtonGlobal() {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  // Generate cursor positions in concentric circles - with visual richness and performance
  const cursors = useMemo(() => {
    const cursors = [];
    // Smaller circle radii for iPhone 16
    const circles = [80, 120]; // Only 2 circles, closer to button
    const cursorsPerCircle = [6, 10]; // Fewer cursors

    circles.forEach((radius, circleIndex) => {
      const count = cursorsPerCircle[circleIndex];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        // Calculate rotation to point outward from button center (0, 0)
        const rotationOutward =
          Math.atan2(y, x) * (180 / Math.PI);

        // Main cursor
        cursors.push({
          id: `cursor-${circleIndex}-${i}`,
          finalX: x,
          finalY: y,
          delay: circleIndex * 0.01 + i * 0.002,
          rotation: rotationOutward,
          isTrail: false,
          opacity: 1,
          scale: 1,
        });

        // Trail cursors (2 trailing elements for performance balance)
        for (let t = 1; t <= 2; t++) {
          cursors.push({
            id: `cursor-${circleIndex}-${i}-trail-${t}`,
            finalX: x,
            finalY: y,
            delay: circleIndex * 0.01 + i * 0.002 + t * 0.008,
            rotation: rotationOutward,
            isTrail: true,
            opacity: 1 - t * 0.3,
            scale: 1 - t * 0.2,
          });
        }
      }
    });

    return cursors;
  }, []);

  const handleClick = () => {
    if (!isActive) {
      setIsActive(true);
      // Short animation - spin for 3 seconds then zoom in
      setTimeout(() => {
        setIsExiting(true);
      }, 3000);
      // Navigate to QR scanner after zoom-in animation completes
      setTimeout(() => {
        navigate("/scanner");
      }, 3800); // 3s for spin + 0.8s for zoom-in
    }
  };

  return (
    <div
      className="absolute backdrop-blur-md bg-white/20 border border-white/30 shadow-xl shadow-black/20 box-border content-stretch flex flex-row gap-0.5 items-center justify-center left-1/2 px-[22px] py-3 rounded-[38px] translate-x-[-50%] translate-y-[-50%] transition-all duration-300 hover:bg-white/30 hover:border-white/50 hover:shadow-2xl hover:shadow-black/30 hover:scale-105 active:scale-95 group overflow-visible z-20 will-change-transform cursor-pointer"
      data-name="Button-global"
      style={{ top: "calc(50% - 0.5px)" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent rounded-[38px]" />

      {/* Pulsing glow effect */}
      <motion.div
        className="absolute inset-0 rounded-[38px] opacity-0 will-change-transform"
        animate={
          isHovered || isActive
            ? {
                opacity: [0, 0.6, 0],
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 0 0px rgba(255,255,255,0)",
                  "0 0 20px rgba(255,255,255,0.4)",
                  "0 0 0px rgba(255,255,255,0)",
                ],
              }
            : {}
        }
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner glow */}
      <div className="absolute inset-0 rounded-[38px] shadow-inner shadow-white/20" />

      {/* Flying Cursors - Visual richness with performance optimizations */}
      <AnimatePresence>
        {(isHovered || isActive) && (
          <motion.div
            className="absolute pointer-events-none will-change-transform z-10"
            style={{
              left: "50%",
              top: "calc(50% - 0.5px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              rotate: isActive && !isExiting ? -360 : 0,
            }}
            transition={{
              duration: isActive && !isExiting ? 3 : 20,
              repeat: isActive && !isExiting ? 0 : Infinity,
              ease: "linear",
            }}
          >
            {cursors.map((cursor) => (
              <motion.div
                key={cursor.id}
                className="absolute pointer-events-none will-change-transform"
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                }}
                animate={
                  isExiting
                    ? {
                        x: 0,
                        y: 0,
                        opacity: 0,
                        scale: 0,
                      }
                    : {
                        x: cursor.finalX,
                        y: cursor.finalY,
                        opacity: cursor.isTrail
                          ? cursor.opacity
                          : [1, 0.8, 1],
                        scale: cursor.isTrail
                          ? cursor.scale
                          : [1, 1.1, 1],
                      }
                }
                exit={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  scale: 0,
                  transition: { duration: 1, ease: "easeInOut" },
                }}
                transition={
                  isExiting
                    ? {
                        duration: 1,
                        ease: "easeInOut",
                      }
                    : {
                        duration: 0.08,
                        delay: cursor.delay,
                        ease: "easeOut",
                        type: "spring",
                        damping: 25,
                        stiffness: 400,
                        opacity: {
                          duration: cursor.isTrail ? 0.08 : 2,
                          repeat: cursor.isTrail ? 0 : Infinity,
                          ease: "easeInOut",
                        },
                        scale: {
                          duration: cursor.isTrail ? 0.08 : 2,
                          repeat: cursor.isTrail ? 0 : Infinity,
                          ease: "easeInOut",
                        },
                      }
                }
              >
                <MousePointer
                  className="w-5 h-5 text-black drop-shadow-lg"
                  style={{
                    filter:
                      "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
                    opacity: cursor.opacity,
                    transform: `scale(${cursor.scale}) rotate(${cursor.rotation}deg)`,
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col font-['Inter:Regular',_sans-serif] font-normal justify-center leading-[0] not-italic relative shrink-0 text-[#bfc8ff] text-[20px] text-center text-nowrap tracking-[-0.7px] z-10 drop-shadow-lg">
        <p className="adjustLetterSpacing block leading-[1.4] whitespace-pre">
          ݁₊⊹. ݁ʚ hi ɞ. ⟡ ݁.⊹
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  // Create circular text with individual characters
  const text = " WHO ARE YOU AGAIN ?";
  const characters = text.split("");
  const radius = 150; // Smaller radius for iPhone 16

  return (
    <div className="bg-white relative size-full overflow-hidden">
      {/* Circular Rotating Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative w-full h-full"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {characters.map((char, i) => {
            const angle =
              (i / characters.length) * 2 * Math.PI -
              Math.PI / 2; // Start at top
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            // Rotate each character to align with circle tangent
            const rotation = (angle * 180) / Math.PI + 90;

            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 text-4xl font-black tracking-normal"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotation}deg)`,
                  color: "#000000",
                  fontWeight: 900,
                }}
              >
                {char}
              </div>
            );
          })}
        </motion.div>
      </div>

      <ButtonGlobal />
    </div>
  );
}