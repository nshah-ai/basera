'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, CheckCircle2, Circle, Flag, Calendar, RefreshCw, Home, User } from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { subscribeToTasks } from '@/lib/sync';
import { TaskModal } from './TaskModal';
import { Task } from '@/types';
import { useEffect } from 'react';

type ViewFilter = 'today' | 'thisWeek' | 'later';
type AssigneeFilter = 'all' | 'me' | 'partner' | 'shared';

export function TaskList() {
    const { tasks, users, toggleTask, householdId, setTasks } = useTaskStore();
    const [activeView, setActiveView] = useState<ViewFilter>('today');
    const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    useEffect(() => {
        if (!householdId) return;
        const unsubscribe = subscribeToTasks(householdId, (syncedTasks) => {
            setTasks(syncedTasks);
        });
        return () => unsubscribe();
    }, [householdId, setTasks]);

    const getInitials = (name: string) => name.charAt(0).toUpperCase();

    const getAvatarColor = (assigneeId: string | null) => {
        if (!assigneeId) return 'transparent';
        const user = users.find(u => u.id === assigneeId);
        return user ? `bg-[${user.avatarColor}]` : 'bg-surface';
    };

    const getPriorityColor = (priority: Task['priority']) => {
        if (priority === 'high') return 'text-primary';
        if (priority === 'medium') return 'text-mustard';
        return 'text-textMuted';
    };

    const filteredTasks = tasks.filter(task => {
        // Hide completed tasks older than 1 day
        if (task.status === 'completed') {
            const completedTime = task.completedAt || task.createdAt;
            if (Date.now() - completedTime > 24 * 60 * 60 * 1000) {
                return false;
            }
        }

        const taskDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // weekFromNow should be exactly 7 days from today, at the end of the day.
        const weekFromNow = new Date(today.getTime());
        weekFromNow.setDate(today.getDate() + 7);
        weekFromNow.setHours(23, 59, 59, 999);

        // View filter
        let matchesView = false;
        if (activeView === 'today') {
            matchesView = taskDate.toDateString() === today.toDateString();
        } else if (activeView === 'thisWeek') {
            matchesView = taskDate > today && taskDate <= weekFromNow;
        } else {
            matchesView = taskDate > weekFromNow;
        }

        // Assignee filter
        let matchesAssignee = true;
        if (assigneeFilter === 'me' && users.length > 0) {
            matchesAssignee = task.assigneeId === users[0].id;
        } else if (assigneeFilter === 'partner' && users.length > 1) {
            matchesAssignee = task.assigneeId === users[1].id;
        } else if (assigneeFilter === 'shared') {
            matchesAssignee = task.assigneeId === null;
        }

        return matchesView && matchesAssignee;
    }).sort((a, b) => {
        // Sort incomplete tasks above completed tasks
        if (a.status === 'pending' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status === 'pending') return 1;
        // If same status, sort by due date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    const pendingCount = filteredTasks.filter(t => t.status === 'pending').length;

    const handleTaskClick = (task: Task) => {
        setEditingTask(task);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingTask(null);
    };

    return (
        <div className="h-full flex flex-col max-w-md mx-auto">
            {/* Header */}
            <div className="p-6 pb-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-textMain">
                            {activeView === 'today' && 'Today'}
                            {activeView === 'thisWeek' && 'This Week'}
                            {activeView === 'later' && 'Later'}
                        </h1>
                        <p className="text-textMuted text-sm mt-1">
                            {pendingCount} tasks remaining
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            {users.map(user => (
                                <div
                                    key={user.id}
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm"
                                    style={{ backgroundColor: user.avatarColor }}
                                >
                                    {getInitials(user.name)}
                                </div>
                            ))}
                        </div>
                        {householdId && (
                            <div className="flex items-center gap-2 bg-surface rounded-full px-3 py-1 text-xs text-textMuted border border-border shadow-sm">
                                <span>Code: <strong className="text-textMain tracking-widest">{householdId}</strong></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex gap-2 bg-surface border border-border p-1 rounded-2xl mb-3 shadow-sm">
                    {(['today', 'thisWeek', 'later'] as const).map((view) => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${activeView === view
                                ? 'bg-background text-textMain shadow-sm border border-border/50'
                                : 'text-textMuted hover:text-textMain'
                                }`}
                        >
                            {view === 'today' ? 'Today' : view === 'thisWeek' ? 'This Week' : 'Later'}
                        </button>
                    ))}
                </div>

                {/* Assignee Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setAssigneeFilter('all')}
                        className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${assigneeFilter === 'all'
                            ? 'bg-textMain text-white border-transparent'
                            : 'bg-surface text-textMuted border-border hover:text-textMain'
                            }`}
                    >
                        All Tasks
                    </button>
                    {users.length > 0 && (
                        <button
                            onClick={() => setAssigneeFilter('me')}
                            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 border ${assigneeFilter === 'me'
                                ? 'text-white border-transparent'
                                : 'bg-surface text-textMuted border-border hover:text-textMain'
                                }`}
                            style={assigneeFilter === 'me' ? { backgroundColor: users[0].avatarColor } : {}}
                        >
                            <User className="w-3 h-3" />
                            {users[0].name}
                        </button>
                    )}
                    {users.length > 1 && (
                        <button
                            onClick={() => setAssigneeFilter('partner')}
                            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 border ${assigneeFilter === 'partner'
                                ? 'text-white border-transparent'
                                : 'bg-surface text-textMuted border-border hover:text-textMain'
                                }`}
                            style={assigneeFilter === 'partner' ? { backgroundColor: users[1].avatarColor } : {}}
                        >
                            <User className="w-3 h-3" />
                            {users[1].name}
                        </button>
                    )}
                    <button
                        onClick={() => setAssigneeFilter('shared')}
                        className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 border ${assigneeFilter === 'shared'
                            ? 'bg-sage text-white border-transparent'
                            : 'bg-surface text-textMuted border-border hover:text-textMain'
                            }`}
                    >
                        <Home className="w-3 h-3" />
                        Shared
                    </button>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto px-6 pb-24">
                <AnimatePresence mode="popLayout">
                    {filteredTasks.map((task, index) => {
                        const assignee = users.find(u => u.id === task.assigneeId);

                        return (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                layout
                                className="mb-3"
                            >
                                <div
                                    className={`bg-surface border border-border shadow-sm rounded-2xl p-4 transition-all cursor-pointer ${task.status === 'completed' ? 'opacity-50' : 'hover:border-primary/40'
                                        }`}
                                    onClick={(e) => {
                                        // Don't open modal if clicking checkbox
                                        if ((e.target as HTMLElement).closest('button')) return;
                                        handleTaskClick(task);
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Checkbox */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleTask(task.id, task.status);
                                            }}
                                            className="mt-0.5 flex-shrink-0"
                                        >
                                            {task.status === 'completed' ? (
                                                <motion.div
                                                    initial={{ scale: 0.8 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                                >
                                                    <CheckCircle2 className="w-6 h-6 text-sage fill-sage" />
                                                </motion.div>
                                            ) : (
                                                <Circle className={`w-6 h-6 ${getPriorityColor(task.priority)}`} />
                                            )}
                                        </button>

                                        {/* Task Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-textMuted' : 'text-textMain'}`}>
                                                    {task.title}
                                                </h3>
                                                {/* Avatar */}
                                                <div
                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                                                    style={{ backgroundColor: assignee?.avatarColor || 'transparent' }}
                                                >
                                                    {assignee ? getInitials(assignee.name) : <Home className="w-3.5 h-3.5" />}
                                                </div>
                                            </div>

                                            {/* Meta Info */}
                                            <div className="flex items-center gap-3 text-xs text-textMuted">
                                                <div className="flex items-center gap-1">
                                                    <Flag className={`w-3.5 h-3.5 ${getPriorityColor(task.priority)}`} />
                                                    <span className="capitalize">{task.priority}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                                </div>
                                                {task.recurrence !== 'none' && (
                                                    <div className="flex items-center gap-1">
                                                        <RefreshCw className="w-3.5 h-3.5 text-sage" />
                                                        <span className="capitalize">{task.recurrence}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {filteredTasks.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <CheckCircle2 className="w-8 h-8 text-sage" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1 text-textMain">All done!</h3>
                        <p className="text-textMuted text-sm">No tasks in this view</p>
                    </div>
                )}
            </div>

            {/* Floating Add Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    setEditingTask(null);
                    setIsModalOpen(true);
                }}
                className="fixed bottom-8 right-1/2 translate-x-1/2 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/30 hover:shadow-primary/50 transition-shadow z-50"
            >
                <Plus className="w-6 h-6 text-white" />
                <motion.div
                    className="absolute inset-0 rounded-full bg-primary"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.button>

            {/* Task Modal */}
            <TaskModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                editTask={editingTask}
            />
        </div>
    );
}
