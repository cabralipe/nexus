export enum UserRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  FINANCIAL = 'FINANCIAL',
  ACADEMIC = 'ACADEMIC',
  SETTINGS = 'SETTINGS',
  COMMUNICATION = 'COMMUNICATION',
  TEACHER_MONITORING = 'TEACHER_MONITORING',
  LESSON_PLANS = 'LESSON_PLANS',
  ABSENCE_JUSTIFICATION = 'ABSENCE_JUSTIFICATION',
  PEDAGOGICAL = 'PEDAGOGICAL',
  INVENTORY = 'INVENTORY',
  TEACHER_INVENTORY = 'TEACHER_INVENTORY',
  REGISTRATION = 'REGISTRATION',
  CLASS_ALLOCATION = 'CLASS_ALLOCATION',
  TEACHER_SUBJECTS = 'TEACHER_SUBJECTS',
  SCHEDULE = 'SCHEDULE'
}

export interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  attendance: number;
  tuitionStatus: 'Paid' | 'Late' | 'Pending';
}

// Detailed Profile for Registration Module
export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
  isLegalGuardian: boolean;
}

export interface StudentProfile extends Student {
  dob: string;
  cpf: string;
  mainAddress: string;
  reserveAddress?: string;
  healthInfo: {
    allergies: string[];
    medications: string[];
    conditions: string;
    bloodType?: string;
  };
  emergencyContacts: EmergencyContact[];
}

export interface Staff {
  id: string;
  name: string;
  role: 'Teacher' | 'Coordinator' | 'Admin' | 'Support';
  department: string;
  phone: string;
  email: string;
  admissionDate: string;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g., "9º Ano A"
  gradeLevel: string; // e.g., "9º Ano"
  shift: 'Morning' | 'Afternoon' | 'Night';
  academicYear: number;
  capacity: number;
  enrolledStudentIds: string[];
  teacherAllocations: {
    subject: string;
    teacherId: string;
  }[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Stationery' | 'Cleaning' | 'Electronics' | 'Didactic';
  quantity: number;
  minQuantity: number;
  unit: string;
  location: string;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
}

export interface ClassSession {
  id: string;
  subject: string;
  time: string;
  topic: string;
  room: string;
}

export interface Invoice {
  id: string;
  studentName: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface GradeRecord {
  id: string;
  studentName: string;
  subject: string;
  grade1: number;
  grade2: number;
  average: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  type: 'General' | 'Urgent' | 'Academic';
}

export interface GradingConfig {
  system: 'bimestral' | 'trimestral';
  calculationMethod: 'arithmetic' | 'weighted';
  minPassingGrade: number;
  weights: {
    exam: number;
    activities: number;
    participation: number;
  };
  recoveryType: 'none' | 'grade' | 'exam';
  recoveryRule: string;
}

export interface ClassDiaryEntry {
  id: string;
  date: string;
  subject: string;
  topic: string;
  description: string;
  homework: string;
}

export interface AttendanceRecord {
  studentId: string;
  date: string;
  subject?: string;
  status: 'present' | 'absent' | 'excused';
}

export interface TeacherActivity {
  id: string;
  name: string;
  subject: string;
  lastLogin: string;
  lastDiaryUpdate: string;
  lastAttendanceUpdate: string;
  status: 'Active' | 'Idle' | 'Warning';
}

export interface Absence {
  id: string;
  studentName: string;
  date: string;
  subject: string;
  justified: boolean;
  reason?: string;
  observation?: string;
}

export interface AcademicTarget {
  id: string;
  month: string;
  requiredClasses: number;
  gradeSubmissionDeadline: string;
  examSubmissionDeadline: string;
}

export interface ExamSubmission {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  gradeLevel: string;
  type: 'Standard' | 'Adapted';
  status: 'Pending' | 'Approved' | 'ChangesRequested';
  submittedDate: string;
  feedback?: string;
  studentName?: string; // Only for Adapted exams
}
