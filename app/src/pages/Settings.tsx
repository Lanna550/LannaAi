import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Moon, 
  Sun, 
  Bell, 
  Shield, 
  User, 
  Globe, 
  ChevronRight,
  Check,
  Volume2,
  Mail,
  Smartphone
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface SettingsProps {
  onNavigate: (page: string) => void;
}

export function Settings({ onNavigate }: SettingsProps) {
  const { theme, toggleTheme } = useTheme();
  
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  });
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState('id');

  const handleSave = () => {
    toast.success('Settings saved successfully!');
  };

  return (
    <div className="page-with-navbar pb-12 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your Lanna experience
          </p>
        </motion.div>

        {/* Appearance Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-purple-500" />
              ) : (
                <Sun className="w-5 h-5 text-purple-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appearance</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Customize how Lanna looks</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="w-5 h-5 text-gray-500" /> : <Sun className="w-5 h-5 text-gray-500" />}
                <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>
          </div>
        </motion.div>

        {/* Notifications Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your notification preferences</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">Email Notifications</span>
              </div>
              <Switch 
                checked={notifications.email} 
                onCheckedChange={(checked) => setNotifications({...notifications, email: checked})} 
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">Push Notifications</span>
              </div>
              <Switch 
                checked={notifications.push} 
                onCheckedChange={(checked) => setNotifications({...notifications, push: checked})} 
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">Sound Effects</span>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>
          </div>
        </motion.div>

        {/* Language Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Language</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose your preferred language</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
              { code: 'en', label: 'English', flag: '🇬🇧' },
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                  language === lang.code 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                    : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`${language === lang.code ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                    {lang.label}
                  </span>
                </div>
                {language === lang.code && <Check className="w-5 h-5 text-blue-500" />}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Privacy Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Privacy & Security</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account security</p>
            </div>
          </div>

          <div className="space-y-2">
            <button 
              onClick={() => onNavigate('profile')}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">Edit Profile</span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Button 
            onClick={handleSave}
            className="w-full py-6 text-lg font-medium bg-gradient-to-r from-blue-500 to-cyan-400"
          >
            Save Changes
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
