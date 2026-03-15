import { useState, useEffect, useCallback } from 'react';
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
import { Tools } from '@/pages/Tools';
import { TiktokDownloader } from '@/pages/TiktokDownloader';
import { YoutubeDownloader } from '@/pages/YoutubeDownloader';
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
  | 'ml-art'
  | 'tools'
  | 'tiktok-downloader'
  | 'youtube-downloader';

const VALID_PAGES: Page[] = [
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
  'tools',
  'tiktok-downloader',
  'youtube-downloader',
];

const HASH_ROUTING_HOST_SUFFIXES = ['.github.io'];

const APP_BASE_PATH = (() => {
  const basePath = String(import.meta.env.BASE_URL || '').trim();
  if (!basePath || basePath === '.' || basePath === './') {
    return '';
  }

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/, '');
})();

const USE_HASH_ROUTING = (() => {
  if (typeof window === 'undefined') {
    return false;
  }

  const pageHost = String(window.location.hostname || '').trim().toLowerCase();
  return HASH_ROUTING_HOST_SUFFIXES.some((suffix) => pageHost.endsWith(suffix));
})();

function extractPageFromPathname(pathname: string): Page {
  const rawPathname = String(pathname || '/');
  let normalizedPathname = rawPathname;

  if (APP_BASE_PATH && rawPathname === APP_BASE_PATH) {
    normalizedPathname = '/';
  } else if (APP_BASE_PATH && rawPathname.startsWith(`${APP_BASE_PATH}/`)) {
    normalizedPathname = rawPathname.slice(APP_BASE_PATH.length);
  }

  const pageCandidate = normalizedPathname.replace(/^\/+|\/+$/g, '') as Page;
  if (!pageCandidate || pageCandidate === 'home') {
    return 'home';
  }

  return VALID_PAGES.includes(pageCandidate) ? pageCandidate : 'home';
}

function extractPageFromHash(hash: string): Page {
  const normalizedHashPath = String(hash || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '') as Page;

  if (!normalizedHashPath || normalizedHashPath === 'home') {
    return 'home';
  }

  return VALID_PAGES.includes(normalizedHashPath) ? normalizedHashPath : 'home';
}

function resolveCurrentPageFromLocation(): Page {
  if (typeof window === 'undefined') {
    return 'home';
  }

  if (USE_HASH_ROUTING) {
    const hashPage = extractPageFromHash(window.location.hash);
    if (window.location.hash) {
      return hashPage;
    }
  }

  return extractPageFromPathname(window.location.pathname);
}

function buildPathForPage(page: Page) {
  if (USE_HASH_ROUTING) {
    const hashPath = page === 'home' ? '#/' : `#/${page}`;
    const hashBasePath = APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/';
    const normalizedHashPath = `${hashBasePath}${hashPath}`.replace(/\/{2,}/g, '/');
    return normalizedHashPath.replace('/#', '/#');
  }

  const pagePath = page === 'home' ? '/' : `/${page}`;
  if (!APP_BASE_PATH) {
    return pagePath;
  }

  return `${APP_BASE_PATH}${pagePath}`.replace(/\/{2,}/g, '/');
}

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(() => resolveCurrentPageFromLocation());
  const { theme } = useTheme();
  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const syncCurrentPage = () => {
      setCurrentPage(resolveCurrentPageFromLocation());
    };

    if (USE_HASH_ROUTING && !window.location.hash) {
      const pageFromPathname = extractPageFromPathname(window.location.pathname);
      window.history.replaceState({}, '', buildPathForPage(pageFromPathname));
    }

    window.addEventListener('popstate', syncCurrentPage);
    if (USE_HASH_ROUTING) {
      window.addEventListener('hashchange', syncCurrentPage);
    }

    return () => {
      window.removeEventListener('popstate', syncCurrentPage);
      if (USE_HASH_ROUTING) {
        window.removeEventListener('hashchange', syncCurrentPage);
      }
    };
  }, []);

  const navigate = (page: string) => {
    const typedPage = VALID_PAGES.includes(page as Page) ? (page as Page) : 'home';
    setCurrentPage(typedPage);
    window.history.pushState({}, '', buildPathForPage(typedPage));
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
      case 'tools':
        return (
          <motion.div
            key="tools"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Tools onNavigate={navigate} />
          </motion.div>
        );
      case 'tiktok-downloader':
        return (
          <motion.div
            key="tiktok-downloader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <TiktokDownloader onNavigate={navigate} />
          </motion.div>
        );
      case 'youtube-downloader':
        return (
          <motion.div
            key="youtube-downloader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <YoutubeDownloader onNavigate={navigate} />
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
          <LoadingScreen onComplete={handleLoadingComplete} />
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
