import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, User } from '@/types';
import {
    addTaskSync,
    updateTaskStatusSync,
    deleteTaskSync,
    updateTaskSync
} from '@/lib/sync';

interface TaskState {
    tasks: Task[];
    users: User[];
    currentUser: string | null;
    householdId: string | null;

    // Local State Actions (driven by Firebase Snapshot or App Initialization)
    setTasks: (tasks: Task[]) => void;
    setUsers: (users: User[]) => void;
    setCurrentUser: (id: string | null) => void;
    setHouseholdId: (id: string | null) => void;

    // Firebase Sync Actions
    addTask: (task: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
    toggleTask: (id: string, currentStatus: 'pending' | 'completed') => void;
    deleteTask: (id: string) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            users: [],
            currentUser: null,
            householdId: null,

            setTasks: (tasks) => set({ tasks }),
            setUsers: (users) => set({ users }),
            setCurrentUser: (id) => set({ currentUser: id }),
            setHouseholdId: (id) => set({ householdId: id }),

            addTask: async (taskData) => {
                const { householdId, users } = get();
                if (!householdId) return;
                try {
                    await addTaskSync(householdId, taskData, users);
                } catch (e) {
                    console.error("Failed to add task", e);
                }
            },

            toggleTask: async (id, currentStatus) => {
                const { householdId, users } = get();
                if (!householdId) return;
                const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
                try {
                    await updateTaskStatusSync(householdId, id, newStatus, users);
                } catch (e) {
                    console.error("Failed to update status", e);
                }
            },

            deleteTask: async (id) => {
                const { householdId, users } = get();
                if (!householdId) return;
                try {
                    await deleteTaskSync(householdId, id, users);
                } catch (e) {
                    console.error("Failed to delete", e);
                }
            },

            updateTask: async (id, updates) => {
                const { householdId, users } = get();
                if (!householdId) return;
                try {
                    await updateTaskSync(householdId, id, updates, users);
                } catch (e) {
                    console.error("Failed to update task", e);
                }
            }
        }),
        {
            name: 'household-sync-storage',
            // It's safe to persist everything. `tasks` will be instantly overwritten by Firebase on load,
            // providing an offline-friendly "optimistic" load.
        }
    )
);
