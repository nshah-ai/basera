export type Priority = 'high' | 'medium' | 'low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'pending' | 'completed';

export interface User {
    id: string;
    name: string;
    avatarColor: string; // Hex code for avatar background
    phoneNumber?: string; // For WhatsApp notifications

    // Meal Planning MVP
    dietaryType?: string; // e.g., 'vegetarian', 'vegan', 'omnivore'
    dislikes?: string[];
    cuisinePreferences?: string[];
    cookSkillLevel?: 'low' | 'medium' | 'high';
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

// --- Meal Planning MVP Models ---

export interface Meal {
    id: string; // E.g., 'dal-tadka'
    name: string;
    cuisineType?: string;
    difficultyLevel?: 'low' | 'medium' | 'high';
    ingredients: string[];
}

export interface MealLog {
    id: string; // Date string 'YYYY-MM-DD'
    date: string;
    suggestedOptions: {
        id: string; // 'option1'
        meals: { breakfast: Meal; lunch: Meal; dinner: Meal };
    }[];
    selectedOptionId?: string;
    modifiers?: string; // e.g., "Breakfast only for 1 person"
    executed?: boolean; // filled next day
    satisfaction?: 'thumb_up' | 'thumb_down'; // filled next day
    createdAt: any; // Firestore timestamp
}

export interface IngredientMemory {
    id: string; // e.g., 'paneer'
    name: string;
    lastOrderedDate?: any; // Firestore timestamp
    lastOrderedQuantity?: string; // e.g., '200g'
    estimatedRemaining: 'high' | 'medium' | 'low' | 'none';
}

export interface HouseholdBotState {
    currentState: 'IDLE' | 'AWAITING_MEAL_SELECTION' | 'AWAITING_ORDER_APPROVAL' | 'AWAITING_EXECUTION_CHECK';
    lastUpdated: any; // Firestore timestamp
    pendingMealDate?: string; // the YYYY-MM-DD being planned
}

