import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Edit, MessageSquare, Brain, Award, Zap, Image, Star, Calendar, Mail, MapPin, Link2, ImagePlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ProfileProps {
  onNavigate: (page: string) => void;
}

const achievements = [
  { icon: MessageSquare, title: 'First Chat', description: 'Started your first conversation', earned: true },
  { icon: Brain, title: 'ML Explorer', description: 'Used 5 different ML features', earned: true },
  { icon: Image, title: 'Image Master', description: 'Generated 10 images', earned: false },
  { icon: Zap, title: 'Power User', description: 'Used Lanna for 7 days straight', earned: false },
];

export function Profile({ onNavigate }: ProfileProps) {
  const { user, isAuthenticated, updateUser, uploadProfileMedia } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [website, setWebsite] = useState(user?.website || '');

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBio(user?.bio || '');
    setLocation(user?.location || '');
    setWebsite(user?.website || '');
  }, [user]);

  if (!isAuthenticated) {
    return (
      <div className="page-with-navbar flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Please Sign In</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">You need to be logged in to view your profile.</p>
          <Button onClick={() => onNavigate('login')} className="bg-gradient-to-r from-blue-500 to-cyan-400">
            Sign In
          </Button>
        </motion.div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateUser({ displayName, bio, location, website });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error || 'Gagal menyimpan profil.');
      return;
    }

    toast.success('Profil berhasil disimpan.');
    setIsEditing(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      const result = await uploadProfileMedia({ avatar: file });
      if (!result.success) {
        toast.error(result.error || 'Gagal mengunggah foto profil.');
        return;
      }

      toast.success('Foto profil diperbarui.');
    }
  };

  const handleBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      const result = await uploadProfileMedia({ banner: file });
      if (!result.success) {
        toast.error(result.error || 'Gagal mengunggah banner.');
        return;
      }

      toast.success('Banner diperbarui.');
    }
  };

  return (
    <div className="page-with-navbar pb-12 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Banner Background */}
          <div 
            onClick={handleBannerClick}
            className="h-40 sm:h-48 rounded-b-3xl relative overflow-hidden cursor-pointer group"
          >
            {user?.banner ? (
              <img 
                src={user.banner} 
                alt="Banner" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                {/* Decorative circles */}
                <div className="absolute top-4 right-8 w-20 h-20 rounded-full bg-white/10" />
                <div className="absolute bottom-4 left-12 w-16 h-16 rounded-full bg-white/10" />
                <div className="absolute top-1/2 right-1/4 w-8 h-8 rounded-full bg-white/20" />
              </div>
            )}
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center gap-2 text-white">
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm font-medium">Change Banner</span>
              </div>
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="hidden"
            />
          </div>
          
          {/* Profile Card */}
          <div className="relative -mt-16 mx-4 sm:mx-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Avatar */}
                <div className="relative -mt-12 sm:-mt-16">
                  <div 
                    onClick={handleAvatarClick}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                        <span className="text-3xl sm:text-4xl font-bold text-white">
                          {user?.displayName?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAvatarClick}
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 w-full">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display Name"
                        className="max-w-xs bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                      />
                      <Textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Add a bio..."
                        className="max-w-md bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Input
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="Location"
                          className="max-w-xs bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                        />
                        <Input
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          placeholder="Website"
                          className="max-w-xs bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSave} size="sm" disabled={isSaving} className="bg-gradient-to-r from-blue-500 to-cyan-400">
                          Save
                        </Button>
                        <Button onClick={() => setIsEditing(false)} size="sm" variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{user?.displayName}</h1>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1 mt-1">
                        <Mail className="w-4 h-4" />
                        {user?.email}
                      </p>
                      {user?.bio && (
                        <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">{user.bio}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Joined {new Date(user?.createdAt || '').toLocaleDateString()}
                        </span>
                        {user?.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {user.location}
                          </span>
                        )}
                        {user?.website && (
                          <a 
                            href={user.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-500 hover:underline"
                          >
                            <Link2 className="w-4 h-4" />
                            {user.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 mx-4 sm:mx-6"
        >
          {[
            { icon: MessageSquare, value: '12', label: 'Chats' },
            { icon: Brain, value: '8', label: 'ML Uses' },
            { icon: Award, value: 'Novice', label: 'Level' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-700">
              <stat.icon className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-gray-700 mt-6 mx-4 sm:mx-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Achievements</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {achievements.map((achievement, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  achievement.earned 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  achievement.earned 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  <achievement.icon className={`w-5 h-5 ${
                    achievement.earned 
                      ? 'text-blue-500 dark:text-blue-400' 
                      : 'text-gray-400 dark:text-gray-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{achievement.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{achievement.description}</div>
                </div>
                {achievement.earned && (
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
