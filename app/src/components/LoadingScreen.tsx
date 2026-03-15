import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  onComplete: () => void;
}

const wordmarkLetters = ['L', 'a', 'n', 'n', 'a'];
const satellites = [
  { delay: 0, duration: 3.8, size: 5, opacity: 'opacity-80' },
  { delay: 0.55, duration: 4.2, size: 4, opacity: 'opacity-65' },
];

function LannaStarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lanna-loader-star" x1="8" y1="6.5" x2="39.5" y2="37.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <path
        d="M24 6.5L27.6 18.4L39.5 22L27.6 25.6L24 37.5L20.4 25.6L8.5 22L20.4 18.4L24 6.5Z"
        stroke="url(#lanna-loader-star)"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36.6 9.4L37.7 13.2L41.5 14.3L37.7 15.5L36.6 19.3L35.4 15.5L31.7 14.3L35.4 13.2L36.6 9.4Z"
        fill="#60A5FA"
      />
      <path
        d="M12.1 29.7L12.9 32.2L15.4 33L12.9 33.8L12.1 36.3L11.3 33.8L8.8 33L11.3 32.2L12.1 29.7Z"
        fill="#93C5FD"
      />
    </svg>
  );
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, 2200);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(7px)' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[radial-gradient(120%_85%_at_50%_0%,rgba(37,99,235,0.18)_0%,rgba(37,99,235,0)_56%),linear-gradient(180deg,#f7faff_0%,#ffffff_44%,#edf4ff_100%)] dark:bg-[radial-gradient(120%_85%_at_50%_0%,rgba(56,189,248,0.22)_0%,rgba(56,189,248,0)_54%),linear-gradient(180deg,#030916_0%,#061022_45%,#081326_100%)]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-500/18"
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.14, 0.28, 0.14] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-[32rem] w-44 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-white/70 to-transparent opacity-75 blur-3xl dark:via-blue-300/15"
          animate={{ opacity: [0.15, 0.32, 0.15], scaleY: [0.92, 1.08, 0.92] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            backgroundImage: 'radial-gradient(rgba(100, 116, 139, 0.3) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
          animate={{ opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 165, damping: 20, mass: 0.9 }}
        className="relative flex flex-col items-center px-6"
      >
        <motion.div
          className="relative mb-6 flex items-center gap-4"
        >
          <motion.div
            className="relative grid h-24 w-24 place-items-center"
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-500/18 blur-2xl dark:bg-cyan-400/20"
              animate={{ scale: [0.92, 1.1, 0.92], opacity: [0.2, 0.48, 0.2] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-blue-200/75 dark:border-blue-300/22"
            />
            <motion.div
              className="absolute inset-[8px] rounded-full border-[1.5px] border-transparent border-t-blue-500 border-r-cyan-400 dark:border-t-blue-300 dark:border-r-cyan-200"
              animate={{ rotate: 360 }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[17px] rounded-full border border-transparent border-b-sky-300/90 border-l-blue-200/80 dark:border-b-sky-300/50 dark:border-l-blue-200/25"
              animate={{ rotate: -360 }}
              transition={{ duration: 7.2, repeat: Infinity, ease: 'linear' }}
            />

            {satellites.map((satellite, index) => (
              <motion.div
                key={index}
                className="absolute inset-0"
                animate={{ rotate: [0, 360] }}
                transition={{
                  duration: satellite.duration,
                  delay: satellite.delay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <span
                  className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 dark:bg-cyan-300 ${satellite.opacity}`}
                  style={{ width: satellite.size, height: satellite.size }}
                />
              </motion.div>
            ))}

            <motion.div
              className="relative grid h-16 w-16 place-items-center rounded-[1.2rem] border border-white/90 bg-white/88 shadow-[0_20px_40px_-25px_rgba(15,23,42,0.68)] dark:border-white/10 dark:bg-slate-900/80"
              animate={{ y: [0, -1.7, 0], scale: [1, 1.045, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: [0.37, 0, 0.63, 1] }}
            >
              <motion.div
                animate={{ rotate: [0, 4, 0, -4, 0], opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <LannaStarIcon className="h-9 w-9 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
              </motion.div>
            </motion.div>
          </motion.div>

          <div className="flex items-end overflow-hidden">
            {wordmarkLetters.map((char, index) => (
              <motion.span
                key={`${char}-${index}`}
                initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.55, delay: 0.12 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="text-[2.2rem] font-semibold tracking-[-0.08em] text-slate-900 dark:text-slate-100 sm:text-[2.45rem] [font-family:'Sora','Plus_Jakarta_Sans','Segoe_UI',sans-serif]"
              >
                {char}
              </motion.span>
            ))}
          </div>
        </motion.div>

        <div className="relative h-[2px] w-52 overflow-hidden rounded-full bg-slate-300/65 dark:bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-transparent via-blue-500/95 to-transparent"
            animate={{ x: ['-130%', '235%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: [0.37, 0, 0.63, 1] }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
