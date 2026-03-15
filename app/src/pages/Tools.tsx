import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Download, Music2, Youtube } from 'lucide-react';

interface ToolsProps {
  onNavigate: (page: string) => void;
}

const tools = [
  {
    id: 'tiktok-downloader',
    title: 'Tiktok Downloader',
    description: 'Download video TikTok tanpa watermark dengan cepat.',
    icon: Download,
    iconBg: 'from-cyan-500 to-emerald-500',
    badge: 'Video Tool',
  },
  {
    id: 'youtube-downloader',
    title: 'Youtube Downloader',
    description: 'Simpan video atau audio YouTube dalam satu halaman praktis.',
    icon: Youtube,
    iconBg: 'from-red-500 to-orange-500',
    badge: 'Media Tool',
  },
];

export function Tools({ onNavigate }: ToolsProps) {
  return (
    <div className="page-with-navbar pb-12 bg-gradient-to-b from-sky-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <button
            onClick={() => onNavigate('home')}
            className="mb-4 inline-flex items-center gap-2 text-gray-700 transition-colors hover:text-cyan-700 dark:text-gray-300 dark:hover:text-cyan-300"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-base font-medium">Kembali</span>
          </button>

          <div className="max-w-2xl">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              Utility Hub
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Tools <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">Center</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300 sm:text-base">
              Pilih tool yang ingin kamu pakai untuk download video atau audio.
            </p>
          </div>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index, duration: 0.35 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onNavigate(tool.id)}
                className="group rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-card transition-all hover:shadow-xl dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${tool.iconBg} flex items-center justify-center`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {tool.badge}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {tool.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {tool.description}
                </p>

                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 transition-colors group-hover:text-cyan-500 dark:text-cyan-400">
                  Buka Tool
                  <ArrowRight className="h-4 w-4" />
                </div>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-900/20 dark:text-cyan-200">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4" />
            <span>Semua tools akan terus diperbarui secara bertahap.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
