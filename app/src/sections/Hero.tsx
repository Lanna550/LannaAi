import { motion } from 'framer-motion';
import { MessageCircle, Sparkles, ArrowRight } from 'lucide-react';

interface HeroProps {
  onNavigate: (page: string) => void;
}

// Animated Scroll Mouse Component
function ScrollMouse() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="flex flex-col items-center gap-2"
    >
      <span className="text-sm text-gray-400 dark:text-gray-500">Scroll</span>
      <div className="relative">
        {/* Rotating circles around mouse */}
        <motion.div
          className="absolute -inset-4"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-300/40 dark:bg-blue-400/30 rounded-full" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-300/40 dark:bg-pink-400/30 rounded-full" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-purple-300/40 dark:bg-purple-400/30 rounded-full" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-300/40 dark:bg-cyan-400/30 rounded-full" />
        </motion.div>
        
        {/* Mouse */}
        <div className="relative w-6 h-10 border-2 border-gray-300 dark:border-gray-600 rounded-full flex justify-center">
          <motion.div
            className="w-1 h-1 bg-blue-400 dark:bg-blue-500 rounded-full mt-2"
            animate={{
              y: [0, 12, 0],
              opacity: [1, 0.3, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col pt-20 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Very subtle grid background - like reference */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #94a3b8 1px, transparent 1px),
              linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-32 right-32 w-24 h-24 bg-pink-200/20 dark:bg-pink-500/10 rounded-2xl rotate-12"
          animate={{ y: [0, -15, 0], rotate: [12, 18, 12] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-48 left-24 w-12 h-12 bg-blue-200/20 dark:bg-blue-500/10 rounded-full"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 right-1/4 w-3 h-3 bg-purple-200/30 dark:bg-purple-500/20 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium mb-6"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Anime Companion</span>
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 leading-tight"
              >
                Meet <span className="text-gradient">Lanna</span>
                <br />
                Your AI Friend
              </motion.h1>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-lg mx-auto lg:mx-0"
              >
                Experience the next generation of AI interaction with our anime-inspired chatbot. Chat, generate images, and explore machine learning features with your virtual companions.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <motion.button
                  onClick={() => onNavigate('chat')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium shadow-lg shadow-blue-500/25"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <MessageCircle className="w-5 h-5" />
                  Start Chatting
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={() => onNavigate('ml')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Sparkles className="w-5 h-5" />
                  Explore ML
                </motion.button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex gap-8 mt-10 justify-center lg:justify-start"
              >
                {[
                  { value: '3', label: 'AI Models' },
                  { value: '6', label: 'ML Features' },
                  { value: '∞', label: 'Possibilities' },
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{stat.value}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: Character image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative flex justify-center lg:justify-end"
            >
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative"
              >
                {/* Character - Larger size */}
                <img
                  src="/images/hero_girl.png"
                  alt="Lanna"
                  className="relative w-96 h-96 sm:w-[500px] sm:h-[500px] lg:w-[550px] lg:h-[550px] object-contain"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll Mouse Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="relative z-10 pb-8 flex justify-center"
      >
        <ScrollMouse />
      </motion.div>
    </section>
  );
}
