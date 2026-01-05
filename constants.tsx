import React from 'react';
import { LayoutDashboard, Wallet, BookOpen, Settings, Users, MessageCircle, Activity, ClipboardCheck, GraduationCap, Package, UserPlus, Grid, CalendarClock, BookUser, ClipboardList } from 'lucide-react';
import { UserRole, ViewState, GradingConfig, InventoryItem, StudentProfile, Staff, SchoolClass } from './types';

export const MOCK_STUDENTS = [
  { id: '1', name: 'Alice Ferreira', grade: '9A', attendance: 95, tuitionStatus: 'Paid' as const },
  { id: '2', name: 'Bruno Silva', grade: '9A', attendance: 82, tuitionStatus: 'Late' as const },
  { id: '3', name: 'Carla Dias', grade: '9B', attendance: 98, tuitionStatus: 'Paid' as const },
  { id: '4', name: 'Daniel Costa', grade: '9A', attendance: 88, tuitionStatus: 'Pending' as const },
  { id: '5', name: 'Eduardo Mello', grade: '8C', attendance: 75, tuitionStatus: 'Late' as const },
];

export const MOCK_FULL_STUDENT_PROFILES: StudentProfile[] = [
    {
        id: '1', name: 'Alice Ferreira', grade: '9A', attendance: 95, tuitionStatus: 'Paid',
        dob: '2009-05-12', cpf: '123.456.789-00',
        mainAddress: 'Rua das Flores, 123, Centro',
        reserveAddress: 'Av. Paulista, 1000 (Avó)',
        healthInfo: {
            allergies: ['Amendoim', 'Dipirona'],
            medications: [],
            conditions: 'Nenhuma',
            bloodType: 'A+'
        },
        emergencyContacts: [
            { name: 'Maria Ferreira', relation: 'Mãe', phone: '(11) 99999-1111', isLegalGuardian: true },
            { name: 'João Ferreira', relation: 'Pai', phone: '(11) 99999-2222', isLegalGuardian: true }
        ]
    },
    {
        id: '5', name: 'Eduardo Mello', grade: '8C', attendance: 75, tuitionStatus: 'Late',
        dob: '2010-02-20', cpf: '321.654.987-11',
        mainAddress: 'Rua do Bosque, 45, Vila Nova',
        healthInfo: {
            allergies: [],
            medications: ['Ritalina (Manhã)'],
            conditions: 'TDAH',
            bloodType: 'O-'
        },
        emergencyContacts: [
            { name: 'Sandra Mello', relation: 'Mãe', phone: '(11) 98888-3333', isLegalGuardian: true }
        ]
    }
];

export const MOCK_STAFF: Staff[] = [
    { id: '1', name: 'Carlos Roberto', role: 'Teacher', department: 'Matemática', phone: '(11) 91234-5678', email: 'carlos@escola.com', admissionDate: '2020-02-01' },
    { id: '2', name: 'Ana Souza', role: 'Coordinator', department: 'Pedagógico', phone: '(11) 92345-6789', email: 'ana@escola.com', admissionDate: '2018-05-15' },
    { id: '3', name: 'Marcos Oliveira', role: 'Support', department: 'Manutenção', phone: '(11) 93456-7890', email: 'marcos@escola.com', admissionDate: '2021-01-10' },
    { id: '4', name: 'Fernanda Lima', role: 'Teacher', department: 'Português', phone: '(11) 95555-5555', email: 'fernanda@escola.com', admissionDate: '2019-03-01' },
    { id: '5', name: 'Julia Martins', role: 'Teacher', department: 'Geografia', phone: '(11) 95555-1234', email: 'julia@escola.com', admissionDate: '2019-03-01' },
];

export const MOCK_SCHOOL_CLASSES: SchoolClass[] = [
    {
        id: 'c1',
        name: '9º Ano A',
        gradeLevel: '9º Ano',
        shift: 'Morning',
        academicYear: 2023,
        capacity: 35,
        enrolledStudentIds: ['1', '2', '4'],
        teacherAllocations: [
            { subject: 'Matemática', teacherId: '1' },
            { subject: 'Português', teacherId: '4' }
        ]
    },
    {
        id: 'c2',
        name: '8º Ano C',
        gradeLevel: '8º Ano',
        shift: 'Afternoon',
        academicYear: 2023,
        capacity: 30,
        enrolledStudentIds: ['5'],
        teacherAllocations: [
             { subject: 'Matemática', teacherId: '1' }
        ]
    }
];

