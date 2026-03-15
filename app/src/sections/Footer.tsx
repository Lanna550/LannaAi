import { motion } from 'framer-motion';
import { Sparkles, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <motion.button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">Lanna</span>
          </motion.button>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <button onClick={() => onNavigate('home')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</button>
            <button onClick={() => onNavigate('chat')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Chat</button>
            <button onClick={() => onNavigate('ml')} className="hover:text-gray-900 dark:hover:text-white transition-colors">ML Features</button>
            <button onClick={() => onNavigate('tools')} className="hover:text-gray-900 dark:hover:text-white transition-colors">Tools</button>
          </div>

          {/* Copyright */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>© {currentYear} Lanna. Made with</span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span>for anime lovers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
