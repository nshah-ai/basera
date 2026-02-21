import { useState } from 'react';
import Onboarding from '@/app/components/Onboarding';
import TaskList from '@/app/components/TaskList';

export default function App() {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userName, setUserName] = useState('');
  const [partnerName, setPartnerName] = useState('');

  const handleOnboardingComplete = (user: string, partner: string) => {
    setUserName(user);
    setPartnerName(partner);
    setIsOnboarded(true);
  };

  return (
    <div className="size-full bg-[#0A1628] text-white">
      {!isOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <TaskList userName={userName} partnerName={partnerName} />
      )}
    </div>
  );
}
