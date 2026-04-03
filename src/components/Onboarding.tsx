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
    const [phoneNumber, setPhoneNumber] = useState(''); // User's phone
    const [partnerPhoneNumber, setPartnerPhoneNumber] = useState(''); // Partner's phone
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
            const trimmedPhone = phoneNumber.trim().replace(/\D/g, ''); // Clean digits only
            if (!trimmedPhone || trimmedPhone.length < 10) {
                setError("A valid 10-digit WhatsApp number is required to sync with the bot.");
                return;
            }
            setIsProcessing(true);
            try {
                const creatorId = generateId();
                const partnerId = generateId();

                const creator: User = {
                    id: creatorId,
                    name: userName,
                    avatarColor: getAvatarColor(0)
                };
                creator.phoneNumber = phoneNumber.trim(); // We know it's not empty now

                const partner: User = {
                    id: partnerId,
                    name: partnerName,
                    avatarColor: getAvatarColor(1)
                };
                if (partnerPhoneNumber.trim()) partner.phoneNumber = partnerPhoneNumber.trim();

                const newUsers: User[] = [creator, partner];

                const householdId = await createHousehold(newUsers);

                setUsers(newUsers);
                setHouseholdId(householdId);
                setCurrentUser(creatorId); // Creator is the first user

                setStep(2); // Success step
                // No automatic checkout - let user see the share button

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
            const trimmedPhone = phoneNumber.trim().replace(/\D/g, '');
            if (!trimmedPhone || trimmedPhone.length < 10) {
                setError("A valid 10-digit WhatsApp number is required to join.");
                return;
            }

            let finalUsers = fetchedUsers;
            const updated = await updateUserProfile(hId, selectedUserId, { phoneNumber: phoneNumber.trim() });
            if (updated) finalUsers = updated;

            // 2. Set Local State
            setHouseholdId(hId);
            setUsers(finalUsers);
            setCurrentUser(selectedUserId);

            setStep(2); // Success step
            // No automatic checkout

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
                                    : "Link your WhatsApp for easy task management."}
                            </p>
                        </div>

                        <div className="space-y-6 mb-8">
                            <div>
                                <label className="text-xs font-medium text-textMuted mb-2 block px-1">Your WhatsApp Number (Required)</label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="+1234567890"
                                    autoFocus
                                    disabled={isProcessing}
                                    className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                                />
                            </div>

                            {mode === 'create' && (
                                <div>
                                    <label className="text-xs font-medium text-textMuted mb-2 block px-1">{partnerName}&apos;s Number (Optional)</label>
                                    <input
                                        type="tel"
                                        value={partnerPhoneNumber}
                                        onChange={(e) => setPartnerPhoneNumber(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (mode === 'create' ? handleCreateContinue() : handleFinishJoin())}
                                        placeholder="+1234567890"
                                        disabled={isProcessing}
                                        className="w-full bg-surface border border-border rounded-2xl px-6 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"

                                    />
                                </div>
                            )}

                        </div>



                        <button
                            onClick={mode === 'create' ? handleCreateContinue : handleFinishJoin}
                            disabled={isProcessing}
                            className="w-full bg-primary text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 hover:shadow-md"
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
                        <p className="text-textMuted mb-10">Your household is ready.</p>

                        {mode === 'create' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 }}
                                className="space-y-3"
                            >
                                <button
                                    onClick={() => {
                                        const hId = useTaskStore.getState().householdId;
                                        const msg = `Hey ${partnerName}! 🏠 I'm setting up our home on Basera. \n\n1. First, text "join cold-scientific" to +14155238886 to activate the bot. \n2. Then, click here to join our board: https://basera-home.vercel.app?code=${hId}`;
                                        const cleanPartnerPhone = partnerPhoneNumber.trim().replace(/\D/g, '');
                                        const url = cleanPartnerPhone
                                            ? `https://wa.me/${cleanPartnerPhone}?text=${encodeURIComponent(msg)}`
                                            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                                        window.open(url, '_blank');
                                    }}
                                    className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"
                                >
                                    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .006 5.417 0 12.05c0 2.12.54 4.19 1.57 6.05L0 24l6.14-1.61a12.023 12.023 0 005.91 1.55h.005c6.635 0 12.043-5.417 12.048-12.052a11.95 11.95 0 00-3.525-8.528" />
                                    </svg>
                                    Invite {partnerName}
                                </button>
                                <button
                                    onClick={() => onComplete()}
                                    className="w-full py-4 text-textMuted text-sm hover:text-textMain transition-colors"
                                >
                                    I&apos;ll do it later
                                </button>
                            </motion.div>
                        )}

                        {mode !== 'create' && (
                            <button
                                onClick={() => onComplete()}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"
                            >
                                Enter Dashboard
                            </button>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
