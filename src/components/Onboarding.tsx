'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, ArrowRight, UserPlus, Home } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';

const SwingIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {/* Ropes and Seat */}
        <path d="M6 3v15h12V3" strokeWidth="1.5" strokeOpacity="0.3" />
        <line x1="4" y1="18" x2="20" y2="18" strokeWidth="2.5" />

        {/* Left Person */}
        <circle cx="9.5" cy="11.5" r="1.5" />
        <path d="M9.5 13v4h2v3" />
        <path d="M9.5 14.5c-1 0-2.5-1-3.5-3" /> {/* Left arm holding rope */}

        {/* Right Person */}
        <circle cx="14.5" cy="11.2" r="1.5" />
        <path d="M14.5 12.7c0 1.5-1.5 2.5-3.5 2.5" /> {/* Arm wrapped around partner */}
        <path d="M14.5 12.7v4.3h-1.5v3" />
        <path d="M14.5 14.2c1 0 2.5-1 3.5-3" /> {/* Right arm holding rope */}
    </svg>
);
import { User } from '@/types';
import { generateId } from '@/utils/uuid';
import { createHousehold, joinHousehold, updateUserProfile } from '@/lib/sync';

interface OnboardingProps {
    onComplete: () => void;
}

type Mode = 'select' | 'create' | 'join';

