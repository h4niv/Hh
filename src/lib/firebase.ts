import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  writeBatch,
  Firestore 
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { AttendanceRecord, LeaveRequest, Employee, OfficeConfig } from '../types';

export const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

const databaseId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? firebaseConfigJson.firestoreDatabaseId
  : undefined;

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

export const COLLECTIONS = {
  ATTENDANCE: 'attendance_records',
  LEAVE_REQUESTS: 'leave_requests',
  EMPLOYEES: 'employees',
  OFFICE_CONFIG: 'office_config',
} as const;

// Helper to sanitize object before saving to Firestore (remove undefined values)
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ----------------- SYNC FUNCTIONS FOR ATTENDANCE -----------------

export async function syncAttendanceRecordToFirestore(record: AttendanceRecord): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.ATTENDANCE, record.id);
    await setDoc(docRef, sanitizeForFirestore(record), { merge: true });
  } catch (err) {
    console.error('Error syncing attendance record to Firestore:', err);
  }
}

export async function deleteAttendanceRecordFromFirestore(recordId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.ATTENDANCE, recordId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting attendance record from Firestore:', err);
  }
}

export async function batchDeleteAttendanceRecordsFromFirestore(recordIds: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    recordIds.forEach((id) => {
      const docRef = doc(db, COLLECTIONS.ATTENDANCE, id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (err) {
    console.error('Error batch deleting attendance records from Firestore:', err);
  }
}

// ----------------- SYNC FUNCTIONS FOR LEAVE REQUESTS -----------------

export async function syncLeaveRequestToFirestore(request: LeaveRequest): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.LEAVE_REQUESTS, request.id);
    await setDoc(docRef, sanitizeForFirestore(request), { merge: true });
  } catch (err) {
    console.error('Error syncing leave request to Firestore:', err);
  }
}

export async function deleteLeaveRequestFromFirestore(requestId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.LEAVE_REQUESTS, requestId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting leave request from Firestore:', err);
  }
}

// ----------------- SYNC FUNCTIONS FOR EMPLOYEES -----------------

export async function syncEmployeeToFirestore(employee: Employee): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.EMPLOYEES, employee.id);
    await setDoc(docRef, sanitizeForFirestore(employee), { merge: true });
  } catch (err) {
    console.error('Error syncing employee to Firestore:', err);
  }
}

export async function deleteEmployeeFromFirestore(employeeId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.EMPLOYEES, employeeId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting employee from Firestore:', err);
  }
}

// ----------------- SYNC FUNCTIONS FOR OFFICE CONFIG -----------------

export async function syncOfficeConfigToFirestore(config: OfficeConfig): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.OFFICE_CONFIG, 'settings');
    await setDoc(docRef, sanitizeForFirestore(config), { merge: true });
  } catch (err) {
    console.error('Error syncing office config to Firestore:', err);
  }
}

// ----------------- INITIAL SEED TO FIRESTORE IF EMPTY -----------------

export async function seedInitialDataIfEmpty(
  initialEmployees: Employee[],
  initialRecords: AttendanceRecord[],
  initialRequests: LeaveRequest[],
  initialConfig: OfficeConfig
): Promise<void> {
  try {
    // Check if employees collection has documents
    const empSnap = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
    if (empSnap.empty && initialEmployees.length > 0) {
      console.log('Seeding employees to Firestore...');
      const batch = writeBatch(db);
      initialEmployees.forEach((emp) => {
        const ref = doc(db, COLLECTIONS.EMPLOYEES, emp.id);
        batch.set(ref, sanitizeForFirestore(emp));
      });
      await batch.commit();
    }

    // Check if attendance collection has documents
    const attSnap = await getDocs(collection(db, COLLECTIONS.ATTENDANCE));
    if (attSnap.empty && initialRecords.length > 0) {
      console.log('Seeding attendance records to Firestore...');
      // Batch in chunks of 450 (Firestore limit is 500)
      const chunkSize = 400;
      for (let i = 0; i < initialRecords.length; i += chunkSize) {
        const chunk = initialRecords.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((rec) => {
          const ref = doc(db, COLLECTIONS.ATTENDANCE, rec.id);
          batch.set(ref, sanitizeForFirestore(rec));
        });
        await batch.commit();
      }
    }

    // Check if leave requests collection has documents
    const reqSnap = await getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS));
    if (reqSnap.empty && initialRequests.length > 0) {
      console.log('Seeding leave requests to Firestore...');
      const batch = writeBatch(db);
      initialRequests.forEach((req) => {
        const ref = doc(db, COLLECTIONS.LEAVE_REQUESTS, req.id);
        batch.set(ref, sanitizeForFirestore(req));
      });
      await batch.commit();
    }

    // Check office config
    const configSnap = await getDocs(collection(db, COLLECTIONS.OFFICE_CONFIG));
    if (configSnap.empty) {
      console.log('Seeding office config to Firestore...');
      await setDoc(doc(db, COLLECTIONS.OFFICE_CONFIG, 'settings'), sanitizeForFirestore(initialConfig));
    }
  } catch (err) {
    console.error('Error during initial Firestore seed:', err);
  }
}

