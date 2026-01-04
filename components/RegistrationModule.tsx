import React, { useState, useMemo, useEffect } from 'react';
import { UserPlus, Search, MapPin, Phone, Heart, ShieldAlert, FileText, User, Users, Briefcase, Save, X, Plus, Trash2, School, CheckSquare, Square, ChevronRight, ArrowRight, ArrowLeft, Pencil } from 'lucide-react';
import { StudentProfile, Staff, EmergencyContact, SchoolClass } from '../types';
import { backend } from '../services/backendService';

type Tab = 'students' | 'staff' | 'classes';

const INITIAL_STUDENT_STATE: StudentProfile = {
    id: '',
    name: '',
    grade: '',
    attendance: 100,
    tuitionStatus: 'Pending',
    dob: '',
    cpf: '',
    mainAddress: '',
    reserveAddress: '',
    healthInfo: {
        allergies: [],
        medications: [],
        conditions: '',
        bloodType: ''
    },
    emergencyContacts: [
        { name: '', relation: '', phone: '', isLegalGuardian: true }
    ]
};

const INITIAL_CLASS_STATE: SchoolClass = {
    id: '',
    name: '',
    gradeLevel: '',
    shift: 'Morning',
    academicYear: new Date().getFullYear(),
    capacity: 30,
    enrolledStudentIds: [],
    teacherAllocations: []
};

const EDUCATION_LEVELS: Record<string, string[]> = {
    'Creche (Educação Infantil)': ['Berçário I', 'Berçário II', 'Maternal I', 'Maternal II'],
    'Pré-Escola': ['Pré I', 'Pré II'],
    'Anos Iniciais (Fund. I)': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'Anos Finais (Fund. II)': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'Ensino Médio': ['1ª Série', '2ª Série', '3ª Série']
};

const INITIAL_STAFF_STATE: Staff = {
    id: '',
    name: '',
    role: 'Teacher',
    department: '',
    phone: '',
    email: '',
    admissionDate: new Date().toISOString().split('T')[0],
};

const SUBJECTS_LIST = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Inglês', 'Educação Física', 'Artes', 'Recreação', 'Desenvolvimento Cognitivo'];

const RegistrationModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('students');
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);

    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Creation Mode State
    const [isCreatingStudent, setIsCreatingStudent] = useState(false);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    const [isCreatingStaff, setIsCreatingStaff] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);

    // Class Creation Specifics
    const [selectedEducationLevel, setSelectedEducationLevel] = useState('');

    const [formData, setFormData] = useState<StudentProfile>(INITIAL_STUDENT_STATE);
    const [classFormData, setClassFormData] = useState<SchoolClass>(INITIAL_CLASS_STATE);
    const [staffFormData, setStaffFormData] = useState<Staff>(INITIAL_STAFF_STATE);
    const [studentStatus, setStudentStatus] = useState<'active' | 'inactive' | 'graduated'>('active');
    const [enrollmentCode, setEnrollmentCode] = useState('');
    const [studentEmail, setStudentEmail] = useState('');
    const [studentPassword, setStudentPassword] = useState('');

    // Temporary state for text inputs that will be arrays (allergies/meds)
    const [allergiesInput, setAllergiesInput] = useState('');
    const [medsInput, setMedsInput] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [studentsData, staffData, classesData, enrollments] = await Promise.all([
                    backend.fetchStudents(),
                    backend.fetchStaff(),
                    backend.fetchClassrooms(),
                    backend.fetchEnrollments(),
                ]);

                const classroomMap = new Map(classesData.map((item: any) => [item.id, item]));
                const gradeByStudent = new Map<string, string>();
                enrollments.forEach((enrollment: any) => {
                    const classroom = classroomMap.get(enrollment.classroom_id);
                    if (classroom) {
                        gradeByStudent.set(
                            String(enrollment.student_id),
                            classroom.gradeLevel || classroom.grade || classroom.name
                        );
                    }
                });

                const studentsList: StudentProfile[] = studentsData.map((student: any) => ({
                    id: String(student.id),
                    name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
                    grade: gradeByStudent.get(String(student.id)) || '',
                    attendance: 100,
                    tuitionStatus: (student.tuitionStatus || student.tuition_status || 'Pending') as StudentProfile['tuitionStatus'],
                    dob: student.dob || student.birth_date || '',
                    cpf: student.cpf || '',
                    mainAddress: student.mainAddress || student.main_address || '',
                    reserveAddress: student.reserveAddress || student.reserve_address || '',
                    healthInfo: student.health_info || student.healthInfo || INITIAL_STUDENT_STATE.healthInfo,
                    emergencyContacts: (student.emergency_contacts || []).map((contact: any) => ({
                        name: contact.name,
                        relation: contact.relation,
                        phone: contact.phone,
                        isLegalGuardian: contact.is_legal_guardian ?? contact.isLegalGuardian ?? false,
                    })),
                }));

                const staffList: Staff[] = staffData.map((member: any) => ({
                    id: String(member.id),
                    name: member.name,
                    role: member.role,
                    department: member.department || '',
                    phone: member.phone || '',
                    email: member.email || '',
                    admissionDate: member.admissionDate || member.admission_date || '',
                }));

                const classStudentIds = await Promise.all(
                    classesData.map(async (item: any) => {
                        const ids = await backend.fetchClassroomStudents(String(item.id));
                        return { id: String(item.id), studentIds: ids.map(String) };
                    })
                );
                const studentIdsByClass = new Map(
                    classStudentIds.map(({ id, studentIds }) => [id, studentIds])
                );

                const classesList: SchoolClass[] = classesData.map((cls: any) => ({
                    id: String(cls.id),
                    name: cls.name,
                    gradeLevel: cls.gradeLevel || cls.grade || '',
                    shift: cls.shift === 'morning' ? 'Morning' : cls.shift === 'afternoon' ? 'Afternoon' : 'Night',
                    academicYear: cls.academicYear || cls.year,
                    capacity: cls.capacity || 30,
                    enrolledStudentIds: studentIdsByClass.get(String(cls.id)) || [],
                    teacherAllocations: [],
                }));

                setStudents(studentsList);
                setStaff(staffList);
                setClasses(classesList);
            } catch (error) {
                console.error("Failed to load registration data", error);
            }
        };

        loadData();
    }, []);

    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const selectedStaffMember = staff.find(s => s.id === selectedStaffId);
    const selectedClass = classes.find(c => c.id === selectedClassId);

    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredStaff = staff.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredClasses = classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleStartCreation = () => {
        if (activeTab === 'students') {
            setIsCreatingStudent(true);
            setSelectedStudentId(null);
            setFormData(INITIAL_STUDENT_STATE);
            setStudentStatus('active');
            setEnrollmentCode('');
            setStudentEmail('');
            setStudentPassword('');
            setAllergiesInput('');
            setMedsInput('');
        } else if (activeTab === 'classes') {
            setIsCreatingClass(true);
            setSelectedClassId(null);
            setClassFormData(INITIAL_CLASS_STATE);
            setSelectedEducationLevel('');
        } else if (activeTab === 'staff') {
            setIsCreatingStaff(true);
            setSelectedStaffId(null);
            setStaffFormData(INITIAL_STAFF_STATE);
        }
    };

    const handleCancelCreation = () => {
        setIsCreatingStudent(false);
        setIsCreatingClass(false);
        setIsCreatingStaff(false);
    };

    const handleEditStudent = () => {
        if (!selectedStudent) return;
        setFormData({
            ...selectedStudent,
            healthInfo: {
                ...selectedStudent.healthInfo,
                allergies: [...selectedStudent.healthInfo.allergies],
                medications: [...selectedStudent.healthInfo.medications],
            },
            emergencyContacts: selectedStudent.emergencyContacts.map(c => ({ ...c })),
        });
        setAllergiesInput(selectedStudent.healthInfo.allergies.join(', '));
        setMedsInput(selectedStudent.healthInfo.medications.join(', '));
        setStudentEmail(''); // Email not available in profile, user must re-enter if updating
        setStudentPassword('');
        setEnrollmentCode(''); // Might need to fetch or leave empty if not updating
        setStudentStatus('active'); // Defaulting as checking current status is not supported by frontend model yet
        setIsCreatingStudent(true);
    };

    const handleEditClass = () => {
        if (!selectedClass) return;
        setClassFormData({
            ...selectedClass,
        });

        // Inverse mapping for Education Level based on Grade Level if possible, or just default to empty/first
        // This is a simplification; ideally we store the education level or derive it.
        // For now, we'll try to match the gradeLevel to a key in EDUCATION_LEVELS
        let foundLevel = '';
        for (const [level, grades] of Object.entries(EDUCATION_LEVELS)) {
            if (grades.includes(selectedClass.gradeLevel)) {
                foundLevel = level;
                break;
            }
        }
        setSelectedEducationLevel(foundLevel);
        setIsCreatingClass(true);
    };

    const handleEditStaff = () => {
        if (!selectedStaffMember) return;
        setStaffFormData({
            ...selectedStaffMember,
        });
        setIsCreatingStaff(true);
    };

    const handleSaveStudent = async () => {
        const [firstName, ...rest] = formData.name.trim().split(' ');
        const lastName = rest.join(' ');

        if (!selectedStudentId) {
            if (!studentEmail || !studentPassword) {
                alert('Informe email e senha para criar o usuario do aluno.');
                return;
            }
            if (studentPassword.length < 8) {
                alert('A senha precisa ter pelo menos 8 caracteres.');
                return;
            }
        }

        const healthInfo = {
            ...formData.healthInfo,
            allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
            medications: medsInput.split(',').map(s => s.trim()).filter(Boolean)
        };

        const payload: any = {
            first_name: firstName,
            last_name: lastName,
            dob: formData.dob,
            cpf: formData.cpf,
            mainAddress: formData.mainAddress,
            reserveAddress: formData.reserveAddress,
            enrollment_code: enrollmentCode,
            tuition_status: formData.tuitionStatus,
            status: studentStatus,
            healthInfo: healthInfo,
            emergency_contacts: formData.emergencyContacts,
        };

        if (studentEmail) payload.email = studentEmail;
        if (studentPassword) payload.password = studentPassword;

        try {
            if (selectedStudentId) {
                // Update
                await backend.updateStudent(selectedStudentId, payload);
                const updatedStudent: StudentProfile = {
                    ...formData,
                    id: selectedStudentId,
                    name: formData.name, // keep name as is from form
                    healthInfo
                };
                setStudents(prev => prev.map(s => s.id === selectedStudentId ? updatedStudent : s));
                setIsCreatingStudent(false);
                // Keep selection
            } else {
                // Create
                const created = await backend.createStudent({
                    ...payload,
                    auto_create_user: true
                });
                if (created.user_credentials) {
                    setCreatedCredentials({
                        username: created.user_credentials.username,
                        password: created.user_credentials.password,
                    });
                } else {
                    setCreatedCredentials(null);
                }
                const createdStudent: StudentProfile = {
                    ...formData,
                    id: String(created.id),
                    // Ensure ID is set from backend response
                    healthInfo // Use processed health info
                };
                setStudents([...students, createdStudent]);
                setIsCreatingStudent(false);
                setSelectedStudentId(createdStudent.id);
            }
        } catch (error) {
            console.error("Failed to save student", error);
        }
    };

    const handleSaveClass = async () => {
        const newClass: SchoolClass = {
            ...classFormData,
            id: selectedClassId || Math.random().toString(36).substr(2, 9),
        };
        try {
            const shiftMap: Record<SchoolClass['shift'], string> = {
                Morning: 'morning',
                Afternoon: 'afternoon',
                Night: 'evening'
            };

            const payload = {
                name: newClass.name,
                gradeLevel: newClass.gradeLevel,
                academicYear: newClass.academicYear,
                shift: shiftMap[newClass.shift],
                capacity: newClass.capacity,
            };

            if (selectedClassId) {
                // Update
                await backend.updateClassroom(selectedClassId, payload);
                const updatedClass: SchoolClass = {
                    ...newClass,
                    id: selectedClassId
                };
                setClasses(prev => prev.map(c => c.id === selectedClassId ? updatedClass : c));
                setIsCreatingClass(false);
                // Keep selection
            } else {
                // Create
                const created = await backend.createClassroom(payload);
                const createdClass: SchoolClass = {
                    ...newClass,
                    id: String(created.id),
                };
                setClasses([...classes, createdClass]);
                setIsCreatingClass(false);
                setSelectedClassId(createdClass.id);
            }
        } catch (error) {
            console.error("Failed to save class", error);
        }
    };

    const handleSaveStaff = async () => {
        if (!staffFormData.name || !staffFormData.role) {
            alert('Nome e Cargo são obrigatórios');
            return;
        }
        const newStaff: Staff = {
            ...staffFormData,
            id: selectedStaffId || Math.random().toString(36).substr(2, 9),
        };
        try {
            const payload = {
                name: newStaff.name,
                role: newStaff.role,
                department: newStaff.department,
                phone: newStaff.phone,
                email: newStaff.email,
                admission_date: newStaff.admissionDate,
            };

            if (selectedStaffId) {
                // Update
                await backend.updateStaff(selectedStaffId, payload);
                const updatedStaff: Staff = {
                    ...newStaff,
                    id: selectedStaffId
                };
                setStaff(prev => prev.map(s => s.id === selectedStaffId ? updatedStaff : s));
                setIsCreatingStaff(false);
                // Keep selection
            } else {
                // Create
                const created = await backend.createStaff(payload);
                const createdStaff: Staff = {
                    ...newStaff,
                    id: String(created.id),
                };
                setStaff([...staff, createdStaff]);
                setIsCreatingStaff(false);
                setSelectedStaffId(createdStaff.id);
            }
        } catch (error) {
            console.error("Failed to save staff", error);
        }
    };

    const handleDeleteStudent = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este aluno?')) return;
        try {
            await backend.deleteStudent(id);
            setStudents(students.filter(s => s.id !== id));
            if (selectedStudentId === id) setSelectedStudentId(null);
        } catch (error) {
            console.error("Failed to delete student", error);
        }
    };

    const handleDeleteStaff = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este funcionário?')) return;
        try {
            await backend.deleteStaff(id);
            setStaff(staff.filter(s => s.id !== id));
            if (selectedStaffId === id) setSelectedStaffId(null);
        } catch (error) {
            console.error("Failed to delete staff", error);
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta turma?')) return;
        try {
            await backend.deleteClassroom(id);
            setClasses(classes.filter(c => c.id !== id));
            if (selectedClassId === id) setSelectedClassId(null);
        } catch (error) {
            console.error("Failed to delete class", error);
        }
    };

    const updateHealthInfo = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            healthInfo: { ...prev.healthInfo, [field]: value }
        }));
    };

    const updateEmergencyContact = (index: number, field: keyof EmergencyContact, value: any) => {
        const newContacts = [...formData.emergencyContacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        setFormData(prev => ({ ...prev, emergencyContacts: newContacts }));
    };

    const addEmergencyContact = () => {
        setFormData(prev => ({
            ...prev,
            emergencyContacts: [...prev.emergencyContacts, { name: '', relation: '', phone: '', isLegalGuardian: false }]
        }));
    };

    const removeEmergencyContact = (index: number) => {
        const newContacts = formData.emergencyContacts.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, emergencyContacts: newContacts }));
    };

    const resetSelection = () => {
        setSelectedStaffId(null);
        setSelectedStudentId(null);
        setSelectedClassId(null);
        setSearchTerm('');
        setIsCreatingStudent(false);
        setIsCreatingClass(false);
        setIsCreatingStaff(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Cadastros Gerais</h2>
                    <p className="text-slate-500">Gestão de dados de alunos, turmas e colaboradores.</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button
                        onClick={() => { setActiveTab('students'); resetSelection(); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'students' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        Alunos
                    </button>
                    <button
                        onClick={() => { setActiveTab('classes'); resetSelection(); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'classes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        Turmas
                    </button>
                    <button
                        onClick={() => { setActiveTab('staff'); resetSelection(); }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        Equipe
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                {/* Left Column: List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder={activeTab === 'students' ? "Buscar aluno..." : activeTab === 'classes' ? "Buscar turma..." : "Buscar funcionário..."}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleStartCreation}
                            className="w-full mt-3 flex items-center justify-center gap-2 bg-slate-800 text-white py-2 rounded-lg text-sm hover:bg-slate-900 transition-colors"
                        >
                            <Plus size={16} />
                            {activeTab === 'students' ? 'Novo Aluno' : activeTab === 'classes' ? 'Nova Turma' : 'Novo Funcionário'}
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-2 space-y-1">
                        {activeTab === 'students' && filteredStudents.map(student => (
                            <button
                                key={student.id}
                                onClick={() => { setSelectedStudentId(student.id); setIsCreatingStudent(false); }}
                                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${selectedStudentId === student.id && !isCreatingStudent ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedStudentId === student.id && !isCreatingStudent ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {student.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className={`font-semibold text-sm ${selectedStudentId === student.id && !isCreatingStudent ? 'text-indigo-900' : 'text-slate-800'}`}>{student.name}</div>
                                    <div className="text-xs text-slate-500">{student.grade} • Matrícula #{student.id}</div>
                                </div>
                            </button>
                        ))}
                        {activeTab === 'staff' && filteredStaff.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedStaffId(s.id)}
                                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${selectedStaffId === s.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedStaffId === s.id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {s.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className={`font-semibold text-sm ${selectedStaffId === s.id ? 'text-indigo-900' : 'text-slate-800'}`}>{s.name}</div>
                                    <div className="text-xs text-slate-500">{s.role === 'Teacher' ? 'Professor' : s.role} • {s.department}</div>
                                </div>
                            </button>
                        ))}
                        {activeTab === 'classes' && filteredClasses.map(c => (
                            <button
                                key={c.id}
                                onClick={() => { setSelectedClassId(c.id); setIsCreatingClass(false); }}
                                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${selectedClassId === c.id && !isCreatingClass ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                            >
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${selectedClassId === c.id && !isCreatingClass ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                    <School size={18} />
                                </div>
                                <div>
                                    <div className={`font-semibold text-sm ${selectedClassId === c.id && !isCreatingClass ? 'text-indigo-900' : 'text-slate-800'}`}>{c.name}</div>
                                    <div className="text-xs text-slate-500">{c.gradeLevel} • {c.shift === 'Morning' ? 'Manhã' : c.shift === 'Afternoon' ? 'Tarde' : 'Noite'}</div>
                                </div>
                                <div className="ml-auto flex flex-col items-end">
                                    <span className="text-xs font-bold text-slate-600">{c.enrolledStudentIds.length}/{c.capacity}</span>
                                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${c.enrolledStudentIds.length >= c.capacity ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${(c.enrolledStudentIds.length / c.capacity) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Column: Details OR Creation Form */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-y-auto p-8">
                    {activeTab === 'classes' ? (
                        isCreatingClass ? (
                            <div className="space-y-8 animate-fade-in">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <School size={24} className="text-indigo-600" />
                                        {selectedClassId ? 'Editar Turma' : 'Nova Turma'}
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCancelCreation}
                                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveClass}
                                            disabled={!classFormData.name || !classFormData.gradeLevel}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Save size={16} /> {selectedClassId ? 'Salvar Alterações' : 'Salvar Turma'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Turma (Identificador)</label>
                                        <input
                                            type="text" placeholder="Ex: Berçário A, 9º Ano B" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.name} onChange={e => setClassFormData({ ...classFormData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.shift} onChange={e => setClassFormData({ ...classFormData, shift: e.target.value as any })}
                                        >
                                            <option value="Morning">Matutino</option>
                                            <option value="Afternoon">Vespertino</option>
                                            <option value="Night">Noturno</option>
                                            <option value="FullDay">Integral</option>
                                        </select>
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-3">Nível e Série</label>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Etapa de Ensino</label>
                                                <select
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                                    value={selectedEducationLevel}
                                                    onChange={e => {
                                                        setSelectedEducationLevel(e.target.value);
                                                        setClassFormData({ ...classFormData, gradeLevel: '' }); // Reset grade when level changes
                                                    }}
                                                >
                                                    <option value="">Selecione a etapa...</option>
                                                    {Object.keys(EDUCATION_LEVELS).map(level => (
                                                        <option key={level} value={level}>{level}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Série / Ano</label>
                                                <select
                                                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                                                    value={classFormData.gradeLevel}
                                                    onChange={e => setClassFormData({ ...classFormData, gradeLevel: e.target.value })}
                                                    disabled={!selectedEducationLevel}
                                                >
                                                    <option value="">
                                                        {!selectedEducationLevel ? 'Selecione a etapa primeiro' : 'Selecione o ano/série...'}
                                                    </option>
                                                    {selectedEducationLevel && EDUCATION_LEVELS[selectedEducationLevel].map(grade => (
                                                        <option key={grade} value={grade}>{grade}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade de Alunos</label>
                                        <input
                                            type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.capacity} onChange={e => setClassFormData({ ...classFormData, capacity: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Ano Letivo</label>
                                        <input
                                            type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.academicYear} onChange={e => setClassFormData({ ...classFormData, academicYear: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : selectedClass ? (
                            <div className="space-y-8 animate-fade-in">
                                <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-bold text-slate-800">{selectedClass.name}</h2>
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-indigo-100 text-indigo-700">{selectedClass.gradeLevel}</span>
                                        </div>
                                        <div className="text-slate-500 text-sm flex gap-4">
                                            <span>Ano Letivo: {selectedClass.academicYear}</span>
                                            <span>•</span>
                                            <span>{selectedClass.shift === 'Morning' ? 'Matutino' : selectedClass.shift === 'Afternoon' ? 'Vespertino' : 'Noturno'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm text-slate-500 mb-1">Ocupação</p>
                                            <div className="flex items-center gap-2 justify-end">
                                                <span className="text-2xl font-bold text-slate-800">{selectedClass.enrolledStudentIds.length}</span>
                                                <span className="text-sm text-slate-400">/ {selectedClass.capacity}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleEditClass}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar Turma"
                                        >
                                            <Pencil size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClass(selectedClass.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Excluir Turma"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center p-12 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center">
                                    <Users size={48} className="text-slate-300 mb-4" />
                                    <h3 className="text-lg font-bold text-slate-700">Gerenciar Enturmação</h3>
                                    <p className="text-slate-500 mb-6 max-w-md">Para vincular alunos e definir o quadro de professores desta turma, acesse o módulo dedicado.</p>
                                    <div className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                                        Menu Lateral &gt; Enturmação
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <School size={64} className="mb-4 text-slate-200" />
                                <p className="text-lg font-medium text-slate-500">Selecione uma turma para editar</p>
                                <p className="text-sm">Edite dados básicos e capacidade.</p>
                            </div>
                        )
                    ) : activeTab === 'students' && isCreatingStudent ? (
                        <div className="space-y-8 animate-fade-in">
                            {/* ... Student Form Code (Unchanged) ... */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <UserPlus size={24} className="text-indigo-600" />
                                    {selectedStudentId ? 'Editar Aluno' : 'Novo Cadastro de Aluno'}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCancelCreation}
                                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveStudent}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                                    >
                                        <Save size={16} /> {selectedStudentId ? 'Salvar Alterações' : 'Salvar Cadastro'}
                                    </button>
                                </div>
                            </div>
                            {createdCredentials && (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-lg text-sm">
                                    <p className="font-bold mb-1">Credenciais geradas</p>
                                    <p>Usuario: <strong>{createdCredentials.username}</strong></p>
                                    <p>Senha temporaria: <strong>{createdCredentials.password}</strong></p>
                                </div>
                            )}
                            {/* Shortened for brevity since we are just removing the enrollment tab logic */}
                            {/* ... Form fields are same as before ... */}
                            {/* Section 1: Personal Info */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Informações Pessoais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Código de Matrícula</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={enrollmentCode} onChange={e => setEnrollmentCode(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status do Aluno</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={studentStatus}
                                            onChange={e => setStudentStatus(e.target.value as 'active' | 'inactive' | 'graduated')}
                                        >
                                            <option value="active">Ativo</option>
                                            <option value="inactive">Inativo</option>
                                            <option value="graduated">Concluído</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                                        <input
                                            type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                                        <input
                                            type="text" placeholder="000.000.000-00" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status de Mensalidade</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={formData.tuitionStatus}
                                            onChange={e => setFormData({ ...formData, tuitionStatus: e.target.value as StudentProfile['tuitionStatus'] })}
                                        >
                                            <option value="Paid">Em dia</option>
                                            <option value="Pending">Pendente</option>
                                            <option value="Late">Atrasada</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email do Aluno (para login)</label>
                                        <input
                                            type="email" placeholder="aluno@escola.com" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={studentEmail} onChange={e => setStudentEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Senha Inicial</label>
                                        <input
                                            type="password" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={studentPassword} onChange={e => setStudentPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Endereços</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Endereço Principal</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.mainAddress} onChange={e => setFormData({ ...formData, mainAddress: e.target.value })}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Endereço de Reserva</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.reserveAddress} onChange={e => setFormData({ ...formData, reserveAddress: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Saúde</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Sanguíneo</label>
                                        <input
                                            type="text" placeholder="Ex: A+" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.healthInfo.bloodType} onChange={e => updateHealthInfo('bloodType', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Condições</label>
                                        <input
                                            type="text" placeholder="Ex: Asma" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={formData.healthInfo.conditions} onChange={e => updateHealthInfo('conditions', e.target.value)}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Alergias (separe por vírgula)</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={allergiesInput} onChange={e => setAllergiesInput(e.target.value)}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Medicamentos (separe por vírgula)</label>
                                        <input
                                            type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={medsInput} onChange={e => setMedsInput(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contatos de Emergência</h4>
                                    <button
                                        type="button"
                                        onClick={addEmergencyContact}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                    >
                                        + Adicionar contato
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {formData.emergencyContacts.map((contact, index) => (
                                        <div key={`contact-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-200 rounded-lg">
                                            <div className="md:col-span-2 flex items-center justify-between">
                                                <h5 className="text-sm font-semibold text-slate-700">Contato {index + 1}</h5>
                                                {formData.emergencyContacts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeEmergencyContact(index)}
                                                        className="text-xs text-rose-600 hover:text-rose-700"
                                                    >
                                                        Remover
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                                <input
                                                    type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={contact.name} onChange={e => updateEmergencyContact(index, 'name', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Parentesco</label>
                                                <input
                                                    type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={contact.relation} onChange={e => updateEmergencyContact(index, 'relation', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                                <input
                                                    type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={contact.phone} onChange={e => updateEmergencyContact(index, 'phone', e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 mt-6">
                                                <input
                                                    type="checkbox"
                                                    checked={contact.isLegalGuardian}
                                                    onChange={e => updateEmergencyContact(index, 'isLegalGuardian', e.target.checked)}
                                                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                                                />
                                                <span className="text-sm text-slate-700">Responsável legal</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'students' && selectedStudent ? (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                                        {selectedStudent.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedStudent.name}</h2>
                                        <p className="text-slate-500">Turma {selectedStudent.grade}</p>
                                        <div className="flex gap-2 mt-2">
                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-semibold border border-blue-100">
                                                CPF: {selectedStudent.cpf}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleEditStudent}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Editar Aluno"
                                >
                                    <Pencil size={20} />
                                </button>
                                <button
                                    onClick={() => handleDeleteStudent(selectedStudent.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Excluir Aluno"
                                >
                                    <Trash2 size={20} />
                                </button>
                            </div>
                            {/* ... Student Details ... */}
                        </div>
                    ) : activeTab === 'staff' && isCreatingStaff ? (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Briefcase size={24} className="text-indigo-600" />
                                    {selectedStaffId ? 'Editar Funcionário' : 'Novo Funcionário'}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCancelCreation}
                                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveStaff}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                                    >
                                        <Save size={16} /> {selectedStaffId ? 'Salvar Alterações' : 'Salvar'}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.name} onChange={e => setStaffFormData({ ...staffFormData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cargo / Função</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.role} onChange={e => setStaffFormData({ ...staffFormData, role: e.target.value as any })}
                                    >
                                        <option value="Teacher">Professor</option>
                                        <option value="Coordinator">Coordenador</option>
                                        <option value="Admin">Administrativo</option>
                                        <option value="Support">Apoio</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.department} onChange={e => setStaffFormData({ ...staffFormData, department: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.email} onChange={e => setStaffFormData({ ...staffFormData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        type="text" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.phone} onChange={e => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Data de Admissão</label>
                                    <input
                                        type="date" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={staffFormData.admissionDate} onChange={e => setStaffFormData({ ...staffFormData, admissionDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'staff' && selectedStaffMember ? (
                        <div className="space-y-8 animate-fade-in">
                            {/* ... Staff Details ... */}
                            <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                                        {selectedStaffMember.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedStaffMember.name}</h2>
                                        <p className="text-slate-500">{selectedStaffMember.role}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleEditStaff}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar Funcionário"
                                    >
                                        <Pencil size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteStaff(selectedStaffMember.id)}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Excluir Funcionário"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            {activeTab === 'students' ? (
                                <>
                                    <Users size={64} className="mb-4 text-slate-200" />
                                    <p className="text-lg font-medium text-slate-500">Selecione um aluno ou inicie um novo cadastro</p>
                                </>
                            ) : (
                                <>
                                    <Briefcase size={64} className="mb-4 text-slate-200" />
                                    <p className="text-lg font-medium text-slate-500">Selecione um funcionário</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrationModule;
