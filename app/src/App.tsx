import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ChatProvider } from '@/context/ChatContext';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';
import { Features } from '@/sections/Features';
import { Companions } from '@/sections/Companions';
import { MLFeatures } from '@/sections/MLFeatures';
import { CTA } from '@/sections/CTA';
import { Feedback } from '@/sections/Feedback';
import { Footer } from '@/sections/Footer';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { Profile } from '@/pages/Profile';
import { Settings } from '@/pages/Settings';
import { Chat } from '@/pages/Chat';
import { MLPage } from '@/pages/MLPage';
import {
  HousePricePrediction,
  SpamClassifier,
  StudentGradePrediction,
  DiseaseDetection,
  FraudDetection,
  AIArtDetection,
} from '@/pages/ml';

type Page =
  | 'home'
  | 'login'
  | 'register'
  | 'profile'
  | 'settings'
  | 'chat'
  | 'ml'
  | 'ml-house-price'
  | 'ml-spam'
  | 'ml-grade'
  | 'ml-disease'
  | 'ml-fraud'
  | 'ml-art';

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const { theme } = useTheme();

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.slice(1) as Page;
      const validPages: Page[] = [
        'home',
        'login',
        'register',
        'profile',
        'settings',
        'chat',
        'ml',
        'ml-house-price',
        'ml-spam',
        'ml-grade',
        'ml-disease',
        'ml-fraud',
        'ml-art',
      ];
      if (validPages.includes(path)) {
        setCurrentPage(path);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (page: string) => {
    const typedPage = page as Page;
    setCurrentPage(typedPage);
    window.history.pushState({}, '', page === 'home' ? '/' : `/${page}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Login onNavigate={navigate} />
          </motion.div>
        );
      case 'register':
        return (
          <motion.div
            key="register"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Register onNavigate={navigate} />
          </motion.div>
        );
      case 'profile':
        return (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Profile onNavigate={navigate} />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div
            key="settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Settings onNavigate={navigate} />
          </motion.div>
        );
      case 'chat':
        return (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Chat onNavigate={navigate} />
          </motion.div>
        );
      case 'ml':
        return (
          <motion.div
            key="ml"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MLPage onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-house-price':
        return (
          <motion.div
            key="ml-house-price"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <HousePricePrediction onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-spam':
        return (
          <motion.div
            key="ml-spam"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SpamClassifier onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-grade':
        return (
          <motion.div
            key="ml-grade"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <StudentGradePrediction onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-disease':
        return (
          <motion.div
            key="ml-disease"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DiseaseDetection onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-fraud':
        return (
          <motion.div
            key="ml-fraud"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FraudDetection onNavigate={navigate} />
          </motion.div>
        );
      case 'ml-art':
        return (
          <motion.div
            key="ml-art"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <AIArtDetection onNavigate={navigate} />
          </motion.div>
        );
      case 'home':
      default:
        return (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Hero onNavigate={navigate} />
            <Features />
            <Companions onNavigate={navigate} />
            <MLFeatures onNavigate={navigate} />
            <CTA onNavigate={navigate} />
            <Feedback />
            <Footer onNavigate={navigate} />
          </motion.div>
        );
    }
  };

  return (
    <div className={`min-h-screen ${theme} bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
      <AnimatePresence>
        {isLoading && (
          <LoadingScreen onComplete={() => setIsLoading(false)} />
        )}
      </AnimatePresence>

      {!isLoading && (
        <>
          <Navbar onNavigate={navigate} currentPage={currentPage} />
          <AnimatePresence mode="wait">
            {renderPage()}
          </AnimatePresence>
        </>
      )}

      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
