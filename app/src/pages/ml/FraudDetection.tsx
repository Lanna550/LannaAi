import { motion } from 'framer-motion';
import { ArrowLeft, Shield, CreditCard, AlertTriangle, CheckCircle, DollarSign, Clock, MapPin, Send } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface FraudDetectionProps {
  onNavigate: (page: string) => void;
}

const riskFactors = [
  { name: 'Jumlah Transaksi', value: 25, color: '#ef4444' },
  { name: 'Waktu Transaksi', value: 20, color: '#f59e0b' },
  { name: 'Lokasi', value: 30, color: '#3b82f6' },
  { name: 'Frekuensi', value: 15, color: '#8b5cf6' },
  { name: 'Metode', value: 10, color: '#10b981' },
];

export function FraudDetection({ onNavigate }: FraudDetectionProps) {
  const [formData, setFormData] = useState({
    amount: '',
    merchant: '',
    location: '',
    time: '',
    cardType: '',
    previousTransactions: '',
  });
  const [showResult, setShowResult] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [isFraudulent, setIsFraudulent] = useState(false);

  const analyzeTransaction = () => {
    if (!formData.amount || !formData.merchant || !formData.location) {
      toast.error('Mohon lengkapi data transaksi');
      return;
    }

    const amount = parseFloat(formData.amount);
    let score = 0;

    // Amount risk
    if (amount > 10000000) score += 30;
    else if (amount > 5000000) score += 20;
    else if (amount > 1000000) score += 10;

    // Time risk (simplified - transactions at odd hours)
    const hour = parseInt(formData.time.split(':')[0]) || 12;
    if (hour < 6 || hour > 23) score += 15;

    // Location risk
    const suspiciousLocations = ['Luar Negeri', 'Online - Tidak Dikenal'];
    if (suspiciousLocations.includes(formData.location)) score += 25;

    // Frequency risk
    const freq = parseInt(formData.previousTransactions) || 0;
    if (freq > 10) score += 10;

    // Card type risk
    if (formData.cardType === 'Debit') score += 5;

    setRiskScore(Math.min(100, score));
    setIsFraudulent(score > 50);
    setShowResult(true);
    toast.success('Analisis transaksi selesai!');
  };

  const chartData = [
    { name: 'Risiko', value: riskScore, color: '#ef4444' },
    { name: 'Aman', value: 100 - riskScore, color: '#22c55e' },
  ];

  const comparisonData = [
    { name: 'Transaksi Ini', score: riskScore },
    { name: 'Rata-rata', score: 25 },
    { name: 'Batas Aman', score: 50 },
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-400 flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Fraud <span className="text-orange-500">Detection</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Deteksi penipuan transaksi dengan AI</p>
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
                <CreditCard className="w-5 h-5 text-blue-500" />
                Detail Transaksi
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-gray-700 dark:text-gray-300">
                    Jumlah Transaksi (Rp)
                  </Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Contoh: 5000000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <DollarSign className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Merchant */}
                <div className="space-y-2">
                  <Label htmlFor="merchant" className="text-gray-700 dark:text-gray-300">
                    Nama Merchant
                  </Label>
                  <Input
                    id="merchant"
                    placeholder="Contoh: Toko ABC"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-gray-700 dark:text-gray-300">
                    Lokasi Transaksi
                  </Label>
                  <div className="relative">
                    <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                    <select
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Pilih Lokasi</option>
                      <option value="Jakarta">Jakarta</option>
                      <option value="Bandung">Bandung</option>
                      <option value="Surabaya">Surabaya</option>
                      <option value="Luar Negeri">Luar Negeri</option>
                      <option value="Online - Dikenal">Online - Merchant Dikenal</option>
                      <option value="Online - Tidak Dikenal">Online - Merchant Tidak Dikenal</option>
                    </select>
                  </div>
                </div>

                {/* Time */}
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-gray-700 dark:text-gray-300">
                    Waktu Transaksi
                  </Label>
                  <div className="relative">
                    <Clock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                  </div>
                </div>

                {/* Card Type */}
                <div className="space-y-2">
                  <Label htmlFor="cardType" className="text-gray-700 dark:text-gray-300">
                    Jenis Kartu
                  </Label>
                  <select
                    id="cardType"
                    value={formData.cardType}
                    onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Pilih Jenis Kartu</option>
                    <option value="Credit">Kredit</option>
                    <option value="Debit">Debit</option>
                    <option value="Prepaid">Prabayar</option>
                  </select>
                </div>

                {/* Previous Transactions */}
                <div className="space-y-2">
                  <Label htmlFor="previousTransactions" className="text-gray-700 dark:text-gray-300">
                    Jumlah Transaksi Hari Ini
                  </Label>
                  <Input
                    id="previousTransactions"
                    type="number"
                    placeholder="Contoh: 3"
                    value={formData.previousTransactions}
                    onChange={(e) => setFormData({ ...formData, previousTransactions: e.target.value })}
                    className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Analyze Button */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} className="mt-8">
                <Button
                  onClick={analyzeTransaction}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-orange-500 to-red-400 hover:from-orange-600 hover:to-red-500 text-white rounded-xl shadow-lg shadow-orange-500/25"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Analisis Transaksi
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Hasil Analisis</h2>

                {/* Risk Badge */}
                <div className="flex justify-center mb-6">
                  <div
                    className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl ${
                      isFraudulent
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    }`}
                  >
                    {isFraudulent ? (
                      <>
                        <AlertTriangle className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">TERDETEKSI RISIKO</p>
                          <p className="text-sm">Transaksi mencurigakan</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-8 h-8" />
                        <div>
                          <p className="text-2xl font-bold">AMAN</p>
                          <p className="text-sm">Transaksi tampak normal</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Risk Score */}
                <div className="text-center mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Skor Risiko</p>
                  <p
                    className={`text-5xl font-bold ${
                      riskScore > 70 ? 'text-red-500' : riskScore > 40 ? 'text-yellow-500' : 'text-green-500'
                    }`}
                  >
                    {riskScore}%
                  </p>
                </div>

                {/* Charts */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Risk Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Tingkat Risiko
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
                  </div>

                  {/* Comparison */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">
                      Perbandingan Risiko
                    </h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                          <Bar dataKey="score" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Risk Factors */}
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Faktor Risiko</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {riskFactors.map((factor) => (
                      <div key={factor.name} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: factor.color }}
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{factor.name}</span>
                      </div>
                    ))}
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
                    title: 'Input Data',
                    desc: 'Masukkan detail transaksi yang ingin dianalisis.',
                  },
                  {
                    step: '2',
                    title: 'Analisis AI',
                    desc: 'Sistem menganalisis pola dan faktor risiko transaksi.',
                  },
                  {
                    step: '3',
                    title: 'Dapatkan Hasil',
                    desc: 'Lihat skor risiko dan rekomendasi tindakan.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ciri-ciri Fraud</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Jumlah transaksi tidak biasa</li>
                  <li>• Lokasi mencurigakan</li>
                  <li>• Waktu transaksi aneh</li>
                  <li>• Frekuensi tinggi</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
