import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Alex Chen',
    avatar: '/images/avatar1.jpg',
    role: 'Anime Enthusiast',
    content: 'Lanna is absolutely amazing! The conversations feel so natural and the character personalities are spot on. Sparkle is my favorite!',
    rating: 5,
  },
  {
    name: 'Sarah Kim',
    avatar: '/images/avatar2.jpg',
    role: 'Digital Artist',
    content: 'I use the image generation feature almost every day. It helps me brainstorm character designs and explore new ideas. Highly recommended!',
    rating: 5,
  },
  {
    name: 'Mike Tanaka',
    avatar: '/images/avatar3.jpg',
    role: 'Student',
    content: 'The ML prediction features are surprisingly accurate. I used the grade predictor to improve my study habits and it actually worked!',
    rating: 5,
  },
  {
    name: 'Emily Wang',
    avatar: '/images/avatar1.jpg',
    role: 'Software Developer',
    content: 'As a developer, I appreciate how smooth and responsive the UI is. The theme switching is seamless and the animations are beautiful.',
    rating: 5,
  },
  {
    name: 'David Park',
    avatar: '/images/avatar2.jpg',
    role: 'Content Creator',
    content: 'Furina has such a gentle personality. Whenever I need someone to talk to, shes always there with kind and supportive words.',
    rating: 5,
  },
  {
    name: 'Lisa Yamamoto',
    avatar: '/images/avatar3.jpg',
    role: 'Teacher',
    content: 'I introduced Lanna to my students and they love it! Its a great way to engage with AI technology in a fun and safe environment.',
    rating: 5,
  },
];

export function Testimonials() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  // Split testimonials into two rows
  const row1 = testimonials.slice(0, 3);
  const row2 = testimonials.slice(3, 6);

  return (
    <section ref={containerRef} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Star className="w-4 h-4 inline mr-1" />
            Testimonials
          </span>
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ fontFamily: "'M PLUS Rounded 1c', sans-serif" }}
          >
            <span className="text-gradient">What Users</span>
            <br />
            <span className="text-foreground">Say About Lanna</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of happy users who have found their perfect AI companion
          </p>
        </motion.div>

        {/* Testimonials marquee */}
        <div className="space-y-6">
          {/* Row 1 - moves left */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative overflow-hidden"
          >
            <motion.div
              className="flex gap-6"
              animate={{ x: [0, -50 * row1.length * 2] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: 'loop',
                  duration: 30,
                  ease: 'linear',
                },
              }}
            >
              {[...row1, ...row1, ...row1, ...row1].map((testimonial, index) => (
                <TestimonialCard key={`row1-${index}`} testimonial={testimonial} />
              ))}
            </motion.div>
          </motion.div>

          {/* Row 2 - moves right */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="relative overflow-hidden"
          >
            <motion.div
              className="flex gap-6"
              animate={{ x: [-50 * row2.length * 2, 0] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: 'loop',
                  duration: 35,
                  ease: 'linear',
                },
              }}
            >
              {[...row2, ...row2, ...row2, ...row2].map((testimonial, index) => (
                <TestimonialCard key={`row2-${index}`} testimonial={testimonial} />
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

interface TestimonialCardProps {
  testimonial: typeof testimonials[0];
}

function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      className="flex-shrink-0 w-[350px] p-6 rounded-2xl glass-card group"
    >
      {/* Quote icon */}
      <Quote className="w-8 h-8 text-primary/30 mb-4" />

      {/* Content */}
      <p className="text-foreground/90 mb-4 leading-relaxed">
        "{testimonial.content}"
      </p>

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {[...Array(testimonial.rating)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>

      {/* Author */}
      <div className="flex items-center gap-3">
        <img
          src={testimonial.avatar}
          alt={testimonial.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <div className="font-medium text-foreground">{testimonial.name}</div>
          <div className="text-sm text-muted-foreground">{testimonial.role}</div>
        </div>
      </div>
    </motion.div>
  );
}
