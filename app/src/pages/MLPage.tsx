import { motion } from 'framer-motion';
import { ArrowRight, Home, GraduationCap, Stethoscope, Image, Mail, CreditCard } from 'lucide-react';

interface MLPageProps {
  onNavigate: (page: string) => void;
}

const mlFeatures = [
  {
    id: 'house-price',
    title: 'House Price Prediction',
    description: 'Estimate property values based on location, size, amenities, and market trends using advanced regression models.',
    icon: Home,
    iconBg: 'bg-blue-500',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    tags: ['Location analysis', 'Size estimation', 'Market trends'],
    route: 'ml-house-price',
  },
  {
    id: 'spam',
    title: 'Spam Email Classifier',
    description: 'Automatically detect and classify spam emails with high accuracy using natural language processing.',
    icon: Mail,
    iconBg: 'bg-red-500',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    tags: ['Text analysis', 'Pattern detection', 'Real-time filtering'],
    route: 'ml-spam',
  },
  {
    id: 'grade',
    title: 'Student Grade Prediction',
    description: 'Predict academic performance based on study habits, attendance, and past scores.',
    icon: GraduationCap,
    iconBg: 'bg-green-500',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    tags: ['Performance tracking', 'Grade forecasting', 'Study recommendations'],
    route: 'ml-grade',
  },
  {
    id: 'disease',
    title: 'Disease Detection',
    description: 'Early detection of potential health issues based on symptoms and medical data.',
    icon: Stethoscope,
    iconBg: 'bg-purple-500',
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    tags: ['Symptom analysis', 'Risk assessment', 'Health insights'],
    route: 'ml-disease',
  },
  {
    id: 'fraud',
    title: 'Fraud Detection',
    description: 'Identify suspicious transactions and prevent financial fraud with real-time monitoring.',
    icon: CreditCard,
    iconBg: 'bg-orange-500',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    tags: ['Transaction monitoring', 'Anomaly detection', 'Risk scoring'],
    route: 'ml-fraud',
  },
  {
    id: 'art',
    title: 'AI Art Detection',
    description: 'Distinguish between AI-generated and human-created anime artwork.',
    icon: Image,
    iconBg: 'bg-pink-500',
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    tags: ['Image analysis', 'AI detection', 'Confidence scoring'],
    route: 'ml-art',
  },
];

export function MLPage({ onNavigate }: MLPageProps) {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            ML Prediction <span className="text-blue-500">Models</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Explore our collection of machine learning models designed to help you make better predictions and decisions across various domains.
          </p>
        </motion.div>

        {/* Features Grid - detailed cards like reference */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mlFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onClick={() => onNavigate(feature.route)}
              >
                {/* Header with icon and corner icon */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${feature.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${feature.iconColor}`} />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed">
                  {feature.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {feature.tags.map((tag, i) => (
                    <span 
                      key={i}
                      className="px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Try it now link */}
                <div className="flex items-center gap-1 text-blue-500 text-sm font-medium group-hover:gap-2 transition-all">
                  <span>Try it now</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
