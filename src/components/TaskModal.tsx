'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, RefreshCw, User, Home, Check, Calendar } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { Priority, Recurrence, Task } from '@/types';

type Deadline = 'today' | 'thisWeek' | 'later';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    editTask?: Task | null;
}

export function TaskModal({ isOpen, onClose, editTask }: TaskModalProps) {
    const { addTask, users } = useTaskStore();
    const [title, setTitle] = useState('');
    const [assignedTo, setAssignedTo] = useState<string | null>(null);
    const [priority, setPriority] = useState<Priority>('medium');
    const [recurrence, setRecurrence] = useState<Recurrence>('none');
    const [deadline, setDeadline] = useState<Deadline>('today');

    // Populate form when editing
    useEffect(() => {
        if (editTask) {
            setTitle(editTask.title);
            setAssignedTo(editTask.assigneeId);
            setPriority(editTask.priority);
            setRecurrence(editTask.recurrence);
            // Determine deadline from dueDate
            const dueDate = new Date(editTask.dueDate);
            const today = new Date();
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            if (dueDate.toDateString() === today.toDateString()) {
                setDeadline('today');
            } else if (dueDate <= weekFromNow) {
                setDeadline('thisWeek');
            } else {
                setDeadline('later');
            }
        } else {
            // Reset form for new task
            setTitle('');
            setAssignedTo(null);
            setPriority('medium');
            setRecurrence('none');
            setDeadline('today');
        }
    }, [editTask, isOpen]);

    const handleSubmit = () => {
        if (!title.trim()) return;

        // Calculate due date based on deadline
        let dueDate = new Date();
        if (deadline === 'thisWeek') {
            dueDate.setDate(dueDate.getDate() + 7);
        } else if (deadline === 'later') {
            dueDate.setDate(dueDate.getDate() + 30);
        }

        if (editTask) {
            // Update existing task
            useTaskStore.getState().updateTask(editTask.id, {
                title,
                assigneeId: assignedTo,
                priority,
                recurrence,
                dueDate: dueDate.toISOString(),
            });
        } else {
            // Add new task
            addTask({
                title,
                assigneeId: assignedTo,
                priority,
                recurrence,
                dueDate: dueDate.toISOString(),
            });
        }

        onClose();
    };

    const getInitials = (name: string) => name.charAt(0).toUpperCase();

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-surface rounded-t-3xl z-50 max-w-md mx-auto shadow-[0_-8px_30px_rgb(0,0,0,0.05)] border-t border-border"
                    >
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-textMain">{editTask ? 'Edit Task' : 'Add Task'}</h2>
                                <button
                                    onClick={onClose}
                                    className="w-9 h-9 bg-background rounded-full flex items-center justify-center hover:bg-border transition-colors text-textMuted hover:text-textMain"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Task Title Input */}
                            <div className="mb-6">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="What needs to be done?"
                                    autoFocus
                                    className="w-full bg-background border border-border rounded-2xl px-5 py-4 text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-all shadow-sm"
                                />
                            </div>

                            {/* Assign To */}
                            <div className="mb-6">
                                <label className="text-sm text-textMuted mb-3 block flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Assign to
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {users.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => setAssignedTo(user.id)}
                                            className={`py-3 px-4 rounded-xl border transition-all ${assignedTo === user.id
                                                ? 'border-transparent text-white'
                                                : 'bg-background border-border text-textMuted hover:border-textMuted/50'
                                                }`}
                                            style={assignedTo === user.id ? { backgroundColor: user.avatarColor } : {}}
                                        >
                                            <div className="flex flex-col items-center gap-1">
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs`}
                                                    style={{ backgroundColor: assignedTo === user.id ? 'rgba(255,255,255,0.2)' : user.avatarColor }}
                                                >
                                                    {getInitials(user.name)}
                                                </div>
                                                <span className="text-xs">{user.name}</span>
                                            </div>
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => setAssignedTo(null)}
                                        className={`py-3 px-4 rounded-xl border transition-all ${assignedTo === null
                                            ? 'bg-sage border-transparent text-white'
                                            : 'bg-background border-border text-textMuted hover:border-textMuted/50'
                                            }`}
                                    >
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-8 h-8 ${assignedTo === null ? 'bg-white/20' : 'bg-sage'} rounded-full flex items-center justify-center text-white`}>
                                                <Home className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs">Shared</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Priority */}
                            <div className="mb-6">
                                <label className="text-sm text-textMuted mb-3 block flex items-center gap-2">
                                    <Flag className="w-4 h-4" />
                                    Priority
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['high', 'medium', 'low'] as const).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPriority(p)}
                                            className={`py-3 px-4 rounded-xl border transition-all ${priority === p
                                                ? p === 'high'
                                                    ? 'bg-primary border-primary text-white'
                                                    : p === 'medium'
                                                        ? 'bg-mustard border-mustard text-white'
                                                        : 'bg-textMuted border-textMuted text-white'
                                                : 'bg-background border-border text-textMuted hover:border-textMuted'
                                                }`}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Flag className="w-4 h-4" />
                                                <span className="text-sm capitalize">{p}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Deadline */}
                            <div className="mb-6">
                                <label className="text-sm text-textMuted mb-3 block flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Deadline
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['today', 'thisWeek', 'later'] as const).map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setDeadline(d)}
                                            className={`py-3 px-4 rounded-xl border transition-all ${deadline === d
                                                ? 'bg-sage border-sage text-white'
                                                : 'bg-background border-border text-textMuted hover:border-sage/50'
                                                }`}
                                        >
                                            <span className="text-sm capitalize">
                                                {d === 'today' ? 'Today' : d === 'thisWeek' ? 'This Week' : 'Later'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Recurrence */}
                            <div className="mb-6">
                                <label className="text-sm text-textMuted mb-3 block flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" />
                                    Repeat
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setRecurrence(r)}
                                            className={`py-3 px-3 rounded-xl border transition-all ${recurrence === r
                                                ? 'bg-sage border-sage text-white'
                                                : 'bg-background border-border text-textMuted hover:border-sage/50'
                                                }`}
                                        >
                                            <span className="text-xs capitalize">{r === 'none' ? 'Once' : r}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSubmit}
                                disabled={!title.trim()}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Check className="w-5 h-5" />
                                {editTask ? 'Update Task' : 'Add Task'}
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