export const MOCK_INVENTORY: InventoryItem[] = [
    { id: '1', name: 'Papel Sulfite A4', category: 'Stationery', quantity: 50, minQuantity: 20, unit: 'Resmas', location: 'Almoxarifado A', lastUpdated: '2023-10-20' },
    { id: '2', name: 'Marcador de Quadro Azul', category: 'Stationery', quantity: 12, minQuantity: 15, unit: 'Caixas', location: 'Sala dos Professores', lastUpdated: '2023-10-18' },
    { id: '3', name: 'Projetor Epson', category: 'Electronics', quantity: 5, minQuantity: 5, unit: 'Unidades', location: 'Sala Multimídia', lastUpdated: '2023-09-01' },
    { id: '4', name: 'Detergente Líquido', category: 'Cleaning', quantity: 8, minQuantity: 10, unit: 'Galões 5L', location: 'Depósito Limpeza', lastUpdated: '2023-10-22' },
];

export const MOCK_TRANSACTIONS = [
  { id: '1', description: 'Mensalidade - Março', amount: 45000, type: 'income', date: '2023-10-01', category: 'Tuition' },
  { id: '2', description: 'Salários Professores', amount: 28000, type: 'expense', date: '2023-10-05', category: 'Payroll' },
  { id: '3', description: 'Material Escritório', amount: 1200, type: 'expense', date: '2023-10-06', category: 'Supplies' },
  { id: '4', description: 'Venda Uniformes', amount: 3500, type: 'income', date: '2023-10-07', category: 'Store' },
  { id: '5', description: 'Manutenção Predial', amount: 4500, type: 'expense', date: '2023-10-08', category: 'Maintenance' },
];

export const MOCK_CLASSES = [
  { id: '1', subject: 'Matemática', time: '08:00 - 09:40', topic: 'Equações de 2º Grau', room: 'Sala 101' },
  { id: '2', subject: 'Física', time: '10:00 - 11:40', topic: 'Cinemática Vetorial', room: 'Lab 3' },
  { id: '3', subject: 'Reunião Pedagógica', time: '14:00 - 15:00', topic: 'Alinhamento Bimestral', room: 'Sala Reuniões' },
];

export const MOCK_INVOICES = [
  { id: '101', studentName: 'Bruno Silva', amount: 1200, dueDate: '2023-10-05', status: 'Overdue' },
  { id: '102', studentName: 'Eduardo Mello', amount: 1200, dueDate: '2023-10-05', status: 'Overdue' },
  { id: '103', studentName: 'Daniel Costa', amount: 1200, dueDate: '2023-10-15', status: 'Pending' },
  { id: '104', studentName: 'Alice Ferreira', amount: 1200, dueDate: '2023-10-05', status: 'Paid' },
  { id: '105', studentName: 'Carla Dias', amount: 1200, dueDate: '2023-10-05', status: 'Paid' },
];

export const MOCK_GRADES = [
  { id: '1', studentName: 'Alice Ferreira', subject: 'Matemática', grade1: 9.5, grade2: 8.0, average: 8.75 },
  { id: '2', studentName: 'Bruno Silva', subject: 'Matemática', grade1: 6.0, grade2: 5.5, average: 5.75 },
  { id: '3', studentName: 'Carla Dias', subject: 'Matemática', grade1: 10.0, grade2: 9.5, average: 9.75 },
  { id: '4', studentName: 'Daniel Costa', subject: 'Matemática', grade1: 7.0, grade2: 7.5, average: 7.25 },
  { id: '5', studentName: 'Eduardo Mello', subject: 'Matemática', grade1: 4.0, grade2: 5.0, average: 4.5 },
];

export const MOCK_NOTICES = [
  { id: '1', title: 'Reunião de Pais e Mestres', content: 'A reunião trimestral ocorrerá no dia 25/10 às 19h no auditório principal.', date: '2023-10-10', author: 'Coordenação', type: 'General' },
  { id: '2', title: 'Campanha de Vacinação', content: 'Equipes de saúde estarão na escola na próxima segunda-feira.', date: '2023-10-12', author: 'Secretaria', type: 'Urgent' },
  { id: '3', title: 'Feira de Ciências', content: 'Inscrições abertas para grupos do 6º ao 9º ano.', date: '2023-10-14', author: 'Pedagógico', type: 'Academic' },
];

export const MOCK_DIARY_ENTRIES = [
    { id: '1', date: '2023-10-10', subject: 'Matemática', topic: 'Introdução a Bhaskara', description: 'Explicação da fórmula e dedução.', homework: 'Página 45, exercícios 1 a 5.' },
    { id: '2', date: '2023-10-12', subject: 'Matemática', topic: 'Discriminante Delta', description: 'Analisando as raízes reais.', homework: 'Lista de exercícios em anexo.' },
];

