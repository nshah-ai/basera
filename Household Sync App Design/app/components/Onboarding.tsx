import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: (userName: string, partnerName: string) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [partnerName, setPartnerName] = useState('');

  const handleContinue = () => {
    if (step === 0 && userName.trim()) {
      setStep(1);
    } else if (step === 1 && partnerName.trim()) {
      setStep(2);
      setTimeout(() => {
        onComplete(userName, partnerName);
      }, 1500);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      {/* Logo/Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-12"
      >
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-[#FF6B9D] to-[#C084FC] rounded-3xl flex items-center justify-center">
            <Heart className="w-10 h-10 text-white fill-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#4FD1C5] rounded-full border-4 border-[#0A1628]" />
        </div>
      </motion.div>

      {step < 2 && (
        <>
          {/* Title */}
          <motion.div
            key={`title-${step}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-[#FF6B9D] to-[#4FD1C5] bg-clip-text text-transparent">
              Household Sync
            </h1>
            <p className="text-gray-400 text-sm">
              {step === 0 ? "Let's get started! What's your name?" : "And who's your partner?"}
            </p>
          </motion.div>

          {/* Input */}
          <motion.div
            key={`input-${step}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-full mb-8"
          >
            <input
              type="text"
              value={step === 0 ? userName : partnerName}
              onChange={(e) => step === 0 ? setUserName(e.target.value) : setPartnerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
              placeholder={step === 0 ? "Your name" : "Partner's name"}
              autoFocus
              className="w-full bg-[#1A2942] border border-[#2D3F5F] rounded-2xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B9D] transition-all"
            />
          </motion.div>

          {/* Continue Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            onClick={handleContinue}
            disabled={step === 0 ? !userName.trim() : !partnerName.trim()}
            className="w-full bg-gradient-to-r from-[#FF6B9D] to-[#C084FC] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#FF6B9D]/20 transition-all active:scale-95"
          >
            Continue
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          {/* Progress Dots */}
          <div className="flex gap-2 mt-8">
            <div className={`w-2 h-2 rounded-full transition-all ${step >= 0 ? 'bg-[#FF6B9D] w-6' : 'bg-gray-600'}`} />
            <div className={`w-2 h-2 rounded-full transition-all ${step >= 1 ? 'bg-[#FF6B9D] w-6' : 'bg-gray-600'}`} />
          </div>
        </>
      )}

      {/* Success Animation */}
      {step === 2 && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
            className="w-24 h-24 bg-gradient-to-br from-[#FF6B9D] to-[#4FD1C5] rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Heart className="w-12 h-12 text-white fill-white" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Perfect!</h2>
          <p className="text-gray-400">Setting up your workspace...</p>
        </motion.div>
      )}
    </div>
  );
}
