import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Mail, 
  GraduationCap, 
  Stethoscope, 
  ShieldAlert, 
  Image,
  ArrowRight,
  Calculator,
  CheckCircle,
  AlertTriangle,
  Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface MLFeature {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  gradient: string;
  inputs: { name: string; label: string; type: string; placeholder: string; min?: number; max?: number }[];
  predict: (inputs: Record<string, string>) => { result: string; confidence: number; details: string };
}

const mlFeatures: MLFeature[] = [
  {
    id: 'house',
    icon: Home,
    title: 'House Price Prediction',
    description: 'Predict property values based on location, size, and features using advanced regression models.',
    color: 'text-blue-500',
    gradient: 'from-blue-500 to-cyan-400',
    inputs: [
      { name: 'size', label: 'House Size (sq ft)', type: 'number', placeholder: 'e.g., 2000', min: 500, max: 10000 },
      { name: 'bedrooms', label: 'Bedrooms', type: 'number', placeholder: 'e.g., 3', min: 1, max: 10 },
      { name: 'location', label: 'Location Score (1-10)', type: 'number', placeholder: 'e.g., 7', min: 1, max: 10 },
    ],
    predict: (inputs) => {
      const size = parseInt(inputs.size) || 1500;
      const bedrooms = parseInt(inputs.bedrooms) || 3;
      const location = parseInt(inputs.location) || 5;
      const price = Math.round((size * 200 + bedrooms * 25000 + location * 50000) / 1000) * 1000;
      return {
        result: `$${price.toLocaleString()}`,
        confidence: 87,
        details: `Based on ${size} sq ft, ${bedrooms} bedrooms, and location score ${location}/10`,
      };
    },
  },
  {
    id: 'spam',
    icon: Mail,
    title: 'Email Spam Detection',
    description: 'Classify emails as spam or legitimate using natural language processing techniques.',
    color: 'text-red-500',
    gradient: 'from-red-500 to-pink-400',
    inputs: [
      { name: 'subject', label: 'Email Subject', type: 'text', placeholder: 'Enter email subject...' },
      { name: 'content', label: 'Email Content', type: 'text', placeholder: 'Enter email content preview...' },
    ],
    predict: (inputs) => {
      const spamWords = ['winner', 'free', 'click here', 'urgent', 'limited time', 'congratulations'];
      const text = `${inputs.subject} ${inputs.content}`.toLowerCase();
      const spamScore = spamWords.filter(word => text.includes(word)).length;
      const isSpam = spamScore >= 2 || text.includes('$$$') || text.includes('!!!');
      return {
        result: isSpam ? 'SPAM Detected' : 'Legitimate Email',
        confidence: isSpam ? 92 : 88,
        details: isSpam 
          ? 'Multiple spam indicators detected in the content analysis.' 
          : 'No significant spam patterns detected. Email appears safe.',
      };
    },
  },
  {
    id: 'grades',
    icon: GraduationCap,
    title: 'Student Grade Prediction',
    description: 'Forecast academic performance based on study habits, attendance, and past scores.',
    color: 'text-green-500',
    gradient: 'from-green-500 to-emerald-400',
    inputs: [
      { name: 'attendance', label: 'Attendance (%)', type: 'number', placeholder: 'e.g., 85', min: 0, max: 100 },
      { name: 'studyHours', label: 'Study Hours/Week', type: 'number', placeholder: 'e.g., 15', min: 0, max: 100 },
      { name: 'previousGrade', label: 'Previous Grade (0-100)', type: 'number', placeholder: 'e.g., 75', min: 0, max: 100 },
    ],
    predict: (inputs) => {
      const attendance = parseInt(inputs.attendance) || 80;
      const studyHours = parseInt(inputs.studyHours) || 10;
      const previousGrade = parseInt(inputs.previousGrade) || 70;
      const predictedGrade = Math.min(100, Math.round(
        previousGrade * 0.4 + (attendance * 0.4) + (studyHours * 1.5)
      ));
      const letterGrade = predictedGrade >= 90 ? 'A' : predictedGrade >= 80 ? 'B' : predictedGrade >= 70 ? 'C' : predictedGrade >= 60 ? 'D' : 'F';
      return {
        result: `${letterGrade} (${predictedGrade}%)`,
        confidence: 84,
        details: `Predicted based on ${attendance}% attendance, ${studyHours} study hours/week, and previous grade ${previousGrade}%`,
      };
    },
  },
  {
    id: 'medical',
    icon: Stethoscope,
    title: 'Medical Diagnosis Assistant',
    description: 'Get preliminary health insights based on symptoms and vital signs.',
    color: 'text-purple-500',
    gradient: 'from-purple-500 to-violet-400',
    inputs: [
      { name: 'age', label: 'Age', type: 'number', placeholder: 'e.g., 30', min: 1, max: 120 },
      { name: 'symptoms', label: 'Main Symptoms', type: 'text', placeholder: 'e.g., fever, headache' },
      { name: 'duration', label: 'Duration (days)', type: 'number', placeholder: 'e.g., 3', min: 1, max: 365 },
    ],
    predict: (inputs) => {
      const symptoms = inputs.symptoms.toLowerCase();
      const hasFever = symptoms.includes('fever') || symptoms.includes('hot');
      const hasCough = symptoms.includes('cough');
      const hasHeadache = symptoms.includes('headache');
      
      if (hasFever && hasCough) {
        return {
          result: 'Possible Respiratory Infection',
          confidence: 78,
          details: 'Fever combined with cough may indicate a respiratory condition. Please consult a doctor.',
        };
      } else if (hasHeadache && hasFever) {
        return {
          result: 'Possible Viral Infection',
          confidence: 72,
          details: 'Headache with fever is commonly associated with viral infections. Rest and hydration recommended.',
        };
      }
      return {
        result: 'Mild Condition Likely',
        confidence: 65,
        details: 'Symptoms appear mild. Monitor your condition and consult a doctor if symptoms worsen.',
      };
    },
  },
  {
    id: 'fraud',
    icon: ShieldAlert,
    title: 'Fraud Detection',
    description: 'Identify suspicious banking transactions using anomaly detection algorithms.',
    color: 'text-orange-500',
    gradient: 'from-orange-500 to-amber-400',
    inputs: [
      { name: 'amount', label: 'Transaction Amount ($)', type: 'number', placeholder: 'e.g., 500', min: 1 },
      { name: 'location', label: 'Location (same as usual?)', type: 'text', placeholder: 'yes or no' },
      { name: 'time', label: 'Time (24h format)', type: 'text', placeholder: 'e.g., 14:30' },
    ],
    predict: (inputs) => {
      const amount = parseInt(inputs.amount) || 100;
      const unusualLocation = inputs.location.toLowerCase() === 'no';
      const hour = parseInt(inputs.time.split(':')[0]) || 12;
      const isNight = hour < 6 || hour > 23;
      
      const riskScore = (amount > 1000 ? 30 : 0) + (unusualLocation ? 40 : 0) + (isNight ? 20 : 0);
      
      if (riskScore >= 50) {
        return {
          result: 'High Risk - Potential Fraud',
          confidence: 89,
          details: `Risk score: ${riskScore}/100. Multiple suspicious factors detected. Recommend verification.`,
        };
      } else if (riskScore >= 20) {
        return {
          result: 'Medium Risk - Review Recommended',
          confidence: 76,
          details: `Risk score: ${riskScore}/100. Some unusual patterns detected.`,
        };
      }
      return {
        result: 'Low Risk - Transaction Normal',
        confidence: 94,
        details: `Risk score: ${riskScore}/100. Transaction appears legitimate.`,
      };
    },
  },
  {
    id: 'anime',
    icon: Image,
    title: 'Anime Image Detection',
    description: 'Distinguish between human-created and AI-generated anime artwork.',
    color: 'text-pink-500',
    gradient: 'from-pink-500 to-rose-400',
    inputs: [
      { name: 'imageUrl', label: 'Image URL (optional)', type: 'text', placeholder: 'Paste image URL...' },
      { name: 'style', label: 'Art Style Description', type: 'text', placeholder: 'e.g., detailed shading, smooth lines' },
    ],
    predict: (inputs) => {
      const style = inputs.style.toLowerCase();
      const aiIndicators = ['perfect symmetry', 'uncanny valley', 'repetitive patterns', 'overly smooth'];
      const humanIndicators = ['sketch lines', 'inconsistent shading', 'unique style', 'rough edges'];
      
      const aiScore = aiIndicators.filter(i => style.includes(i)).length;
      const humanScore = humanIndicators.filter(i => style.includes(i)).length;
      
      if (aiScore > humanScore) {
        return {
          result: 'Likely AI-Generated',
          confidence: 82,
          details: 'Several characteristics typical of AI-generated artwork detected.',
        };
      } else if (humanScore > aiScore) {
        return {
          result: 'Likely Human-Created',
          confidence: 79,
          details: 'Artistic elements suggest human creation with unique style.',
        };
      }
      return {
        result: 'Inconclusive - Further Analysis Needed',
        confidence: 55,
        details: 'Unable to determine with high confidence. Professional review recommended.',
      };
    },
  },
];

