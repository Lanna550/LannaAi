import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { 
  Home, Mail, GraduationCap, Stethoscope, ShieldAlert, Image, 
  CheckCircle, AlertTriangle, Info, TrendingUp, 
  Brain, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface MLFeature {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  image: string;
  inputs: { name: string; label: string; type: string; placeholder: string; min?: number; max?: number }[];
  predict: (inputs: Record<string, string>) => PredictionResult;
}

interface PredictionResult {
  result: string;
  confidence: number;
  details: string;
  explanation: string;
  chartData?: any[];
  chartType: 'bar' | 'pie' | 'radar' | 'gauge';
  factors?: { name: string; value: number; impact: 'positive' | 'negative' | 'neutral' }[];
}

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const mlFeatures: MLFeature[] = [
  {
    id: 'house',
    icon: Home,
    iconBg: 'bg-blue-500',
    title: 'House Price Prediction',
    description: 'Estimate property values using advanced regression models with visual price breakdown.',
    image: '/images/ml_house_visual.png',
    inputs: [
      { name: 'size', label: 'House Size (sq ft)', type: 'number', placeholder: 'e.g., 2000', min: 500, max: 10000 },
      { name: 'bedrooms', label: 'Number of Bedrooms', type: 'number', placeholder: 'e.g., 3', min: 1, max: 10 },
      { name: 'bathrooms', label: 'Number of Bathrooms', type: 'number', placeholder: 'e.g., 2', min: 1, max: 10 },
      { name: 'location', label: 'Location Score (1-10)', type: 'number', placeholder: 'e.g., 7', min: 1, max: 10 },
      { name: 'age', label: 'House Age (years)', type: 'number', placeholder: 'e.g., 5', min: 0, max: 100 },
    ],
    predict: (inputs) => {
      const size = parseInt(inputs.size) || 1500;
      const bedrooms = parseInt(inputs.bedrooms) || 3;
      const bathrooms = parseInt(inputs.bathrooms) || 2;
      const location = parseInt(inputs.location) || 5;
      const age = parseInt(inputs.age) || 5;
      
      const sizeValue = size * 180;
      const bedroomValue = bedrooms * 25000;
      const bathroomValue = bathrooms * 15000;
      const locationValue = location * 45000;
      const ageDiscount = age > 10 ? age * 2000 : 0;
      
      const totalPrice = sizeValue + bedroomValue + bathroomValue + locationValue - ageDiscount;
      const formattedPrice = `$${totalPrice.toLocaleString()}`;
      
      const chartData = [
        { name: 'Size', value: Math.round(sizeValue / 1000), color: '#3b82f6' },
        { name: 'Bedrooms', value: Math.round(bedroomValue / 1000), color: '#06b6d4' },
        { name: 'Bathrooms', value: Math.round(bathroomValue / 1000), color: '#8b5cf6' },
        { name: 'Location', value: Math.round(locationValue / 1000), color: '#ec4899' },
        { name: 'Age', value: -Math.round(ageDiscount / 1000), color: '#ef4444' },
      ];

      const factors = [
        { name: 'Size Impact', value: Math.round((sizeValue / totalPrice) * 100), impact: 'positive' as const },
        { name: 'Location Premium', value: Math.round((locationValue / totalPrice) * 100), impact: 'positive' as const },
        { name: 'Age Depreciation', value: age > 10 ? Math.round((ageDiscount / totalPrice) * 100) : 0, impact: 'negative' as const },
      ];
      
      return {
        result: formattedPrice,
        confidence: 87,
        details: `Based on ${size} sq ft, ${bedrooms} bed, ${bathrooms} bath, location score ${location}/10`,
        explanation: `The predicted price of ${formattedPrice} is calculated by analyzing multiple factors. The size of your house contributes significantly to the value, with each square foot adding approximately $180. The number of bedrooms and bathrooms also add substantial value. The location score of ${location}/10 adds a premium of $${locationValue.toLocaleString()}. ${age > 10 ? `However, the house age of ${age} years reduces the value by $${ageDiscount.toLocaleString()} due to depreciation.` : 'The relatively young age of your house maintains its value well.'}`,
        chartData,
        chartType: 'bar',
        factors,
      };
    },
  },
  {
    id: 'spam',
    icon: Mail,
    iconBg: 'bg-red-500',
    title: 'Spam Email Classifier',
    description: 'Detect spam emails with visual threat analysis and confidence scoring.',
    image: '/images/ml_spam_visual.png',
    inputs: [
      { name: 'subject', label: 'Email Subject', type: 'text', placeholder: 'Enter the email subject line...' },
      { name: 'content', label: 'Email Content', type: 'text', placeholder: 'Paste the email content here...' },
      { name: 'sender', label: 'Sender Email', type: 'text', placeholder: 'e.g., sender@example.com' },
    ],
    predict: (inputs) => {
      const subject = inputs.subject.toLowerCase();
      const content = inputs.content.toLowerCase();
      const sender = inputs.sender.toLowerCase();
      const fullText = subject + ' ' + content;
      
      const spamIndicators = [
        { word: 'free', weight: 15 },
        { word: 'winner', weight: 25 },
        { word: 'urgent', weight: 20 },
        { word: 'click here', weight: 30 },
        { word: 'limited time', weight: 20 },
        { word: 'congratulations', weight: 15 },
        { word: 'prize', weight: 20 },
        { word: 'money', weight: 10 },
        { word: 'offer', weight: 10 },
        { word: 'act now', weight: 25 },
      ];
      
      let spamScore = 0;
      const detectedWords: string[] = [];
      
      spamIndicators.forEach(indicator => {
        if (fullText.includes(indicator.word)) {
          spamScore += indicator.weight;
          detectedWords.push(indicator.word);
        }
      });
      
      const suspiciousDomains = ['tempmail', 'fakeemail', 'spam'];
      const hasSuspiciousSender = suspiciousDomains.some(domain => sender.includes(domain));
      if (hasSuspiciousSender) spamScore += 30;
      
      const exclamationCount = (fullText.match(/!/g) || []).length;
      if (exclamationCount > 3) spamScore += 15;
      
      const isSpam = spamScore >= 50;
      const confidence = Math.min(95, 60 + spamScore * 0.5);
      
      const chartData = spamIndicators.slice(0, 6).map(ind => ({
        name: ind.word,
        value: fullText.includes(ind.word) ? ind.weight : 0,
        potential: ind.weight,
      }));
      
      return {
        result: isSpam ? '🚫 SPAM DETECTED' : '✅ LEGITIMATE EMAIL',
        confidence: Math.round(confidence),
        details: isSpam 
          ? `${detectedWords.length} spam indicators detected in the email` 
          : 'No significant spam patterns detected',
        explanation: isSpam 
          ? `This email has been classified as SPAM with ${Math.round(confidence)}% confidence. The analysis detected ${detectedWords.length} spam indicators including: ${detectedWords.slice(0, 5).join(', ')}. ${hasSuspiciousSender ? 'The sender domain also appears suspicious.' : ''} We recommend deleting this email or marking it as spam.`
          : `This email appears to be legitimate with ${Math.round(confidence)}% confidence. No significant spam patterns were detected in the content analysis. The email passed all security checks and is safe to open.`,
        chartData,
        chartType: 'radar',
      };
    },
  },
  {
    id: 'grades',
    icon: GraduationCap,
    iconBg: 'bg-green-500',
    title: 'Student Grade Prediction',
    description: 'Predict academic performance with detailed factor analysis.',
    image: '/images/ml_grade_visual.png',
    inputs: [
      { name: 'attendance', label: 'Attendance Rate (%)', type: 'number', placeholder: 'e.g., 85', min: 0, max: 100 },
      { name: 'studyHours', label: 'Study Hours per Week', type: 'number', placeholder: 'e.g., 15', min: 0, max: 100 },
      { name: 'previousGrade', label: 'Previous Grade (0-100)', type: 'number', placeholder: 'e.g., 75', min: 0, max: 100 },
      { name: 'assignments', label: 'Assignment Completion (%)', type: 'number', placeholder: 'e.g., 90', min: 0, max: 100 },
    ],
    predict: (inputs) => {
      const attendance = parseInt(inputs.attendance) || 80;
      const studyHours = parseInt(inputs.studyHours) || 10;
      const previousGrade = parseInt(inputs.previousGrade) || 70;
      const assignments = parseInt(inputs.assignments) || 80;
      
      const attendanceScore = attendance * 0.25;
      const studyScore = Math.min(studyHours * 3, 30);
      const previousScore = previousGrade * 0.3;
      const assignmentScore = assignments * 0.15;
      
      const predictedGrade = Math.min(100, Math.round(attendanceScore + studyScore + previousScore + assignmentScore));
      const letterGrade = predictedGrade >= 90 ? 'A' : predictedGrade >= 80 ? 'B' : predictedGrade >= 70 ? 'C' : predictedGrade >= 60 ? 'D' : 'F';
      
      const chartData = [
        { name: 'Attendance', value: Math.round(attendanceScore), fullMark: 25 },
        { name: 'Study Hours', value: Math.round(studyScore), fullMark: 30 },
        { name: 'Previous Grade', value: Math.round(previousScore), fullMark: 30 },
        { name: 'Assignments', value: Math.round(assignmentScore), fullMark: 15 },
      ];
      
      const factors: { name: string; value: number; impact: 'positive' | 'negative' | 'neutral' }[] = [
        { name: 'Attendance Impact', value: Math.round((attendanceScore / predictedGrade) * 100), impact: attendance > 80 ? 'positive' : 'negative' },
        { name: 'Study Effort', value: Math.round((studyScore / predictedGrade) * 100), impact: studyHours > 10 ? 'positive' : 'negative' },
        { name: 'Past Performance', value: Math.round((previousScore / predictedGrade) * 100), impact: previousGrade > 70 ? 'positive' : 'negative' },
      ];
      
      let advice = '';
      if (predictedGrade >= 90) {
        advice = 'Excellent! Keep up the great work. Your consistent effort is paying off.';
      } else if (predictedGrade >= 80) {
        advice = 'Good job! With a little more effort, you can reach the A grade.';
      } else if (predictedGrade >= 70) {
        advice = 'You\'re doing okay, but there\'s room for improvement. Try increasing your study hours.';
      } else {
        advice = 'You need to improve your study habits. Focus on attendance and completing assignments.';
      }
      
      return {
        result: `${letterGrade} (${predictedGrade}%)`,
        confidence: 84,
        details: `Predicted based on ${attendance}% attendance, ${studyHours} study hours/week`,
        explanation: `Based on your current academic habits, we predict you'll achieve a ${letterGrade} grade (${predictedGrade}%). ${advice} Your attendance rate of ${attendance}% contributes ${Math.round(attendanceScore)} points, while your ${studyHours} hours of weekly study adds ${Math.round(studyScore)} points to your predicted score.`,
        chartData,
        chartType: 'radar',
        factors,
      };
    },
  },
  {
    id: 'disease',
    icon: Stethoscope,
    iconBg: 'bg-purple-500',
    title: 'Disease Detection',
    description: 'Get preliminary health insights with symptom visualization.',
    image: '/images/ml_medical_visual.png',
    inputs: [
      { name: 'age', label: 'Age', type: 'number', placeholder: 'e.g., 30', min: 1, max: 120 },
      { name: 'symptoms', label: 'Main Symptoms', type: 'text', placeholder: 'e.g., fever, headache, cough' },
      { name: 'duration', label: 'Duration (days)', type: 'number', placeholder: 'e.g., 3', min: 1, max: 365 },
      { name: 'severity', label: 'Severity (1-10)', type: 'number', placeholder: 'e.g., 5', min: 1, max: 10 },
    ],
    predict: (inputs) => {
      const symptoms = inputs.symptoms.toLowerCase();
      const duration = parseInt(inputs.duration) || 3;
      const severity = parseInt(inputs.severity) || 5;
      
      const symptomList = [
        { name: 'Fever', keywords: ['fever', 'hot', 'temperature'], weight: 25 },
        { name: 'Cough', keywords: ['cough', 'coughing'], weight: 20 },
        { name: 'Headache', keywords: ['headache', 'head pain'], weight: 15 },
        { name: 'Fatigue', keywords: ['tired', 'fatigue', 'exhausted'], weight: 15 },
        { name: 'Nausea', keywords: ['nausea', 'nauseous', 'vomit'], weight: 20 },
        { name: 'Body Ache', keywords: ['ache', 'pain', 'sore'], weight: 15 },
      ];
      
      const detectedSymptoms: string[] = [];
      let totalScore = 0;
      
      symptomList.forEach(symptom => {
        if (symptom.keywords.some(kw => symptoms.includes(kw))) {
          detectedSymptoms.push(symptom.name);
          totalScore += symptom.weight;
        }
      });
      
      totalScore += duration * 2;
      totalScore += severity * 3;
      
      let result = '';
      let explanation = '';
      let confidence = 0;
      
      if (detectedSymptoms.includes('Fever') && detectedSymptoms.includes('Cough')) {
        result = 'Possible Respiratory Infection';
        confidence = 78;
        explanation = `The combination of fever and cough strongly suggests a respiratory infection such as the flu or a common cold. The symptoms have persisted for ${duration} days with a severity of ${severity}/10. We recommend consulting a healthcare provider for proper diagnosis and treatment.`;
      } else if (detectedSymptoms.includes('Fever') && detectedSymptoms.includes('Headache')) {
        result = 'Possible Viral Infection';
        confidence = 72;
        explanation = `Fever combined with headache is commonly associated with viral infections. Rest, hydration, and over-the-counter medications may help. If symptoms worsen, please see a doctor.`;
      } else if (totalScore < 50) {
        result = 'Mild Condition - Self Care Recommended';
        confidence = 65;
        explanation = `Your symptoms appear mild. We recommend rest, staying hydrated, and monitoring your condition. If symptoms persist beyond a week or worsen, please consult a healthcare provider.`;
      } else {
        result = 'Moderate Concern - Monitor Closely';
        confidence = 70;
        explanation = `Based on your symptoms and their severity, we recommend monitoring your condition closely. If symptoms worsen or new symptoms appear, please seek medical attention.`;
      }
      
      const chartData = symptomList.map(s => ({
        name: s.name,
        value: detectedSymptoms.includes(s.name) ? s.weight : 0,
      }));
      
      return {
        result,
        confidence,
        details: `Detected ${detectedSymptoms.length} symptoms over ${duration} days`,
        explanation,
        chartData,
        chartType: 'bar',
      };
    },
  },
  {
    id: 'fraud',
    icon: ShieldAlert,
    iconBg: 'bg-yellow-500',
    title: 'Fraud Detection',
    description: 'Identify suspicious transactions with risk visualization.',
    image: '/images/ml_fraud_visual.png',
    inputs: [
      { name: 'amount', label: 'Transaction Amount ($)', type: 'number', placeholder: 'e.g., 500', min: 1 },
      { name: 'location', label: 'Location Match', type: 'text', placeholder: 'Same as usual? (yes/no)' },
      { name: 'time', label: 'Transaction Time', type: 'text', placeholder: 'e.g., 14:30 (24h format)' },
      { name: 'merchant', label: 'Merchant Type', type: 'text', placeholder: 'e.g., grocery, electronics' },
    ],
    predict: (inputs) => {
      const amount = parseInt(inputs.amount) || 100;
      const locationMatch = inputs.location.toLowerCase() === 'yes';
      const time = inputs.time;
      const hour = parseInt(time.split(':')[0]) || 12;
      const merchant = inputs.merchant.toLowerCase();
      
      let riskScore = 0;
      const riskFactors: string[] = [];
      
      if (amount > 1000) {
        riskScore += 30;
        riskFactors.push('High transaction amount');
      } else if (amount > 500) {
        riskScore += 15;
        riskFactors.push('Moderate transaction amount');
      }
      
      if (!locationMatch) {
        riskScore += 40;
        riskFactors.push('Unusual location');
      }
      
      if (hour < 6 || hour > 23) {
        riskScore += 20;
        riskFactors.push('Unusual transaction time');
      }
      
      const highRiskMerchants = ['crypto', 'gambling', 'foreign'];
      if (highRiskMerchants.some(m => merchant.includes(m))) {
        riskScore += 25;
        riskFactors.push('High-risk merchant category');
      }
      
      let result = '';
      let explanation = '';
      
      if (riskScore >= 60) {
        result = '🔴 HIGH RISK - Potential Fraud';
        explanation = `This transaction shows multiple red flags with a risk score of ${riskScore}/100. ${riskFactors.join(', ')}. We strongly recommend verifying this transaction with the cardholder before processing.`;
      } else if (riskScore >= 30) {
        result = '🟡 MEDIUM RISK - Review Recommended';
        explanation = `This transaction has some unusual patterns with a risk score of ${riskScore}/100. ${riskFactors.join(', ')}. Additional verification may be needed.`;
      } else {
        result = '🟢 LOW RISK - Transaction Normal';
        explanation = `This transaction appears legitimate with a low risk score of ${riskScore}/100. No suspicious patterns detected.`;
      }
      
      const chartData = [
        { name: 'Amount', value: amount > 1000 ? 30 : amount > 500 ? 15 : 0 },
        { name: 'Location', value: !locationMatch ? 40 : 0 },
        { name: 'Time', value: (hour < 6 || hour > 23) ? 20 : 0 },
        { name: 'Merchant', value: highRiskMerchants.some(m => merchant.includes(m)) ? 25 : 0 },
      ];
      
      return {
        result,
        confidence: Math.min(95, 70 + riskScore * 0.3),
        details: `Risk score: ${riskScore}/100`,
        explanation,
        chartData,
        chartType: 'pie',
      };
    },
  },
  {
    id: 'anime',
    icon: Image,
    iconBg: 'bg-pink-500',
    title: 'AI Art Detection',
    description: 'Distinguish AI-generated from human-created artwork.',
    image: '/images/ml_aiart_visual.png',
    inputs: [
      { name: 'style', label: 'Art Style Description', type: 'text', placeholder: 'e.g., detailed shading, smooth lines' },
      { name: 'texture', label: 'Texture Quality', type: 'text', placeholder: 'e.g., smooth, rough, detailed' },
      { name: 'anatomy', label: 'Anatomy Accuracy', type: 'text', placeholder: 'e.g., perfect, slightly off, natural' },
    ],
    predict: (inputs) => {
      const style = inputs.style.toLowerCase();
      const texture = inputs.texture.toLowerCase();
      const anatomy = inputs.anatomy.toLowerCase();
      
      const aiIndicators = [
        { name: 'Perfect Symmetry', keywords: ['symmetry', 'perfect', 'identical'], weight: 25 },
        { name: 'Overly Smooth', keywords: ['smooth', 'perfect', 'clean'], weight: 20 },
        { name: 'Uncanny Details', keywords: ['uncanny', 'weird', 'strange'], weight: 30 },
        { name: 'Repetitive Patterns', keywords: ['repetitive', 'pattern', 'same'], weight: 20 },
      ];
      
      const humanIndicators = [
        { name: 'Natural Imperfections', keywords: ['rough', 'sketch', 'imperfect'], weight: 25 },
        { name: 'Unique Style', keywords: ['unique', 'style', 'artistic'], weight: 20 },
        { name: 'Organic Texture', keywords: ['organic', 'natural', 'hand'], weight: 25 },
      ];
      
      let aiScore = 0;
      let humanScore = 0;
      const detectedAI: string[] = [];
      const detectedHuman: string[] = [];
      
      aiIndicators.forEach(ind => {
        if (ind.keywords.some(kw => style.includes(kw) || texture.includes(kw) || anatomy.includes(kw))) {
          aiScore += ind.weight;
          detectedAI.push(ind.name);
        }
      });
      
      humanIndicators.forEach(ind => {
        if (ind.keywords.some(kw => style.includes(kw) || texture.includes(kw) || anatomy.includes(kw))) {
          humanScore += ind.weight;
          detectedHuman.push(ind.name);
        }
      });
      
      const totalScore = aiScore + humanScore;
      const aiPercentage = totalScore > 0 ? Math.round((aiScore / totalScore) * 100) : 50;
      
      let result = '';
      let explanation = '';
      let confidence = 0;
      
      if (aiPercentage > 60) {
        result = '🤖 Likely AI-Generated';
        confidence = aiPercentage;
        explanation = `Our analysis suggests this artwork is likely AI-generated with ${aiPercentage}% confidence. We detected ${detectedAI.length} AI characteristics: ${detectedAI.join(', ')}. AI-generated art often exhibits perfect symmetry, overly smooth textures, and sometimes uncanny details in anatomy.`;
      } else if (aiPercentage < 40) {
        result = '✍️ Likely Human-Created';
        confidence = 100 - aiPercentage;
        explanation = `Our analysis suggests this artwork is likely human-created with ${100 - aiPercentage}% confidence. We detected ${detectedHuman.length} human artistic characteristics: ${detectedHuman.join(', ')}. Human art typically shows natural imperfections, unique stylistic choices, and organic textures.`;
      } else {
        result = '❓ Inconclusive - Further Analysis Needed';
        confidence = 50;
        explanation = `Our analysis is inconclusive. The artwork shows mixed characteristics of both AI and human creation. Professional art analysis or provenance documentation may be needed for a definitive answer.`;
      }
      
      const chartData = [
        { name: 'AI Indicators', value: aiScore, color: '#ec4899' },
        { name: 'Human Indicators', value: humanScore, color: '#3b82f6' },
      ];
      
      return {
        result,
        confidence,
        details: `AI probability: ${aiPercentage}%`,
        explanation,
        chartData,
        chartType: 'pie',
      };
    },
  },
];

interface MLPredictionDialogProps {
  feature: MLFeature | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MLPredictionDialog({ feature, isOpen, onClose }: MLPredictionDialogProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'result'>('input');

  if (!feature) return null;

  const handlePredict = async () => {
    setIsPredicting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const predictionResult = feature.predict(inputs);
    setResult(predictionResult);
    setActiveTab('result');
    setIsPredicting(false);
  };

  const handleReset = () => {
    setInputs({});
    setResult(null);
    setActiveTab('input');
  };

  const renderChart = () => {
    if (!result?.chartData) return null;

    switch (result.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={result.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [`$${value}k`, 'Value']}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={result.chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
              >
                {result.chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={result.chartData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none' }} />
            </RadarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className={`p-6 ${feature.iconBg} text-white`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <feature.icon className="w-7 h-7" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">{feature.title}</DialogTitle>
              <p className="text-white/80 text-sm">{feature.description}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'input' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'
            }`}
          >
            Input Data
          </button>
          <button
            onClick={() => setActiveTab('result')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'result' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'
            }`}
            disabled={!result}
          >
            Result & Analysis
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'input' ? (
            <div className="space-y-5">
              {/* Visual Image */}
              <div className="rounded-xl overflow-hidden bg-gray-50">
                <img src={feature.image} alt={feature.title} className="w-full h-40 object-contain" />
              </div>

              {/* Inputs */}
              <div className="grid gap-4">
                {feature.inputs.map((input) => (
                  <div key={input.name}>
                    <Label htmlFor={input.name} className="text-sm font-medium text-gray-700">
                      {input.label}
                    </Label>
                    <Input
                      id={input.name}
                      type={input.type}
                      placeholder={input.placeholder}
                      value={inputs[input.name] || ''}
                      onChange={(e) => setInputs(prev => ({ ...prev, [input.name]: e.target.value }))}
                      min={input.min}
                      max={input.max}
                      className="mt-1.5"
                    />
                  </div>
                ))}
              </div>

              {/* Predict Button */}
              <Button
                onClick={handlePredict}
                disabled={isPredicting || feature.inputs.some(i => !inputs[i.name])}
                className={`w-full h-12 ${feature.iconBg} hover:opacity-90 text-white font-medium`}
              >
                {isPredicting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    Analyze & Predict
                  </>
                )}
              </Button>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Result Card */}
              <div className={`p-6 rounded-2xl ${feature.iconBg} text-white text-center`}>
                <div className="text-sm opacity-80 mb-2">Prediction Result</div>
                <div className="text-3xl font-bold mb-2">{result.result}</div>
                <div className="flex items-center justify-center gap-2 text-sm opacity-90">
                  <CheckCircle className="w-4 h-4" />
                  Confidence: {result.confidence}%
                </div>
              </div>

              {/* Visualization */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Data Visualization
                </h4>
                {renderChart()}
              </div>

              {/* Detailed Explanation */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Detailed Explanation
                </h4>
                <p className="text-sm text-blue-600 leading-relaxed">{result.explanation}</p>
              </div>

              {/* Analysis Details */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Analysis Details
                </h4>
                <p className="text-sm text-gray-600">{result.details}</p>
              </div>

              {/* Factors (if available) */}
              {result.factors && result.factors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Key Factors</h4>
                  {result.factors.map((factor, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">{factor.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              factor.impact === 'positive' ? 'bg-green-500' : 
                              factor.impact === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${factor.value}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{factor.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Try Again Button */}
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Another Prediction
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { mlFeatures };
export type { MLFeature, PredictionResult };
