import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, 
  Moon, 
  User, 
  LogOut, 
  Settings, 
  Menu,
  X,
  Sparkles,
  MessageCircle,
  Brain,
  Home,
  Rocket,
  Wrench,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedMenu = mobileMenuRef.current?.contains(target) ?? false;
      const clickedButton = mobileMenuButtonRef.current?.contains(target) ?? false;
      if (!clickedMenu && !clickedButton) setMobileMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [mobileMenuOpen]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'ml', label: 'ML Features', icon: Brain },
    { id: 'tools', label: 'Tools', icon: Wrench },
    { id: 'deploy-website', label: 'Auto Deploy', icon: Rocket },
  ];

  const handleLogout = () => {
    logout();
    onNavigate('home');
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl dark:border-white/10 dark:bg-[#081427]/82"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <motion.button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center sm:h-11 sm:w-11">
              <Sparkles className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
              Lanna
            </span>
          </motion.button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isToolsItem = item.id === 'tools';
              const isDeployItem = item.id === 'deploy-website';
              const isToolsPage =
                currentPage === 'tools' ||
                currentPage === 'tiktok-downloader' ||
                currentPage === 'youtube-downloader';
              const isActive =
                isToolsItem
                  ? isToolsPage
                  : isDeployItem
                    ? currentPage === 'deploy-website'
                    : currentPage === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative px-3.5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors lg:px-4 lg:text-base ${
                    isActive 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="navIndicator"
                      className="absolute inset-0 rounded-lg bg-blue-50 dark:bg-white/10"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className="w-5 h-5 relative z-10" />
                  <span className="relative z-10 whitespace-nowrap">{item.label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle */}
            <motion.button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-gray-500 transition-colors hover:border-slate-200 hover:bg-slate-100 dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/10"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <AnimatePresence mode="wait">
                {theme === 'dark' ? (
                  <motion.div
                    key="moon"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* User menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/75 p-1.5 pr-3 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="h-8 w-8 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      {user?.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.displayName} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {user?.displayName?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onNavigate('profile')} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onNavigate('settings')} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-500">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => onNavigate('login')}
                  className="hidden sm:block px-5 py-2.5 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Sign In
                </button>
                <motion.button
                  onClick={() => onNavigate('register')}
                  className="shrink-0 whitespace-nowrap rounded-lg bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-2 text-sm font-medium leading-none text-white sm:px-5 sm:py-2.5 sm:text-base"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get Started
                </motion.button>
              </div>
            )}

            {/* Mobile menu button */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              ref={mobileMenuButtonRef}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-gray-500 hover:border-slate-200 hover:bg-slate-100 dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/10"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            ref={mobileMenuRef}
            className="overflow-hidden border-t border-black/5 bg-white/80 supports-[backdrop-filter]:bg-white/45 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#081427]/70 md:hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isToolsItem = item.id === 'tools';
                const isDeployItem = item.id === 'deploy-website';
                const isToolsPage =
                  currentPage === 'tools' ||
                  currentPage === 'tiktok-downloader' ||
                  currentPage === 'youtube-downloader';
                const isActive =
                  isToolsItem
                    ? isToolsPage
                    : isDeployItem
                      ? currentPage === 'deploy-website'
                      : currentPage === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                      isActive 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </motion.button>
                );
              })}
              {!isAuthenticated && (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-800 my-2" />
                  <motion.button
                    onClick={() => {
                      onNavigate('login');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                    whileTap={{ scale: 0.98 }}
                  >
                    <User className="w-5 h-5" />
                    <span className="font-medium">Sign In</span>
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
