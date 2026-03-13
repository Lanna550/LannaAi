import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Shield, AlertTriangle, CheckCircle, XCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface SpamClassifierProps {
  onNavigate: (page: string) => void;
}

const spamIndicators = [
  { label: 'Kata-kata mencurigakan', key: 'suspiciousWords' },
  { label: 'Link berbahaya', key: 'dangerousLinks' },
  { label: 'Permintaan data pribadi', key: 'personalInfo' },
  { label: 'Teks berlebihan', key: 'excessiveText' },
];

export function SpamClassifier({ onNavigate }: SpamClassifierProps) {
  const [emailContent, setEmailContent] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isSpam, setIsSpam] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [indicators, setIndicators] = useState<Record<string, boolean>>({});

  const analyzeSpam = () => {
    if (!emailContent.trim()) {
      toast.error('Mohon masukkan konten email');
      return;
    }

    const content = emailContent.toLowerCase();
    const spamWords = ['gratis', 'menang', 'hadiah', 'klik di sini', 'segera', 'terbatas', 'promo', 'diskon besar'];
    const hasSpamWords = spamWords.some((word) => content.includes(word));
    const hasLinks = content.includes('http') || content.includes('www');
    const hasPersonalInfoRequest = content.includes('password') || content.includes('pin') || content.includes('kartu kredit');
    const isExcessive = emailContent.length > 500;

    const spamScore = [hasSpamWords, hasLinks, hasPersonalInfoRequest, isExcessive].filter(Boolean).length;
    const spamProbability = (spamScore / 4) * 100;

    setIsSpam(spamProbability > 50);
    setConfidence(spamProbability);
    setIndicators({
      suspiciousWords: hasSpamWords,
      dangerousLinks: hasLinks,
      personalInfo: hasPersonalInfoRequest,
      excessiveText: isExcessive,
    });
    setShowResult(true);
    toast.success('Analisis selesai!');
  };

  const chartData = [
    { name: 'Spam', value: confidence, color: '#ef4444' },
    { name: 'Aman', value: 100 - confidence, color: '#22c55e' },
  ];

  return (
    <div className="page-with-navbar pb-12 bg-gradient-to-b from-sky-50 via-white to-sky-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <button
            onClick={() => onNavigate('ml')}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Spam Email <span className="text-red-500">Classifier</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Deteksi email spam dengan kecerdasan buatan</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Konten Email
              </h2>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="emailContent" className="text-gray-700 dark:text-gray-300">
                    Masukkan isi email yang ingin dianalisis
                  </Label>
                  <Textarea
                    id="emailContent"
                    placeholder="Tempelkan konten email di sini..."
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    className="mt-2 min-h-[200px] resize-none bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button
                    onClick={analyzeSpam}
                    className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-red-500 to-orange-400 hover:from-red-600 hover:to-orange-500 text-white rounded-xl shadow-lg shadow-red-500/25"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Analisis Email
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Results Section */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Hasil Analisis</h2>

                {/* Result Badge */}
                <div className="flex justify-center mb-6">
                  <div
                    className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl ${
                      isSpam
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {isSpam ? (
                      <>
                        <AlertTriangle className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">SPAM TERDETEKSI</p>
                          <p className="text-sm">Email ini mencurigakan</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">AMAN</p>
                          <p className="text-sm">Email ini tampak aman</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Confidence Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Tingkat Kepercayaan
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-center text-2xl font-bold text-gray-900 dark:text-white">
                      {confidence.toFixed(1)}%
                    </p>
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      {isSpam ? 'Kemungkinan Spam' : 'Kemungkinan Aman'}
                    </p>
                  </div>

                  {/* Indicators */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Indikator</h3>
                    <div className="space-y-3">
                      {spamIndicators.map((indicator) => (
                        <div
                          key={indicator.key}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            indicators[indicator.key]
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          }`}
                        >
                          {indicators[indicator.key] ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <CheckCircle className="w-5 h-5" />
                          )}
                          <span className="text-sm">{indicator.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* How It Works Section */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card sticky top-24 border border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Cara Kerja</h2>

              <div className="space-y-6">
                {[
                  {
                    step: '1',
                    title: 'Input Email',
                    desc: 'Masukkan konten email yang ingin Anda periksa.',
                  },
                  {
                    step: '2',
                    title: 'Analisis AI',
                    desc: 'Sistem menganalisis pola, kata kunci, dan struktur email.',
                  },
                  {
                    step: '3',
                    title: 'Dapatkan Hasil',
                    desc: 'Lihat apakah email aman atau spam dengan tingkat kepercayaan.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ciri-ciri Spam</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Tawaran yang terlalu bagus</li>
                  <li>• Link mencurigakan</li>
                  <li>• Permintaan data pribadi</li>
                  <li>• Bahasa yang mendesak</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