export function MLPredictions() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });
  const [selectedFeature, setSelectedFeature] = useState<MLFeature | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ result: string; confidence: number; details: string } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePredict = async () => {
    if (!selectedFeature) return;
    setIsPredicting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const predictionResult = selectedFeature.predict(inputs);
    setResult(predictionResult);
    setIsPredicting(false);
  };

  const handleClose = () => {
    setSelectedFeature(null);
    setInputs({});
    setResult(null);
  };

  return (
    <section ref={containerRef} className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
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
            <Brain className="w-4 h-4 inline mr-1" />
            Machine Learning
          </span>
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-4"
            style={{ fontFamily: "'M PLUS Rounded 1c', sans-serif" }}
          >
            <span className="text-gradient">AI-Powered</span>
            <br />
            <span className="text-foreground">Predictions</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Beyond conversation—Lanna harnesses machine learning to solve real-world problems
          </p>
        </motion.div>

        {/* ML Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {mlFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ 
                  delay: 0.2 + index * 0.1, 
                  duration: 0.6,
                  ease: [0.68, -0.55, 0.265, 1.55]
                }}
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => setSelectedFeature(feature)}
                className="group cursor-pointer"
              >
                <div className="relative h-full p-6 rounded-2xl glass-card overflow-hidden">
                  {/* Tech notch */}
                  <div className="absolute top-0 right-0 w-8 h-8 overflow-hidden">
                    <div 
                      className={`absolute top-0 right-0 w-16 h-16 -translate-y-1/2 translate-x-1/2 rotate-45 bg-gradient-to-br ${feature.gradient} opacity-20`}
                    />
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 
                    className="text-xl font-bold mb-2 text-foreground"
                    style={{ fontFamily: "'M PLUS Rounded 1c', sans-serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* CTA */}
                  <div className={`flex items-center text-sm font-medium ${feature.color} group-hover:gap-2 transition-all`}>
                    <span>Try it now</span>
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Hover glow */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Prediction Dialog */}
      <Dialog open={!!selectedFeature} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedFeature && (
                <>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${selectedFeature.gradient} flex items-center justify-center`}>
                    <selectedFeature.icon className="w-5 h-5 text-white" />
                  </div>
                  <span>{selectedFeature.title}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedFeature?.description}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4 py-4"
              >
                {selectedFeature?.inputs.map((input) => (
                  <div key={input.name} className="space-y-2">
                    <Label htmlFor={input.name}>{input.label}</Label>
                    <Input
                      id={input.name}
                      type={input.type}
                      placeholder={input.placeholder}
                      value={inputs[input.name] || ''}
                      onChange={(e) => setInputs(prev => ({ ...prev, [input.name]: e.target.value }))}
                      min={input.min}
                      max={input.max}
                    />
                  </div>
                ))}

                <Button
                  onClick={handlePredict}
                  disabled={isPredicting || selectedFeature?.inputs.some(i => !inputs[i.name])}
                  className={`w-full bg-gradient-to-r ${selectedFeature?.gradient} text-white`}
                >
                  {isPredicting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Calculator className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 mr-2" />
                      Predict
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 space-y-4"
              >
                <div className={`p-6 rounded-xl bg-gradient-to-br ${selectedFeature?.gradient} text-white text-center`}>
                  <div className="text-sm opacity-80 mb-1">Prediction Result</div>
                  <div className="text-3xl font-bold">{result.result}</div>
                  <div className="flex items-center justify-center gap-2 mt-2 text-sm opacity-90">
                    <CheckCircle className="w-4 h-4" />
                    Confidence: {result.confidence}%
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <div className="font-medium mb-1">Analysis Details</div>
                      <p className="text-sm text-muted-foreground">{result.details}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setResult(null)}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                  <Button
                    onClick={handleClose}
                    className={`flex-1 bg-gradient-to-r ${selectedFeature?.gradient} text-white`}
                  >
                    Done
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </section>
  );
}
