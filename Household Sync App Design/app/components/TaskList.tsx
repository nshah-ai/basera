import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, CheckCircle2, Circle, Flag, Calendar, RefreshCw, Home, Sparkles } from 'lucide-react';
import TaskModal from '@/app/components/TaskModal';

interface Task {
  id: string;
  title: string;
  assignedTo: 'me' | 'partner' | 'shared';
  priority: 'high' | 'medium' | 'low';
  recurrence?: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  dueDate?: string;
}

interface TaskListProps {
  userName: string;
  partnerName: string;
}

export default function TaskList({ userName, partnerName }: TaskListProps) {
  const [activeView, setActiveView] = useState<'today' | 'upcoming' | 'all'>('today');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Grocery shopping',
      assignedTo: 'me',
      priority: 'high',
      completed: false,
      dueDate: 'Today',
    },
    {
      id: '2',
      title: 'Clean the kitchen',
      assignedTo: 'shared',
      priority: 'medium',
      completed: false,
      dueDate: 'Today',
      recurrence: 'daily',
    },
    {
      id: '3',
      title: 'Water the plants',
      assignedTo: 'partner',
      priority: 'low',
      completed: true,
      dueDate: 'Today',
    },
    {
      id: '4',
      title: 'Pay electricity bill',
      assignedTo: 'me',
      priority: 'high',
      completed: false,
      dueDate: 'Tomorrow',
      recurrence: 'monthly',
    },
    {
      id: '5',
      title: 'Schedule dentist appointment',
      assignedTo: 'partner',
      priority: 'medium',
      completed: false,
      dueDate: 'This week',
    },
  ]);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const handleAddTask = (newTask: Omit<Task, 'id'>) => {
    const task: Task = {
      ...newTask,
      id: Date.now().toString(),
    };
    setTasks([task, ...tasks]);
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (assignedTo: Task['assignedTo']) => {
    if (assignedTo === 'me') return 'bg-[#FF6B9D]';
    if (assignedTo === 'partner') return 'bg-[#4FD1C5]';
    return 'bg-gradient-to-br from-[#FF6B9D] to-[#4FD1C5]';
  };

  const getPriorityColor = (priority: Task['priority']) => {
    if (priority === 'high') return 'text-[#FF6B9D]';
    if (priority === 'medium') return 'text-[#FFB84D]';
    return 'text-gray-500';
  };

  const filteredTasks = tasks.filter(task => {
    if (activeView === 'today') return task.dueDate === 'Today';
    if (activeView === 'upcoming') return task.dueDate !== 'Today';
    return true;
  });

  return (
    <div className="h-full flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {activeView === 'today' && 'Today'}
              {activeView === 'upcoming' && 'Upcoming'}
              {activeView === 'all' && 'All Tasks'}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {filteredTasks.filter(t => !t.completed).length} tasks remaining
            </p>
          </div>
          <div className="flex gap-2">
            <div className={`w-10 h-10 ${getAvatarColor('me')} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
              {getInitials(userName)}
            </div>
            <div className={`w-10 h-10 ${getAvatarColor('partner')} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
              {getInitials(partnerName)}
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 bg-[#1A2942] p-1 rounded-2xl">
          {(['today', 'upcoming', 'all'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                activeView === view
                  ? 'bg-gradient-to-r from-[#FF6B9D] to-[#C084FC] text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task, index) => (
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
                className={`bg-[#1A2942] border border-[#2D3F5F] rounded-2xl p-4 transition-all ${
                  task.completed ? 'opacity-50' : 'hover:border-[#FF6B9D]/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="mt-0.5 flex-shrink-0"
                  >
                    {task.completed ? (
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <CheckCircle2 className="w-6 h-6 text-[#4FD1C5] fill-[#4FD1C5]" />
                      </motion.div>
                    ) : (
                      <Circle className={`w-6 h-6 ${getPriorityColor(task.priority)}`} />
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                        {task.title}
                      </h3>
                      {/* Avatar */}
                      <div className={`w-7 h-7 ${getAvatarColor(task.assignedTo)} rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0`}>
                        {task.assignedTo === 'me' && getInitials(userName)}
                        {task.assignedTo === 'partner' && getInitials(partnerName)}
                        {task.assignedTo === 'shared' && <Home className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Flag className={`w-3.5 h-3.5 ${getPriorityColor(task.priority)}`} />
                        <span className="capitalize">{task.priority}</span>
                      </div>
                      {task.dueDate && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{task.dueDate}</span>
                        </div>
                      )}
                      {task.recurrence && (
                        <div className="flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="capitalize">{task.recurrence}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-[#1A2942] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#4FD1C5]" />
            </div>
            <h3 className="text-lg font-semibold mb-1">All done!</h3>
            <p className="text-gray-400 text-sm">No tasks in this view</p>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-1/2 translate-x-1/2 w-14 h-14 bg-gradient-to-r from-[#FF6B9D] to-[#C084FC] rounded-full flex items-center justify-center shadow-2xl shadow-[#FF6B9D]/30 hover:shadow-[#FF6B9D]/50 transition-shadow"
      >
        <Plus className="w-6 h-6 text-white" />
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF6B9D] to-[#C084FC]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5],
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
        onClose={() => setIsModalOpen(false)}
        userName={userName}
        partnerName={partnerName}
        onAddTask={handleAddTask}
      />
    </div>
  );
}