import { db } from './firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    query,
    orderBy,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import { Task, User } from '@/types';
import { generateId } from '@/utils/uuid';

const withTimeout = <T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
};

export const ensureHouseholdDoc = async (householdId: string, users: User[]) => {
    const docRef = doc(db, 'households', householdId.toUpperCase());
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        console.log(`🏠 Restoring missing household document: ${householdId}`);
        await setDoc(docRef, {
            users,
            createdAt: serverTimestamp(),
            isRestored: true, // Tagging it as restored for auditing
        });
    }
};

export const createHousehold = async (users: User[]): Promise<string> => {
    // Generate a short 6-character code for easy joining
    const householdId = Math.random().toString(36).substring(2, 8).toUpperCase();

    console.log(`📡 Creating household: ${householdId}`);

    const writePromise = setDoc(doc(db, 'households', householdId), {
        users,
        createdAt: serverTimestamp(),
    });

    await withTimeout(
        writePromise,
        8000,
        "Firestore write timed out. Have you initialized your Firestore Database in the Firebase Console?"
    );

    console.log(`✅ Household ${householdId} created successfully.`);
    return householdId;
};

export const joinHousehold = async (householdId: string): Promise<User[] | null> => {
    const docRef = doc(db, 'households', householdId.toUpperCase());

    const docSnap = await withTimeout(
        getDoc(docRef),
        8000,
        "Firestore read timed out. Have you initialized your Firestore Database in the Firebase Console?"
    );

    if (docSnap.exists()) {
        return docSnap.data().users as User[];
    }
    return null;
};

export const subscribeToTasks = (householdId: string, callback: (tasks: Task[]) => void) => {
    const q = query(
        collection(db, 'households', householdId.toUpperCase(), 'tasks'),
        orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        callback(tasks);
    });
};

export const addTaskSync = async (householdId: string, task: Omit<Task, 'id' | 'createdAt' | 'status'>, currentUsers: User[]) => {
    const taskId = generateId();
    const hId = householdId.toUpperCase();
    const taskRef = doc(db, 'households', hId, 'tasks', taskId);

    console.log(`📡 Syncing task to: households/${hId}/tasks/${taskId}`);

    try {
        // First ensure the parent household exists (self-healing)
        await ensureHouseholdDoc(hId, currentUsers);

        await setDoc(taskRef, {
            ...task,
            status: 'pending',
            createdAt: Date.now(),
        });
        console.log(`✅ Task synced successfully.`);
    } catch (error) {
        console.error(`❌ Failed to sync task:`, error);
        throw error;
    }
};

export const updateTaskStatusSync = async (householdId: string, taskId: string, status: 'pending' | 'completed', currentUsers: User[]) => {
    const hId = householdId.toUpperCase();
    const taskRef = doc(db, 'households', hId, 'tasks', taskId);

    // Self-healing
    await ensureHouseholdDoc(hId, currentUsers);

    const updateData: any = { status };
    if (status === 'completed') {
        updateData.completedAt = Date.now();
    } else {
        updateData.completedAt = null;
    }
    await updateDoc(taskRef, updateData);
};

export const updateTaskSync = async (householdId: string, taskId: string, updates: Partial<Task>, currentUsers: User[]) => {
    const hId = householdId.toUpperCase();
    const taskRef = doc(db, 'households', hId, 'tasks', taskId);

    // Self-healing
    await ensureHouseholdDoc(hId, currentUsers);

    await updateDoc(taskRef, updates);
};

export const deleteTaskSync = async (householdId: string, taskId: string, currentUsers: User[]) => {
    const hId = householdId.toUpperCase();
    const taskRef = doc(db, 'households', hId, 'tasks', taskId);

    // Self-healing
    await ensureHouseholdDoc(hId, currentUsers);

    await deleteDoc(taskRef);
};
