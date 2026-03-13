import { motion } from 'framer-motion';
import { ArrowLeft, Stethoscope, Activity, Heart, Thermometer, Check, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DiseaseDetectionProps {
  onNavigate: (page: string) => void;
}

const symptoms = [
  { id: 'fever', label: 'Demam', icon: Thermometer, category: 'umum' },
  { id: 'cough', label: 'Batuk', icon: Activity, category: 'pernapasan' },
  { id: 'fatigue', label: 'Kelelahan', icon: Activity, category: 'umum' },
  { id: 'headache', label: 'Sakit Kepala', icon: Activity, category: 'umum' },
  { id: 'soreThroat', label: 'Sakit Tenggorokan', icon: Activity, category: 'pernapasan' },
  { id: 'runnyNose', label: 'Hidung Meler', icon: Activity, category: 'pernapasan' },
  { id: 'nausea', label: 'Mual', icon: Activity, category: 'pencernaan' },
  { id: 'vomiting', label: 'Muntah', icon: Activity, category: 'pencernaan' },
  { id: 'diarrhea', label: 'Diare', icon: Activity, category: 'pencernaan' },
  { id: 'chestPain', label: 'Nyeri Dada', icon: Heart, category: 'serius' },
  { id: 'shortnessBreath', label: 'Sesak Napas', icon: Activity, category: 'serius' },
  { id: 'bodyAche', label: 'Nyeri Otot', icon: Activity, category: 'umum' },
  { id: 'chills', label: 'Menggigil', icon: Thermometer, category: 'umum' },
  { id: 'lossTaste', label: 'Hilangnya Pengecapan', icon: Activity, category: 'spesifik' },
  { id: 'lossSmell', label: 'Hilangnya Penciuman', icon: Activity, category: 'spesifik' },
  { id: 'rash', label: 'Ruam Kulit', icon: Activity, category: 'kulit' },
];

const diseases = [
  {
    name: 'Flu Biasa',
    symptoms: ['fever', 'cough', 'fatigue', 'soreThroat', 'runnyNose'],
    severity: 'ringan',
    advice: 'Istirahat yang cukup, minum banyak air, dan konsumsi obat pereda gejala.',
  },
  {
    name: 'COVID-19',
    symptoms: ['fever', 'cough', 'fatigue', 'lossTaste', 'lossSmell', 'shortnessBreath'],
    severity: 'sedang',
    advice: 'Lakukan isolasi mandiri dan konsultasi dengan dokter untuk tes lebih lanjut.',
  },
  {
    name: 'Demam Berdarah',
    symptoms: ['fever', 'headache', 'bodyAche', 'rash', 'nausea'],
    severity: 'serius',
    advice: 'Segera periksakan ke rumah sakit untuk pemeriksaan darah.',
  },
  {
    name: 'Gastroenteritis',
    symptoms: ['nausea', 'vomiting', 'diarrhea', 'fever', 'stomachPain'],
    severity: 'sedang',
    advice: 'Jaga hidrasi dengan minum cairan elektrolit dan makan makanan mudah dicerna.',
  },
  {
    name: 'Infeksi Saluran Pernapasan',
    symptoms: ['cough', 'soreThroat', 'runnyNose', 'fever', 'fatigue'],
    severity: 'ringan',
    advice: 'Istirahat, minum air hangat, dan gunakan pelembab udara.',
  },
];

export function DiseaseDetection({ onNavigate }: DiseaseDetectionProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [detectedDiseases, setDetectedDiseases] = useState<typeof diseases>([]);

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId)
        ? prev.filter((s) => s !== symptomId)
        : [...prev, symptomId]
    );
  };

  const analyzeSymptoms = () => {
    if (selectedSymptoms.length < 2) {
      toast.error('Mohon pilih minimal 2 gejala');
      return;
    }

    // Simple matching algorithm
    const matches = diseases
      .map((disease) => {
        const matchCount = disease.symptoms.filter((s) => selectedSymptoms.includes(s)).length;
        const matchPercentage = (matchCount / disease.symptoms.length) * 100;
        return { ...disease, matchPercentage };
      })
      .filter((d) => d.matchPercentage > 30)
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, 3);

    setDetectedDiseases(matches as typeof diseases);
    setShowResult(true);
    toast.success('Analisis gejala selesai!');
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'ringan':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'sedang':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'serius':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Disease <span className="text-green-500">Detection</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Deteksi penyakit berdasarkan gejala yang dialami</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Symptoms Selection */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                Pilih Gejala yang Anda Alami
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {symptoms.map((symptom) => {
                  const isSelected = selectedSymptoms.includes(symptom.id);
                  return (
                    <motion.button
                      key={symptom.id}
                      onClick={() => toggleSymptom(symptom.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`p-4 rounded-xl text-left transition-all ${
                        isSelected
                          ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? 'border-white bg-white' : 'border-gray-300 dark:border-gray-500'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-green-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{symptom.label}</p>
                          <p className={`text-xs ${isSelected ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'}`}>
                            {symptom.category}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Selected Count */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">
                  Gejala terpilih: <strong>{selectedSymptoms.length}</strong>
                </span>
                {selectedSymptoms.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedSymptoms([]);
                      setShowResult(false);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Analyze Button */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mt-6">
                <Button
                  onClick={analyzeSymptoms}
                  disabled={selectedSymptoms.length < 2}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-500 to-teal-400 hover:from-green-600 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-green-500/25 disabled:opacity-50"
                >
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Analisis Gejala
                </Button>
              </motion.div>
            </div>

            {/* Results Section */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Hasil Deteksi</h2>

                {detectedDiseases.length > 0 ? (
                  <div className="space-y-4">
                    {detectedDiseases.map((disease, index) => (
                      <motion.div
                        key={disease.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-xl border-2 ${getSeverityColor(disease.severity)}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg">{disease.name}</h3>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/50 dark:bg-white/10">
                            {disease.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm opacity-80 mb-2">{disease.advice}</p>
                        <div className="w-full bg-white/30 dark:bg-white/10 rounded-full h-2">
                          <div
                            className="bg-current h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(disease as any).matchPercentage}%` }}
                          />
                        </div>
                        <p className="text-xs mt-1 opacity-70">
                          Kecocokan: {(disease as any).matchPercentage.toFixed(0)}%
                        </p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Tidak ditemukan penyakit yang cocok dengan gejala Anda.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Silakan tambahkan lebih banyak gejala atau konsultasi dengan dokter.
                    </p>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    <strong>Peringatan:</strong> Hasil ini hanya prediksi berbasis AI dan tidak
                    menggantikan diagnosis medis profesional. Selalu konsultasikan dengan dokter
                    untuk kondisi kesehatan Anda.
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
                    title: 'Pilih Gejala',
                    desc: 'Pilih gejala yang Anda alami dari daftar yang tersedia.',
                  },
                  {
                    step: '2',
                    title: 'Analisis AI',
                    desc: 'Sistem mencocokkan gejala dengan database penyakit.',
                  },
                  {
                    step: '3',
                    title: 'Dapatkan Hasil',
                    desc: 'Lihat kemungkinan penyakit dan tingkat kecocokan.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tips</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Pilih semua gejala yang Anda rasakan</li>
                  <li>• Semakin banyak gejala, semakin akurat</li>
                  <li>• Konsultasi dokter untuk diagnosis pasti</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
