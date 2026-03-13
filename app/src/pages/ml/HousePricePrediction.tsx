import { motion } from 'framer-motion';
import { ArrowLeft, Home, Calculator, TrendingUp, MapPin, Bed, Bath, Calendar, Check } from 'lucide-react';
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

interface HousePricePredictionProps {
  onNavigate: (page: string) => void;
}

const locations = [
  'Jakarta Pusat',
  'Jakarta Selatan',
  'Jakarta Barat',
  'Jakarta Timur',
  'Jakarta Utara',
  'Bandung',
  'Surabaya',
  'Yogyakarta',
];

const facilities = [
  'Garasi',
  'Kolam Renang',
  'Taman',
  'Keamanan 24 Jam',
  'AC',
  'Water Heater',
  'Internet',
];

export function HousePricePrediction({ onNavigate }: HousePricePredictionProps) {
  const [formData, setFormData] = useState({
    landSize: '',
    buildingSize: '',
    bedrooms: '',
    bathrooms: '',
    location: '',
    age: '',
    selectedFacilities: [] as string[],
  });
  const [showResult, setShowResult] = useState(false);
  const [prediction, setPrediction] = useState<number | null>(null);

  const handleFacilityToggle = (facility: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedFacilities: prev.selectedFacilities.includes(facility)
        ? prev.selectedFacilities.filter((f) => f !== facility)
        : [...prev.selectedFacilities, facility],
    }));
  };

  const handlePredict = () => {
    if (!formData.landSize || !formData.buildingSize || !formData.location) {
      toast.error('Mohon lengkapi data yang diperlukan');
      return;
    }

    // Simulate prediction calculation
    const basePrice = 5000000;
    const landValue = parseInt(formData.landSize) * 2500000;
    const buildingValue = parseInt(formData.buildingSize) * 3500000;
    const bedroomValue = parseInt(formData.bedrooms || '0') * 50000000;
    const bathroomValue = parseInt(formData.bathrooms || '0') * 30000000;
    const facilityValue = formData.selectedFacilities.length * 25000000;
    const ageDiscount = parseInt(formData.age || '0') * 10000000;

    const locationMultiplier = {
      'Jakarta Pusat': 1.5,
      'Jakarta Selatan': 1.4,
      'Jakarta Barat': 1.2,
      'Jakarta Timur': 1.1,
      'Jakarta Utara': 1.3,
      'Bandung': 0.9,
      'Surabaya': 0.85,
      'Yogyakarta': 0.8,
    }[formData.location] || 1;

    const totalPrice = Math.round(
      (basePrice + landValue + buildingValue + bedroomValue + bathroomValue + facilityValue - ageDiscount) *
        locationMultiplier
    );

    setPrediction(totalPrice);
    setShowResult(true);
    toast.success('Prediksi harga berhasil dihitung!');
  };

  const priceFactors = [
    { name: 'Luas Tanah', value: 35, color: '#3b82f6' },
    { name: 'Luas Bangunan', value: 30, color: '#06b6d4' },
    { name: 'Lokasi', value: 20, color: '#8b5cf6' },
    { name: 'Fasilitas', value: 10, color: '#ec4899' },
    { name: 'Umur', value: 5, color: '#f59e0b' },
  ];

  const comparisonData = [
    { name: 'Rata-rata Area', price: prediction ? prediction * 0.85 : 0 },
    { name: 'Prediksi Anda', price: prediction || 0 },
    { name: 'Premium Area', price: prediction ? prediction * 1.2 : 0 },
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Home className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                House Price <span className="text-blue-500">Prediction</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">Prediksi harga rumah berdasarkan spesifikasi properti</p>
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
                <Calculator className="w-5 h-5 text-blue-500" />
                Detail Properti
              </h2>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Land Size */}
                <div className="space-y-2">
                  <Label htmlFor="landSize" className="text-gray-700 dark:text-gray-300">
                    Luas Tanah (m²)
                  </Label>
                  <div className="relative">
                    <Input
                      id="landSize"
                      type="number"
                      placeholder="Contoh: 150"
                      value={formData.landSize}
                      onChange={(e) => setFormData({ ...formData, landSize: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <TrendingUp className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Building Size */}
                <div className="space-y-2">
                  <Label htmlFor="buildingSize" className="text-gray-700 dark:text-gray-300">
                    Luas Bangunan (m²)
                  </Label>
                  <div className="relative">
                    <Input
                      id="buildingSize"
                      type="number"
                      placeholder="Contoh: 120"
                      value={formData.buildingSize}
                      onChange={(e) => setFormData({ ...formData, buildingSize: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <Home className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Bedrooms */}
                <div className="space-y-2">
                  <Label htmlFor="bedrooms" className="text-gray-700 dark:text-gray-300">
                    Kamar Tidur
                  </Label>
                  <div className="relative">
                    <Input
                      id="bedrooms"
                      type="number"
                      placeholder="Contoh: 3"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <Bed className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Bathrooms */}
                <div className="space-y-2">
                  <Label htmlFor="bathrooms" className="text-gray-700 dark:text-gray-300">
                    Kamar Mandi
                  </Label>
                  <div className="relative">
                    <Input
                      id="bathrooms"
                      type="number"
                      placeholder="Contoh: 2"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <Bath className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="location" className="text-gray-700 dark:text-gray-300">
                    Lokasi
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
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Building Age */}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="age" className="text-gray-700 dark:text-gray-300">
                    Umur Bangunan (tahun)
                  </Label>
                  <div className="relative">
                    <Input
                      id="age"
                      type="number"
                      placeholder="Contoh: 5"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="pl-10 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                    <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Facilities */}
                <div className="sm:col-span-2">
                  <Label className="text-gray-700 dark:text-gray-300 mb-3 block">Fasilitas</Label>
                  <div className="flex flex-wrap gap-2">
                    {facilities.map((facility) => (
                      <button
                        key={facility}
                        onClick={() => handleFacilityToggle(facility)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.selectedFacilities.includes(facility)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {formData.selectedFacilities.includes(facility) && (
                            <Check className="w-3 h-3" />
                          )}
                          {facility}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Predict Button */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="mt-8"
              >
                <Button
                  onClick={handlePredict}
                  className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white rounded-xl shadow-lg shadow-blue-500/25"
                >
                  <Calculator className="w-5 h-5 mr-2" />
                  Prediksi Harga
                </Button>
              </motion.div>
            </div>

            {/* Results Section */}
            {showResult && prediction && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-6 bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-card border border-gray-100 dark:border-gray-700"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Hasil Prediksi</h2>

                {/* Price Display */}
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl mb-6">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Estimasi Harga Rumah</p>
                  <p className="text-4xl sm:text-5xl font-bold text-blue-500">
                    Rp {prediction.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Charts */}
                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Price Factors */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Faktor Harga</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={priceFactors}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            dataKey="value"
                          >
                            {priceFactors.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {priceFactors.map((factor) => (
                        <div key={factor.name} className="flex items-center gap-1 text-xs">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: factor.color }}
                          />
                          <span className="text-gray-600 dark:text-gray-400">{factor.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comparison */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Perbandingan Harga</h3>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                          <Tooltip
                            formatter={(value: number) =>
                              `Rp ${value.toLocaleString('id-ID')}`
                            }
                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                          />
                          <Bar dataKey="price" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
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
                    title: 'Masukkan Data',
                    desc: 'Isi detail properti seperti luas tanah, bangunan, lokasi, dan fasilitas.',
                  },
                  {
                    step: '2',
                    title: 'Analisis AI',
                    desc: 'Sistem ML kami menganalisis data dengan model prediksi harga rumah.',
                  },
                  {
                    step: '3',
                    title: 'Dapatkan Estimasi',
                    desc: 'Terima estimasi harga dengan visualisasi faktor yang mempengaruhi.',
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tips</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Semakin detail data, semakin akurat prediksi</li>
                  <li>• Lokasi sangat mempengaruhi harga</li>
                  <li>• Fasilitas premium meningkatkan nilai</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
