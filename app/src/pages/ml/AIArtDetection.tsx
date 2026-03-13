import { motion } from 'framer-motion';
import { ArrowLeft, Image, Upload, Sparkles, XCircle, AlertTriangle, Eye, Palette } from 'lucide-react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface AIArtDetectionProps {
  onNavigate: (page: string) => void;
}

const detectionFactors = [
  { name: 'Tekstur', ai: 85, human: 15 },
  { name: 'Detail', ai: 70, human: 30 },
  { name: 'Pencahayaan', ai: 60, human: 40 },
  { name: 'Proporsi', ai: 75, human: 25 },
  { name: 'Warna', ai: 55, human: 45 },
];

export function AIArtDetection({ onNavigate }: AIArtDetectionProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isAIGenerated, setIsAIGenerated] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string);
          setShowResult(false);
          toast.success('Gambar berhasil diupload!');
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Mohon upload file gambar');
      }
    }
  };

  const analyzeImage = () => {
    if (!uploadedImage) {
      toast.error('Mohon upload gambar terlebih dahulu');
      return;
    }

    // Simulate AI analysis
    const randomConfidence = Math.random() * 40 + 50; // 50-90%
    const isAI = Math.random() > 0.5;

    setConfidence(randomConfidence);
    setIsAIGenerated(isAI);
    setShowResult(true);
    toast.success('Analisis gambar selesai!');
  };

  const chartData = [
    { name: 'AI Generated', value: isAIGenerated ? confidence : 100 - confidence, color: '#8b5cf6' },
    { name: 'Human Made', value: isAIGenerated ? 100 - confidence : confidence, color: '#3b82f6' },
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-400 flex items-center justify-center">
              <Image className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                AI Art <span className="text-pink-500">Detection</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Deteksi apakah gambar dibuat oleh AI atau manusia</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-500" />
                Upload Gambar
              </h2>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  uploadedImage
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {uploadedImage ? (
                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="max-h-64 mx-auto rounded-xl object-contain"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedImage(null);
                        setShowResult(false);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-blue-500" />
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">Klik untuk upload gambar</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm">atau drag and drop file di sini</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">Mendukung JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {/* Analyze Button */}
              {uploadedImage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="mt-6"
                >
                  <Button
                    onClick={analyzeImage}
                    className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-pink-500 to-purple-400 hover:from-pink-600 hover:to-purple-500 text-white rounded-xl shadow-lg shadow-pink-500/25"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Analisis Gambar
                  </Button>
                </motion.div>
              )}
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
                      isAIGenerated
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}
                  >
                    {isAIGenerated ? (
                      <>
                        <Sparkles className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">AI GENERATED</p>
                          <p className="text-sm">Gambar ini kemungkinan dibuat oleh AI</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Palette className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">HUMAN MADE</p>
                          <p className="text-sm">Gambar ini kemungkinan dibuat oleh manusia</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Confidence */}
                <div className="text-center mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Tingkat Kepercayaan</p>
                  <p className="text-5xl font-bold text-blue-500">{confidence.toFixed(1)}%</p>
                </div>

                {/* Charts */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Distribusi Prediksi
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
                    <div className="flex justify-center gap-4 mt-2">
                      {chartData.map((item) => (
                        <div key={item.name} className="flex items-center gap-1 text-xs">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Analisis Detail
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={detectionFactors} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={60} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="ai" name="AI" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="human" name="Human" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Detection Factors */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Faktor Deteksi</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Tekstur', icon: Eye },
                      { label: 'Detail', icon: Sparkles },
                      { label: 'Pencahayaan', icon: Palette },
                      { label: 'Proporsi', icon: Image },
                      { label: 'Warna', icon: Palette },
                    ].map((factor) => (
                      <div key={factor.label} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <factor.icon className="w-4 h-4 text-purple-500" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{factor.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    <strong>Catatan:</strong> Hasil ini berdasarkan analisis AI dan mungkin tidak
                    100% akurat. Teknologi AI terus berkembang dan semakin sulit dibedakan.
                  </p>
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
                    title: 'Upload Gambar',
                    desc: 'Unggah gambar yang ingin Anda analisis.',
                  },
                  {
                    step: '2',
                    title: 'Analisis AI',
                    desc: 'Sistem menganalisis pola, tekstur, dan karakteristik gambar.',
                  },
                  {
                    step: '3',
                    title: 'Dapatkan Hasil',
                    desc: 'Lihat apakah gambar dibuat oleh AI atau manusia.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ciri-ciri AI Art</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Detail yang tidak konsisten</li>
                  <li>• Tekstur yang terlalu sempurna</li>
                  <li>• Anatomi tidak wajar</li>
                  <li>• Pencahayaan tidak realistis</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
