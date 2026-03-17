export type Priority = 'high' | 'medium' | 'low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'pending' | 'completed';

export interface User {
    id: string;
    name: string;
    avatarColor: string; // Hex code for avatar background
    phoneNumber?: string; // For WhatsApp notifications
}

export interface Task {
    id: string;
    title: string;
    assigneeId: string | null; // null means 'Shared'
    status: TaskStatus;
    priority: Priority;
    recurrence: Recurrence;
    dueDate: string; // ISO Date string
    createdAt: number;
    completedAt?: number;
}