// ----------------- REAL-TIME SUBSCRIPTIONS -----------------

export function subscribeToEmployees(onData: (employees: Employee[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, COLLECTIONS.EMPLOYEES),
    (snapshot) => {
      if (!snapshot.empty) {
        const emps = snapshot.docs.map((d) => d.data() as Employee);
        onData(emps);
      }
    },
    (err) => {
      console.warn('Firestore employees subscription warning:', err);
      onError?.(err);
    }
  );
}

export function subscribeToAttendance(onData: (records: AttendanceRecord[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, COLLECTIONS.ATTENDANCE),
    (snapshot) => {
      if (!snapshot.empty) {
        const recs = snapshot.docs.map((d) => d.data() as AttendanceRecord);
        // Sort newest first
        recs.sort((a, b) => (b.date + (b.checkInTime || '')).localeCompare(a.date + (a.checkInTime || '')));
        onData(recs);
      }
    },
    (err) => {
      console.warn('Firestore attendance subscription warning:', err);
      onError?.(err);
    }
  );
}

export function subscribeToLeaveRequests(onData: (requests: LeaveRequest[]) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    collection(db, COLLECTIONS.LEAVE_REQUESTS),
    (snapshot) => {
      if (!snapshot.empty) {
        const reqs = snapshot.docs.map((d) => d.data() as LeaveRequest);
        reqs.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
        onData(reqs);
      }
    },
    (err) => {
      console.warn('Firestore leave requests subscription warning:', err);
      onError?.(err);
    }
  );
}

export function subscribeToOfficeConfig(onData: (config: OfficeConfig) => void, onError?: (err: Error) => void) {
  return onSnapshot(
    doc(db, COLLECTIONS.OFFICE_CONFIG, 'settings'),
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as OfficeConfig);
      }
    },
    (err) => {
      console.warn('Firestore office config subscription warning:', err);
      onError?.(err);
    }
  );
}

export async function forceSyncAllToFirestore(
  employees: Employee[],
  records: AttendanceRecord[],
  requests: LeaveRequest[],
  config: OfficeConfig
): Promise<{ success: boolean; count: number }> {
  try {
    let totalCount = 0;

    // 1. Employees
    const empBatch = writeBatch(db);
    employees.forEach((emp) => {
      empBatch.set(doc(db, COLLECTIONS.EMPLOYEES, emp.id), sanitizeForFirestore(emp), { merge: true });
      totalCount++;
    });
    await empBatch.commit();

    // 2. Attendance records in batches
    const chunkSize = 400;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        batch.set(doc(db, COLLECTIONS.ATTENDANCE, rec.id), sanitizeForFirestore(rec), { merge: true });
        totalCount++;
      });
      await batch.commit();
    }

    // 3. Leave requests
    const reqBatch = writeBatch(db);
    requests.forEach((req) => {
      reqBatch.set(doc(db, COLLECTIONS.LEAVE_REQUESTS, req.id), sanitizeForFirestore(req), { merge: true });
      totalCount++;
    });
    await reqBatch.commit();

    // 4. Config
    await setDoc(doc(db, COLLECTIONS.OFFICE_CONFIG, 'settings'), sanitizeForFirestore(config), { merge: true });
    totalCount++;

    return { success: true, count: totalCount };
  } catch (err) {
    console.error('Force sync to Firestore failed:', err);
    throw err;
  }
}

