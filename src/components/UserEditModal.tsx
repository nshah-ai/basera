'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, Phone, Save } from 'lucide-react';
import { User } from '@/types';
import { updateUserProfile } from '@/lib/sync';

interface UserEditModalProps {
    user: User;
    householdId: string;
    onClose: () => void;
    onUpdate: (updatedUsers: User[]) => void;
}

export function UserEditModal({ user, householdId, onClose, onUpdate }: UserEditModalProps) {
    const [name, setName] = useState(user.name);
    const [phone, setPhone] = useState(user.phoneNumber || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            const updatedUsers = await updateUserProfile(householdId, user.id, {
                name: name.trim(),
                phoneNumber: phone.trim() || undefined
            });
            if (updatedUsers) {
                onUpdate(updatedUsers);
                onClose();
            }
        } catch (err) {
            console.error(err);
            setError('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />

            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="relative w-full max-w-lg bg-surface border border-border shadow-2xl rounded-t-[32px] sm:rounded-[32px] overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm"
                            style={{ backgroundColor: user.avatarColor }}
                        >
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-textMain">Edit Profile</h3>
                            <p className="text-xs text-textMuted">Update household identity</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-border/30 rounded-full transition-colors text-textMuted"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 block px-1">
                                Display Name
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., Anjali"
                                    className="w-full bg-surface-alt border border-border rounded-2xl pl-11 pr-4 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-2 block px-1">
                                WhatsApp Number
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1234567890"
                                    className="w-full bg-surface-alt border border-border rounded-2xl pl-11 pr-4 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                                />
                            </div>
                            <p className="text-[10px] text-textMuted mt-2 px-1 italic">
                                *Required for WhatsApp task management. Use international format.
                            </p>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