export function Onboarding({ onComplete }: OnboardingProps) {
    const [mode, setMode] = useState<Mode>('select');
    const [step, setStep] = useState(0);
    const [userName, setUserName] = useState('');
    const [partnerName, setPartnerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState(''); // New: for WhatsApp
    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [fetchedUsers, setFetchedUsers] = useState<User[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    console.log("🌊 Onboarding Component Mounted. Step:", step, "Mode:", mode);

    const setUsers = useTaskStore((state) => state.setUsers);
    const setHouseholdId = useTaskStore((state) => state.setHouseholdId);
    const setCurrentUser = useTaskStore((state) => state.setCurrentUser);

    const getAvatarColor = (index: number) => {
        const colors = ['#D29C42', '#899B82']; // Example colors
        return colors[index % colors.length];
    };

    const handleCreateContinue = async () => {
        if (step === 0 && userName.trim()) {
            setStep(1);
        } else if (step === 1 && partnerName.trim()) {
            setStep(3); // intermediate step for phone
        } else if (step === 3) {
            // Actual creation
            setIsProcessing(true);
            try {
                const creatorId = generateId();
                const partnerId = generateId();

                const newUsers: User[] = [
                    { id: creatorId, name: userName, avatarColor: getAvatarColor(0), phoneNumber: phoneNumber.trim() || undefined },
                    { id: partnerId, name: partnerName, avatarColor: getAvatarColor(1) },
                ];

                const householdId = await createHousehold(newUsers);

                setUsers(newUsers);
                setHouseholdId(householdId);
                setCurrentUser(newUsers[0].id); // Creator is the first user

                setStep(2); // Success step
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } catch (err) {
                console.error(err);
                setError("Failed to create household. Please try again.");
                setIsProcessing(false);
            }
        }
    };

    const handleJoinSubmit = async () => {
        if (!joinCode.trim()) return;
        setError('');
        setIsProcessing(true);
        try {
            const users = await joinHousehold(joinCode.trim());
            if (users) {
                setFetchedUsers(users);
                setStep(1); // Move to profile selection
                setIsProcessing(false);
            } else {
                setError("Household not found. Check the code and try again.");
                setIsProcessing(false);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to join household.");
            setIsProcessing(false);
        }
    };

    const handleProfileSelect = (userId: string) => {
        setSelectedUserId(userId);
        setStep(3); // Go to phone collection step
    };

    const handleFinishJoin = async () => {
        if (!selectedUserId || !joinCode) return;
        setIsProcessing(true);
        try {
            const hId = joinCode.trim().toUpperCase();

            // 1. Update Profile in Firestore if phone provided
            let finalUsers = fetchedUsers;
            if (phoneNumber.trim()) {
                const updated = await updateUserProfile(hId, selectedUserId, { phoneNumber: phoneNumber.trim() });
                if (updated) finalUsers = updated;
            }

            // 2. Set Local State
            setHouseholdId(hId);
            setUsers(finalUsers);
            setCurrentUser(selectedUserId);

            setStep(2); // Success step
            setTimeout(() => {
                onComplete();
            }, 1500);
        } catch (err) {
            console.error(err);
            setError("Failed to join. Please try again.");
            setIsProcessing(false);
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
                <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center shadow-sm border border-border">
                    <SwingIcon className="w-12 h-12 text-primary" />
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {mode === 'select' && (
                    <motion.div
                        key="select"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full text-center"
                    >
                        <h1 className="text-4xl font-semibold mb-3 text-textMain tracking-tight">
                            Basera
                        </h1>
                        <p className="text-textMuted text-sm mb-12">
                            Where your home settles.
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('create')}
                                className="w-full bg-primary text-white py-4 px-6 rounded-2xl font-medium flex items-center justify-between hover:shadow-md transition-all active:scale-95"
                            >
                                <span className="flex items-center gap-3">
                                    <Home className="w-5 h-5" />
                                    Create New Household
                                </span>
                                <ArrowRight className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setMode('join')}
                                className="w-full bg-surface border border-border text-textMain py-4 px-6 rounded-2xl font-medium flex items-center justify-between hover:bg-border/30 transition-all active:scale-95"
                            >
                                <span className="flex items-center gap-3">
                                    <UserPlus className="w-5 h-5 text-sage" />
                                    Join Partner
                                </span>
                                <ArrowRight className="w-5 h-5 text-textMuted" />
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                if (confirm("Clear all app data and start fresh?")) {
                                    localStorage.clear();
                                    window.location.reload();
                                }
                            }}
                            className="mt-8 text-xs text-textMuted hover:text-red-500 transition-colors underline underline-offset-4"
                        >
                            Reset App Data
                        </button>
                    </motion.div>
                )}


                {/* Create Flow: Step 0 (Self), Step 1 (Partner), Step 3 (Phone) */}
                {mode === 'create' && step < 2 && step !== 3 && (
                    <motion.div
                        key="create"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                    >
                        <button
                            onClick={() => setMode('select')}
                            className="text-sm text-textMuted mb-6 hover:text-textMain transition-colors"
                        >
                            ← Back
                        </button>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2 text-textMain">
                                {step === 0 ? "What's your name?" : "And who's your partner?"}
                            </h2>
                            <p className="text-textMuted text-sm">
                                {step === 0 ? "You're setting up the household." : "We'll set up their profile."}
                            </p>
                        </div>

                        <div className="mb-8">
                            <input
                                type="text"
                                value={step === 0 ? userName : partnerName}
                                onChange={(e) => step === 0 ? setUserName(e.target.value) : setPartnerName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleCreateContinue()}
                                placeholder={step === 0 ? "Your name" : "Partner's name"}
                                autoFocus
                                disabled={isProcessing}
                                className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                            />
                        </div>

                        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

                        <button
                            onClick={handleCreateContinue}
                            disabled={(step === 0 ? !userName.trim() : !partnerName.trim()) || isProcessing}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95 hover:shadow-md"
                        >
                            {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {step === 0 ? 'Continue' : 'Continue'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                {/* Create/Join Flow: Step 3 (Phone Number) */}
                {step === 3 && (
                    <motion.div
                        key="phone-collection"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                    >
                        <button
                            onClick={() => setStep(1)}
                            className="text-sm text-textMuted mb-6 hover:text-textMain transition-colors"
                        >
                            ← Back
                        </button>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2 text-textMain">Sync with WhatsApp?</h2>
                            <p className="text-textMuted text-sm">
                                {mode === 'create'
                                    ? "Get daily nudges and add tasks via text."
                                    : "We'll link your WhatsApp for easy task management."}
                            </p>
                        </div>

                        <div className="mb-8">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (mode === 'create' ? handleCreateContinue() : handleFinishJoin())}
                                placeholder="+1234567890"
                                autoFocus
                                disabled={isProcessing}
                                className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                            />
                            <p className="text-[10px] text-textMuted mt-2 px-2 italic">
                                *Optional. Skip by leaving empty.
                            </p>
                        </div>

                        <button
                            onClick={mode === 'create' ? handleCreateContinue : handleFinishJoin}
                            disabled={isProcessing}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 hover:shadow-md"
                        >
                            {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'create' ? 'Create Household' : 'Complete Setup'}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                {/* Join Step 0: Input Code */}
                {mode === 'join' && step === 0 && (
                    <motion.div
                        key="join-code"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                    >
                        <button
                            onClick={() => { setMode('select'); setError(''); }}
                            className="text-sm text-textMuted mb-6 hover:text-textMain transition-colors"
                        >
                            ← Back
                        </button>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2 text-textMain">Join Household</h2>
                            <p className="text-textMuted text-sm">
                                Enter the 6-character code from your partner's app.
                            </p>
                        </div>

                        <div className="mb-8">
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                onKeyPress={(e) => e.key === 'Enter' && handleJoinSubmit()}
                                placeholder="e.g. XR7MQ9"
                                maxLength={6}
                                autoFocus
                                disabled={isProcessing}
                                className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-textMain placeholder-textMuted text-center text-2xl tracking-widest uppercase focus:outline-none focus:border-primary transition-all shadow-sm"
                            />
                        </div>

                        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

                        <button
                            onClick={handleJoinSubmit}
                            disabled={joinCode.length < 3 || isProcessing}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-95 hover:shadow-md"
                        >
                            {isProcessing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Locate Household
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                {/* Join Step 1: Select Profile */}
                {mode === 'join' && step === 1 && (
                    <motion.div
                        key="join-profile"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                    >
                        <button
                            onClick={() => { setStep(0); setError(''); }}
                            className="text-sm text-textMuted mb-6 hover:text-textMain transition-colors"
                        >
                            ← Back
                        </button>

                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2 text-textMain">Who are you?</h2>
                            <p className="text-textMuted text-sm">
                                Select your profile to sync this device.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            {fetchedUsers.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleProfileSelect(user.id)}
                                    className="p-6 bg-surface border border-border rounded-3xl hover:border-primary hover:shadow-md transition-all active:scale-95 group text-center"
                                >
                                    <div
                                        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform"
                                        style={{ backgroundColor: user.avatarColor }}
                                    >
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-semibold text-textMain">{user.name}</span>
                                </button>
                            ))}
                        </div>

                        <p className="text-xs text-center text-textMuted italic">
                            Both partners will stay in sync 🏡
                        </p>
                    </motion.div>
                )}

                {/* Success Animation */}
                {step === 2 && (
                    <motion.div
                        key="success"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center text-textMain"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, ease: 'easeInOut' }}
                            className="w-24 h-24 bg-surface border border-border shadow-sm rounded-full flex items-center justify-center mx-auto mb-6"
                        >
                            <SwingIcon className="w-12 h-12 text-sage" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mb-2">Connected!</h2>
                        <p className="text-textMuted">Loading your household...</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
