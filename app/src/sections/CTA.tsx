import { motion } from 'framer-motion';
import { ArrowRight, Shield, Star, Heart } from 'lucide-react';

interface CTAProps {
  onNavigate: (page: string) => void;
}

export function CTA({ onNavigate }: CTAProps) {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-sky-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Meet <span className="text-gradient">Lanna</span>?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Join thousands of users exploring the future of AI interaction. Start your journey with Lanna today!
          </p>

          <motion.button
            onClick={() => onNavigate('register')}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-medium text-lg shadow-lg shadow-blue-500/25"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowRight className="w-5 h-5" />
            Get Started Free
          </motion.button>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mt-10">
            {[
              { icon: Shield, text: 'Secure' },
              { icon: Star, text: 'Free Forever' },
              { icon: Heart, text: 'Loved by Users' },
            ].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <badge.icon className="w-4 h-4" />
                <span className="text-sm">{badge.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
