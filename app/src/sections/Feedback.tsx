import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  Zap, 
  Percent,
  Star,
  Send,
  Heart
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function Feedback() {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section className="py-14 sm:py-20 lg:py-24 bg-white dark:bg-gray-900 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium mb-4">
            <MessageSquare className="w-4 h-4" />
            Feedback
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Your Opinion <span className="text-gradient-blue">Matters</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Help us improve Lanna by sharing your thoughts, suggestions, or reporting issues.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
          {/* Feedback Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-6">
              <Heart className="w-5 h-5 text-pink-500" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Send Feedback</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Your Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  className="mt-1 w-full min-w-0 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-sm sm:text-base"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="maulanapermana550@gmail.com"
                  className="mt-1 w-full min-w-0 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-sm sm:text-base"
                />
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300">Rate Your Experience</Label>
                <div className="flex gap-1.5 sm:gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-5 h-5 sm:w-6 sm:h-6 ${
                          star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="message" className="text-gray-700 dark:text-gray-300">Your Message <span className="text-red-500">*</span></Label>
                <Textarea
                  id="message"
                  placeholder="Share your thoughts, suggestions, or report issues..."
                  className="mt-1 min-h-[110px] sm:min-h-[120px] w-full min-w-0 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-sm sm:text-base"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-sm sm:text-base"
              >
                {submitted ? (
                  'Thank you for your feedback!'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
            </form>
          </motion.div>

          {/* Contact Developer */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* WhatsApp Contact */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <Phone className="w-5 h-5 text-green-500" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Contact Developer</h3>
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
                Need immediate assistance? Contact our developer directly via WhatsApp for quick support.
              </p>
              <a
                href="https://wa.me/6285167125317"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 rounded-xl bg-green-500 text-white text-sm sm:text-base font-medium hover:bg-green-600 transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                Chat on WhatsApp
              </a>

              {/* Developer Support Card */}
              <div className="mt-4 p-3 sm:p-4 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">Developer Support</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 break-all">+62 851-6712-5317</div>
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Online
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-100 dark:border-gray-700 shadow-card overflow-hidden">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Links</h3>
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-700 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">Email Support</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 break-all">support maulanapermana550@gmail.com</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { icon: Clock, value: '24/7', label: 'Support' },
                { icon: Zap, value: '<1hr', label: 'Response' },
                { icon: Percent, value: '100%', label: 'Free' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-100 dark:border-gray-700 text-center"
                >
                  <div className="text-lg sm:text-2xl font-bold text-blue-500">{stat.value}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
