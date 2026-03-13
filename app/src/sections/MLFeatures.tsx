import { motion } from 'framer-motion';
import { ArrowRight, Home, Shield, GraduationCap, Stethoscope, Image } from 'lucide-react';

interface MLFeaturesProps {
  onNavigate: (page: string) => void;
}

const mlFeatures = [
  {
    id: 'house-price',
    title: 'House Price Prediction',
    description: 'Estimate property values accurately',
    icon: Home,
    iconBg: 'bg-blue-500',
    route: 'ml-house-price',
  },
  {
    id: 'spam',
    title: 'Spam Classification',
    description: 'Detect spam emails instantly',
    icon: Shield,
    iconBg: 'bg-red-500',
    route: 'ml-spam',
  },
  {
    id: 'grade',
    title: 'Student Grade Prediction',
    description: 'Predict academic performance',
    icon: GraduationCap,
    iconBg: 'bg-purple-500',
    route: 'ml-grade',
  },
  {
    id: 'disease',
    title: 'Disease Detection',
    description: 'Early symptom analysis',
    icon: Stethoscope,
    iconBg: 'bg-green-500',
    route: 'ml-disease',
  },
  {
    id: 'fraud',
    title: 'Fraud Detection',
    description: 'Secure transaction monitoring',
    icon: Shield,
    iconBg: 'bg-orange-500',
    route: 'ml-fraud',
  },
  {
    id: 'art',
    title: 'AI Art Detection',
    description: 'Distinguish AI from human art',
    icon: Image,
    iconBg: 'bg-pink-500',
    route: 'ml-art',
  },
];

export function MLFeatures({ onNavigate }: MLFeaturesProps) {
  return (
    <section className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Machine Learning <span className="text-blue-500">Power</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Access cutting-edge ML models for various prediction and classification tasks
          </p>
        </motion.div>

        {/* Features grid - compact style like reference */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mlFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => onNavigate(feature.route)}
                className="group cursor-pointer bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg ${feature.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Explore button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center mt-10"
        >
          <motion.button
            onClick={() => onNavigate('ml')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium shadow-lg shadow-blue-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Explore All Features
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
