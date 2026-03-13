import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHAT_MODELS } from '@/context/ChatContext';

interface ChatModelsProps {
  onNavigate: (page: string) => void;
}

export function ChatModels({ onNavigate }: ChatModelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(0);

  const nextModel = () => {
    setActiveIndex((prev) => (prev + 1) % CHAT_MODELS.length);
  };

  const prevModel = () => {
    setActiveIndex((prev) => (prev - 1 + CHAT_MODELS.length) % CHAT_MODELS.length);
  };

  const activeModel = CHAT_MODELS[activeIndex];

  return (
    <section ref={containerRef} className="relative py-24 overflow-hidden">
      {/* Dynamic background based on active model */}
      <motion.div
        className="absolute inset-0 transition-colors duration-700"
        animate={{
          background: `radial-gradient(circle at 50% 50%, ${activeModel.theme.primary}15 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Choose Your Companion
          </span>
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ fontFamily: "'M PLUS Rounded 1c', sans-serif" }}
          >
            <span className="text-gradient">Meet Your</span>
            <br />
            <span className="text-foreground">AI Companions</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Each character has their own unique personality and style. Choose the one that resonates with you!
          </p>
        </motion.div>

        {/* Character carousel */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="relative"
        >
          {/* Navigation buttons */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between z-20 px-4 pointer-events-none">
            <motion.button
              onClick={prevModel}
              className="w-12 h-12 rounded-full glass flex items-center justify-center pointer-events-auto"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
            <motion.button
              onClick={nextModel}
              className="w-12 h-12 rounded-full glass flex items-center justify-center pointer-events-auto"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronRight className="w-6 h-6" />
            </motion.button>
          </div>

          {/* Character display */}
          <div className="flex justify-center items-center min-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModel.id}
                initial={{ opacity: 0, scale: 0.8, x: 100 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -100 }}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                className="grid md:grid-cols-2 gap-8 items-center max-w-4xl w-full"
              >
                {/* Character image */}
                <div className="relative flex justify-center">
                  <motion.div
                    className="relative"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {/* Glow effect */}
                    <div 
                      className="absolute inset-0 blur-3xl rounded-full scale-110"
                      style={{ background: `radial-gradient(circle, ${activeModel.theme.primary}40 0%, transparent 70%)` }}
                    />
                    <img
                      src={activeModel.avatar}
                      alt={activeModel.name}
                      className="relative w-72 h-72 sm:w-96 sm:h-96 object-contain drop-shadow-2xl"
                    />
                  </motion.div>
                </div>

                {/* Character info */}
                <div className="text-center md:text-left">
                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl sm:text-5xl font-bold mb-2"
                    style={{ 
                      fontFamily: "'M PLUS Rounded 1c', sans-serif",
                      color: activeModel.theme.primary 
                    }}
                  >
                    {activeModel.name}
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-lg text-muted-foreground mb-4"
                  >
                    {activeModel.description}
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 rounded-xl bg-muted/50 mb-6"
                  >
                    <p className="text-sm italic text-muted-foreground">
                      "{activeModel.personality}"
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      size="lg"
                      onClick={() => onNavigate('chat')}
                      className="rounded-full px-8"
                      style={{ 
                        background: `linear-gradient(135deg, ${activeModel.theme.primary}, ${activeModel.theme.secondary})` 
                      }}
                    >
                      <MessageCircle className="w-5 h-5 mr-2" />
                      Chat with {activeModel.name}
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots indicator */}
          <div className="flex justify-center gap-3 mt-8">
            {CHAT_MODELS.map((model, index) => (
              <motion.button
                key={model.id}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === activeIndex ? 'w-8' : ''
                }`}
                style={{
                  backgroundColor: index === activeIndex ? model.theme.primary : `${model.theme.primary}50`,
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
