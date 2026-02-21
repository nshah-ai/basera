import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Calendar, RefreshCw, User, Users, Home, Check } from 'lucide-react';

interface Task {
  title: string;
  assignedTo: 'me' | 'partner' | 'shared';
  priority: 'high' | 'medium' | 'low';
  recurrence?: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  dueDate?: string;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  partnerName: string;
  onAddTask: (task: Omit<Task, 'id'>) => void;
}

export default function TaskModal({ isOpen, onClose, userName, partnerName, onAddTask }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState<'me' | 'partner' | 'shared'>('me');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    onAddTask({
      title,
      assignedTo,
      priority,
      recurrence: recurrence === 'none' ? undefined : recurrence,
      completed: false,
      dueDate: 'Today',
    });
    
    // Reset and close
    setTitle('');
    setAssignedTo('me');
    setPriority('medium');
    setRecurrence('none');
    onClose();
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

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
            className="fixed bottom-0 left-0 right-0 bg-[#1A2942] rounded-t-3xl z-50 max-w-md mx-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Task</h2>
                <button
                  onClick={onClose}
                  className="w-9 h-9 bg-[#0A1628] rounded-full flex items-center justify-center hover:bg-[#2D3F5F] transition-colors"
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
                  className="w-full bg-[#0A1628] border border-[#2D3F5F] rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6B9D] transition-all"
                />
              </div>

              {/* Assign To */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-3 block flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Assign to
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAssignedTo('me')}
                    className={`py-3 px-4 rounded-xl border transition-all ${
                      assignedTo === 'me'
                        ? 'bg-[#FF6B9D] border-[#FF6B9D] text-white'
                        : 'bg-[#0A1628] border-[#2D3F5F] text-gray-400 hover:border-[#FF6B9D]/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 ${assignedTo === 'me' ? 'bg-white/20' : 'bg-[#FF6B9D]'} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                        {getInitials(userName)}
                      </div>
                      <span className="text-xs">Me</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setAssignedTo('partner')}
                    className={`py-3 px-4 rounded-xl border transition-all ${
                      assignedTo === 'partner'
                        ? 'bg-[#4FD1C5] border-[#4FD1C5] text-white'
                        : 'bg-[#0A1628] border-[#2D3F5F] text-gray-400 hover:border-[#4FD1C5]/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 ${assignedTo === 'partner' ? 'bg-white/20' : 'bg-[#4FD1C5]'} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                        {getInitials(partnerName)}
                      </div>
                      <span className="text-xs">Partner</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setAssignedTo('shared')}
                    className={`py-3 px-4 rounded-xl border transition-all ${
                      assignedTo === 'shared'
                        ? 'bg-gradient-to-br from-[#FF6B9D] to-[#4FD1C5] border-transparent text-white'
                        : 'bg-[#0A1628] border-[#2D3F5F] text-gray-400 hover:border-[#FF6B9D]/50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 ${assignedTo === 'shared' ? 'bg-white/20' : 'bg-gradient-to-br from-[#FF6B9D] to-[#4FD1C5]'} rounded-full flex items-center justify-center text-white`}>
                        <Home className="w-4 h-4" />
                      </div>
                      <span className="text-xs">Shared</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Priority */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-3 block flex items-center gap-2">
                  <Flag className="w-4 h-4" />
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`py-3 px-4 rounded-xl border transition-all ${
                        priority === p
                          ? p === 'high'
                            ? 'bg-[#FF6B9D] border-[#FF6B9D] text-white'
                            : p === 'medium'
                            ? 'bg-[#FFB84D] border-[#FFB84D] text-white'
                            : 'bg-gray-600 border-gray-600 text-white'
                          : 'bg-[#0A1628] border-[#2D3F5F] text-gray-400 hover:border-gray-500'
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

              {/* Recurrence */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-3 block flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Repeat
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRecurrence(r)}
                      className={`py-3 px-3 rounded-xl border transition-all ${
                        recurrence === r
                          ? 'bg-[#4FD1C5] border-[#4FD1C5] text-white'
                          : 'bg-[#0A1628] border-[#2D3F5F] text-gray-400 hover:border-[#4FD1C5]/50'
                      }`}
                    >
                      <span className="text-xs capitalize">{r}</span>
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
                className="w-full bg-gradient-to-r from-[#FF6B9D] to-[#C084FC] text-white py-4 rounded-2xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#FF6B9D]/20 transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Add Task
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}