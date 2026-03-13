import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  onComplete: () => void;
}

// Floating particles/circles around the character
const floatingParticles = [
  { size: 8, color: 'bg-pink-400', delay: 0, duration: 3, distance: 80, angle: 0 },
  { size: 6, color: 'bg-purple-400', delay: 0.5, duration: 3.5, distance: 90, angle: 45 },
  { size: 10, color: 'bg-blue-400', delay: 1, duration: 4, distance: 70, angle: 90 },
  { size: 5, color: 'bg-cyan-400', delay: 1.5, duration: 3.2, distance: 85, angle: 135 },
  { size: 7, color: 'bg-pink-300', delay: 0.3, duration: 3.8, distance: 75, angle: 180 },
  { size: 4, color: 'bg-purple-300', delay: 0.8, duration: 4.2, distance: 95, angle: 225 },
  { size: 9, color: 'bg-blue-300', delay: 1.2, duration: 3.6, distance: 65, angle: 270 },
  { size: 6, color: 'bg-pink-400', delay: 1.7, duration: 3.3, distance: 88, angle: 315 },
];

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
      >
        {/* Main Content */}
        <div className="flex flex-col items-center">
          
          {/* Character Image with Particles */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-8 relative"
          >
            {/* Floating Particles */}
            {floatingParticles.map((particle, index) => (
              <motion.div
                key={index}
                className={`absolute rounded-full ${particle.color} opacity-60`}
                style={{
                  width: particle.size,
                  height: particle.size,
                  left: '50%',
                  top: '50%',
                  marginLeft: -particle.size / 2,
                  marginTop: -particle.size / 2,
                }}
                animate={{
                  x: [
                    Math.cos((particle.angle * Math.PI) / 180) * particle.distance * 0.5,
                    Math.cos((particle.angle * Math.PI) / 180) * particle.distance,
                    Math.cos((particle.angle * Math.PI) / 180) * particle.distance * 0.5,
                  ],
                  y: [
                    Math.sin((particle.angle * Math.PI) / 180) * particle.distance * 0.5,
                    Math.sin((particle.angle * Math.PI) / 180) * particle.distance,
                    Math.sin((particle.angle * Math.PI) / 180) * particle.distance * 0.5,
                  ],
                  opacity: [0.3, 0.8, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: particle.duration,
                  repeat: Infinity,
                  delay: particle.delay,
                  ease: 'easeInOut',
                }}
              />
            ))}

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src="/images/inori_portrait.png"
                alt="Inori"
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover"
              />
            </motion.div>
          </motion.div>

          {/* Brand Name */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1"
          >
            Lanna
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-gray-500 dark:text-gray-400 text-sm mb-8"
          >
            Teman Anime AI-mu
          </motion.p>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 200 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="w-48 sm:w-56 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.05 }}
            />
          </motion.div>

          {/* Loading Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-gray-400 dark:text-gray-500 text-sm"
          >
            Memuat...
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
