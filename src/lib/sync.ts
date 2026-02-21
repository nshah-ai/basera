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

export const createHousehold = async (users: User[]): Promise<string> => {
    // Generate a short 6-character code for easy joining
    const householdId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const writePromise = setDoc(doc(db, 'households', householdId), {
        users,
        createdAt: serverTimestamp(),
    });

    await withTimeout(
        writePromise,
        8000,
        "Firestore write timed out. Have you initialized your Firestore Database in the Firebase Console?"
    );

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

export const addTaskSync = async (householdId: string, task: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    const taskId = generateId();
    const taskRef = doc(db, 'households', householdId.toUpperCase(), 'tasks', taskId);

    await setDoc(taskRef, {
        ...task,
        status: 'pending',
        createdAt: Date.now(), // using client time for easier sorting consistency across platforms
    });
};

export const updateTaskStatusSync = async (householdId: string, taskId: string, status: 'pending' | 'completed') => {
    const taskRef = doc(db, 'households', householdId.toUpperCase(), 'tasks', taskId);
    const updateData: any = { status };
    if (status === 'completed') {
        updateData.completedAt = Date.now();
    } else {
        updateData.completedAt = null;
    }
    await updateDoc(taskRef, updateData);
};

export const updateTaskSync = async (householdId: string, taskId: string, updates: Partial<Task>) => {
    const taskRef = doc(db, 'households', householdId.toUpperCase(), 'tasks', taskId);
    await updateDoc(taskRef, updates);
};

export const deleteTaskSync = async (householdId: string, taskId: string) => {
    const taskRef = doc(db, 'households', householdId.toUpperCase(), 'tasks', taskId);
    await deleteDoc(taskRef);
};
