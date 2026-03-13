import { motion } from 'framer-motion';
import { ArrowLeft, GraduationCap, Calculator, BookOpen, TrendingUp, Target } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface StudentGradePredictionProps {
  onNavigate: (page: string) => void;
}

const gradeScale = [
  { min: 85, grade: 'A', label: 'Sangat Baik', color: 'bg-green-500' },
  { min: 75, grade: 'B', label: 'Baik', color: 'bg-blue-500' },
  { min: 65, grade: 'C', label: 'Cukup', color: 'bg-yellow-500' },
  { min: 50, grade: 'D', label: 'Kurang', color: 'bg-orange-500' },
  { min: 0, grade: 'E', label: 'Sangat Kurang', color: 'bg-red-500' },
];

export function StudentGradePrediction({ onNavigate }: StudentGradePredictionProps) {
  const [scores, setScores] = useState({
    matematika: '',
    bahasa: '',
    english: '',
    science: '',
    history: '',
    attendance: '',
    assignment: '',
  });
  const [showResult, setShowResult] = useState(false);
  const [predictedGrade, setPredictedGrade] = useState('');
  const [averageScore, setAverageScore] = useState(0);

  const handlePredict = () => {
    const requiredFields = ['matematika', 'bahasa', 'english', 'science', 'history'];
    const emptyFields = requiredFields.filter((field) => !scores[field as keyof typeof scores]);

    if (emptyFields.length > 0) {
      toast.error('Mohon lengkapi semua nilai mata pelajaran');
      return;
    }

    const values = {
      matematika: parseFloat(scores.matematika) || 0,
      bahasa: parseFloat(scores.bahasa) || 0,
      english: parseFloat(scores.english) || 0,
      science: parseFloat(scores.science) || 0,
      history: parseFloat(scores.history) || 0,
      attendance: parseFloat(scores.attendance) || 100,
      assignment: parseFloat(scores.assignment) || 100,
    };

    const subjectAverage = (values.matematika + values.bahasa + values.english + values.science + values.history) / 5;
    const attendanceBonus = (values.attendance / 100) * 5;
    const assignmentBonus = (values.assignment / 100) * 5;

    const finalScore = Math.min(100, subjectAverage + attendanceBonus + assignmentBonus);
    const grade = gradeScale.find((g) => finalScore >= g.min);

    setAverageScore(finalScore);
    setPredictedGrade(grade?.grade || 'E');
    setShowResult(true);
    toast.success('Prediksi nilai berhasil dihitung!');
  };

  const radarData = [
    { subject: 'Matematika', score: parseFloat(scores.matematika) || 0 },
    { subject: 'Bahasa', score: parseFloat(scores.bahasa) || 0 },
    { subject: 'English', score: parseFloat(scores.english) || 0 },
    { subject: 'Science', score: parseFloat(scores.science) || 0 },
    { subject: 'History', score: parseFloat(scores.history) || 0 },
  ];

  const comparisonData = [
    { name: 'Nilai Anda', score: averageScore },
    { name: 'Rata-rata Kelas', score: 75 },
    { name: 'Target Minimum', score: 70 },
  ];

  const getGradeInfo = (grade: string) => gradeScale.find((g) => g.grade === grade);

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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Student Grade <span className="text-purple-500">Prediction</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Prediksi nilai akhir berdasarkan performa akademik</p>
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
                <BookOpen className="w-5 h-5 text-blue-500" />
                Nilai Mata Pelajaran
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Subject Scores */}
                {[
                  { key: 'matematika', label: 'Matematika', icon: Calculator },
                  { key: 'bahasa', label: 'Bahasa Indonesia', icon: BookOpen },
                  { key: 'english', label: 'Bahasa Inggris', icon: BookOpen },
                  { key: 'science', label: 'Ilmu Pengetahuan', icon: TrendingUp },
                  { key: 'history', label: 'Sejarah', icon: BookOpen },
                ].map((subject) => (
                  <div key={subject.key} className="space-y-2">
                    <Label htmlFor={subject.key} className="text-gray-700 dark:text-gray-300">
                      {subject.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={subject.key}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0-100"
                        value={scores[subject.key as keyof typeof scores]}
                        onChange={(e) =>
                          setScores({ ...scores, [subject.key]: e.target.value })
                        }
                        className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                      />
                      <subject.icon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                ))}

                {/* Attendance */}
                <div className="space-y-2">
                  <Label htmlFor="attendance" className="text-gray-700 dark:text-gray-300">
                    Kehadiran (%)
                  </Label>
                  <Input
                    id="attendance"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Contoh: 90"
                    value={scores.attendance}
                    onChange={(e) => setScores({ ...scores, attendance: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
                </div>

                {/* Assignment */}
                <div className="space-y-2">
                  <Label htmlFor="assignment" className="text-gray-700 dark:text-gray-300">
                    Nilai Tugas (%)
                  </Label>
                  <Input
                    id="assignment"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Contoh: 85"
                    value={scores.assignment}
                    onChange={(e) => setScores({ ...scores, assignment: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Predict Button */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mt-8">
                <Button
                  onClick={handlePredict}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-400 hover:from-purple-600 hover:to-pink-500 text-white rounded-xl shadow-lg shadow-purple-500/25"
                >
                  <Calculator className="w-5 h-5 mr-2" />
                  Prediksi Nilai
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Hasil Prediksi</h2>

                {/* Grade Display */}
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Prediksi Nilai Akhir</p>
                  <div className="flex items-center justify-center gap-4">
                    <div
                      className={`w-24 h-24 rounded-2xl ${
                        getGradeInfo(predictedGrade)?.color
                      } flex items-center justify-center`}
                    >
                      <span className="text-5xl font-bold text-white">{predictedGrade}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {averageScore.toFixed(1)}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">{getGradeInfo(predictedGrade)?.label}</p>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Radar Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Performa per Mata Pelajaran
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#374151" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <Radar
                            name="Nilai"
                            dataKey="score"
                            stroke="#8b5cf6"
                            fill="#8b5cf6"
                            fillOpacity={0.3}
                          />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Comparison Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Perbandingan
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="score" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* How It Works & Grade Scale Section */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="space-y-6">
              {/* How It Works */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Cara Kerja</h2>

                <div className="space-y-6">
                  {[
                    {
                      step: '1',
                      title: 'Input Nilai',
                      desc: 'Masukkan nilai untuk setiap mata pelajaran.',
                    },
                    {
                      step: '2',
                      title: 'Analisis AI',
                      desc: 'Sistem menghitung rata-rata dan memprediksi nilai akhir.',
                    },
                    {
                      step: '3',
                      title: 'Dapatkan Prediksi',
                      desc: 'Lihat prediksi nilai dan grade Anda.',
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">{item.step}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade Scale */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Skala Nilai
                </h2>

                <div className="space-y-2">
                  {gradeScale.map((grade) => (
                    <div
                      key={grade.grade}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${grade.color} flex items-center justify-center`}>
                          <span className="text-white font-bold text-sm">{grade.grade}</span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{grade.label}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">≥ {grade.min}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
