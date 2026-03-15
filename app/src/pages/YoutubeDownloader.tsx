import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Link2, Loader2, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface YoutubeDownloaderProps {
  onNavigate: (page: string) => void;
}

const YOUTUBE_URL_REGEX = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/.+/i;

export function YoutubeDownloader({ onNavigate }: YoutubeDownloaderProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = youtubeUrl.trim();

    if (!trimmedUrl) {
      toast.error('Masukkan URL YouTube terlebih dahulu');
      return;
    }

    if (!YOUTUBE_URL_REGEX.test(trimmedUrl)) {
      toast.error('URL YouTube tidak valid');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.info('Youtube Downloader akan segera aktif.');
    }, 700);
  };

  return (
    <div className="page-with-navbar pb-12 bg-gradient-to-b from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <button
              onClick={() => onNavigate('tools')}
              className="inline-flex items-center gap-2 text-gray-700 transition-colors hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-base font-medium">Kembali ke Tools</span>
            </button>

            <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25 sm:h-14 sm:w-14 sm:min-h-14 sm:min-w-14">
              <Youtube className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">
              Youtube Tool
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Youtube <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Downloader</span>
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
              Halaman sudah siap, tinggal aktivasi API downloader YouTube.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="max-w-2xl mx-auto rounded-2xl border border-gray-100 bg-white p-6 shadow-card dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="mb-5 text-center text-xl font-bold text-gray-900 dark:text-white">Masukkan Link YouTube</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Link2 className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="pl-9 h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyiapkan...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Youtube
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