export const MOCK_TEACHER_ACTIVITIES = [
    { id: '1', name: 'Carlos Roberto', subject: 'Matemática', lastLogin: '2023-10-23 08:00', lastDiaryUpdate: '2023-10-23', lastAttendanceUpdate: '2023-10-23', status: 'Active' },
    { id: '2', name: 'Fernanda Lima', subject: 'Português', lastLogin: '2023-10-23 07:45', lastDiaryUpdate: '2023-10-22', lastAttendanceUpdate: '2023-10-23', status: 'Active' },
    { id: '3', name: 'Roberto Santos', subject: 'História', lastLogin: '2023-10-20 14:00', lastDiaryUpdate: '2023-10-18', lastAttendanceUpdate: '2023-10-18', status: 'Warning' },
    { id: '4', name: 'Julia Martins', subject: 'Geografia', lastLogin: '2023-10-15 09:00', lastDiaryUpdate: '2023-10-15', lastAttendanceUpdate: '2023-10-15', status: 'Idle' },
];

export const MOCK_ABSENCES = [
    { id: '1', studentName: 'Bruno Silva', date: '2023-10-20', subject: 'Matemática', justified: false },
    { id: '2', studentName: 'Bruno Silva', date: '2023-10-21', subject: 'História', justified: false },
    { id: '3', studentName: 'Eduardo Mello', date: '2023-10-18', subject: 'Geografia', justified: false },
    { id: '4', studentName: 'Daniel Costa', date: '2023-10-19', subject: 'Português', justified: true, reason: 'Atestado Médico' },
];

export const MOCK_ACADEMIC_TARGETS = [
    { id: '1', month: 'Outubro 2023', requiredClasses: 22, gradeSubmissionDeadline: '2023-10-30', examSubmissionDeadline: '2023-10-15' },
    { id: '2', month: 'Novembro 2023', requiredClasses: 20, gradeSubmissionDeadline: '2023-11-30', examSubmissionDeadline: '2023-11-15' },
];

export const MOCK_EXAM_SUBMISSIONS = [
    { id: '1', title: 'Prova Bimestral 3º Bim', subject: 'Matemática', teacherName: 'Carlos Roberto', gradeLevel: '9º Ano', type: 'Standard', status: 'Pending', submittedDate: '2023-10-10' },
    { id: '2', title: 'Prova Adaptada (Dislexia)', subject: 'História', teacherName: 'Roberto Santos', gradeLevel: '8º Ano', type: 'Adapted', status: 'Approved', submittedDate: '2023-10-11', studentName: 'Eduardo Mello' },
    { id: '3', title: 'Prova de Geografia', subject: 'Geografia', teacherName: 'Julia Martins', gradeLevel: '7º Ano', type: 'Standard', status: 'ChangesRequested', submittedDate: '2023-10-09', feedback: 'Questão 4 está ambígua. Favor revisar.' },
];

export const DEFAULT_GRADING_CONFIG: GradingConfig = {
    system: 'bimestral',
    calculationMethod: 'weighted',
    minPassingGrade: 7.0,
    weights: {
        exam: 60,
        activities: 30,
        participation: 10
    },
    recoveryType: 'grade',
    recoveryRule: 'average'
};

export const NAV_ITEMS = [
  {
    id: ViewState.DASHBOARD,
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    roles: [UserRole.ADMIN, UserRole.STUDENT],
  },
  {
    id: ViewState.REGISTRATION,
    label: 'Cadastros',
    icon: <UserPlus size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.CLASS_ALLOCATION,
    label: 'Enturmação',
    icon: <Grid size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.TEACHER_SUBJECTS,
    label: 'Disciplinas por Prof.',
    icon: <BookUser size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.SCHEDULE,
    label: 'Horários',
    icon: <CalendarClock size={20} />,
    roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
  },
  {
    id: ViewState.ACADEMIC,
    label: 'Acadêmico',
    icon: <BookOpen size={20} />,
    roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
  },
  {
    id: ViewState.PEDAGOGICAL,
    label: 'Coordenação',
    icon: <GraduationCap size={20} />,
    roles: [UserRole.ADMIN, UserRole.TEACHER],
  },
  {
    id: ViewState.FINANCIAL,
    label: 'Financeiro',
    icon: <Wallet size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.INVENTORY,
    label: 'Almoxarifado',
    icon: <Package size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.TEACHER_INVENTORY,
    label: 'Materiais',
    icon: <Package size={20} />,
    roles: [UserRole.TEACHER],
  },
  {
    id: ViewState.COMMUNICATION,
    label: 'Comunicação',
    icon: <MessageCircle size={20} />,
    roles: [UserRole.ADMIN, UserRole.STUDENT],
  },
  {
    id: ViewState.TEACHER_MONITORING,
    label: 'Monitoramento',
    icon: <Activity size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.LESSON_PLANS,
    label: 'Planos de Aula',
    icon: <ClipboardList size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    id: ViewState.ABSENCE_JUSTIFICATION,
    label: 'Justificativas',
    icon: <ClipboardCheck size={20} />,
    roles: [UserRole.ADMIN, UserRole.TEACHER],
  },
  {
    id: ViewState.SETTINGS,
    label: 'Configurações',
    icon: <Settings size={20} />,
    roles: [UserRole.ADMIN],
  },
];
