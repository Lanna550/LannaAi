import { motion } from 'framer-motion';

const companions = [
  {
    name: 'Miku',
    title: 'The Friendly Assistant',
    description: 'Your cheerful companion for everyday conversations and general assistance.',
    image: 'images/hatsune_miku.png',
    tags: ['Friendly', 'Helpful', 'Cheerful'],
    tagColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  },
 {
  name: 'Sparkle',
  title: 'Visual Creation AI',
  description: 'Expert in prompt-to-image generation, producing illustrations, artworks, and creative visual concepts.',
  image: 'images/sparkle_portrait.png',
  tags: ['Image', 'Art', 'Generation'],
  tagColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
},
  {
  name: 'Furina',
  title: 'AI Coding Specialist',
  description: 'Specialized in programming, debugging, code optimization, and software development.',
  image: 'images/furina_potrait.png',
  tags: ['Coding', 'Debugging', 'Development'],
  tagColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
},
];

interface CompanionsProps {
  onNavigate: (page: string) => void;
}

export function Companions({ onNavigate }: CompanionsProps) {
  return (
    <section className="py-24 bg-gradient-to-b from-sky-50 to-white dark:from-gray-800 dark:to-gray-900">
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
            Choose Your <span className="text-gradient">Companion</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Each AI model has its own unique personality and specialties
          </p>
        </motion.div>

        {/* Companions grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {companions.map((companion, index) => (
            <motion.div
              key={companion.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -8 }}
              onClick={() => onNavigate('chat')}
              className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700"
            >
              {/* Image */}
              <div className="relative h-64 overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-700 dark:to-gray-800">
                <img
                  src={companion.image}
                  alt={companion.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {companion.name}
                </h3>
                <p className={`text-sm font-medium mb-3 ${
                  index === 0 ? 'text-blue-500 dark:text-blue-400' : 
                  index === 1 ? 'text-purple-500 dark:text-purple-400' : 'text-orange-500 dark:text-orange-400'
                }`}>
                  {companion.title}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {companion.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {companion.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${companion.tagColor}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
