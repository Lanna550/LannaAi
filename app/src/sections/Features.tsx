import { motion } from 'framer-motion';
import { MessageSquare, Image, Brain, Download } from 'lucide-react';

const features = [
  {
    image: 'images/feature_chat.png',
    icon: MessageSquare,
    iconBg: 'bg-blue-500',
    title: 'Smart Conversations',
    description: 'Engage in natural, context-aware conversations that feel human and meaningful.',
  },
  {
    image: 'images/feature_image.png',
    icon: Image,
    iconBg: 'bg-purple-500',
    title: 'Image Generation',
    description: 'Create stunning anime-style images with just a text description.',
  },
  {
    image: 'images/feature_ml.png',
    icon: Brain,
    iconBg: 'bg-orange-500',
    title: 'ML Predictions',
    description: 'Access powerful machine learning models for various prediction tasks.',
  },
  {
    image: 'images/feature_image.png',
    icon: Download,
    iconBg: 'bg-emerald-500',
    title: 'Tiktok Downloader',
    description: 'Download TikTok videos without watermark quickly using a share link.',
  },
];

export function Features() {
  return (
    <section className="py-24 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Powered by <span className="text-gradient-blue">Advanced Intelligence</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Discover the amazing features that make Lanna your perfect AI companion
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -8 }}
                className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100 dark:border-gray-700"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
