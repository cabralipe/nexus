import React, { useState, useMemo, useEffect } from 'react';
import { School, Users, Briefcase, ChevronRight, Search, CheckSquare, ArrowRight, ArrowLeft, GraduationCap, Clock, AlertCircle, Edit, Save, X, GripVertical, Trash2, User, Layout, BookOpen, AlertTriangle } from 'lucide-react';
import { SchoolClass, StudentProfile, Staff } from '../types';
import { backend } from '../services/backendService';

const SUBJECTS_LIST = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Inglês', 'Educação Física', 'Artes', 'Recreação', 'Desenvolvimento Cognitivo'];

const EDUCATION_LEVELS: Record<string, string[]> = {
    'Creche (Educação Infantil)': ['Berçário I', 'Berçário II', 'Maternal I', 'Maternal II'],
    'Pré-Escola': ['Pré I', 'Pré II'],
    'Anos Iniciais (Fund. I)': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'Anos Finais (Fund. II)': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'Ensino Médio': ['1ª Série', '2ª Série', '3ª Série']
};

const ClassAllocationModule: React.FC = () => {
    // Local state managing the mock data (since we don't have a real backend context yet)
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);

    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'summary' | 'students' | 'teachers'>('summary');
    const [studentSearch, setStudentSearch] = useState('');
    const [teacherSearch, setTeacherSearch] = useState('');

    // Editing State
    const [isEditingClass, setIsEditingClass] = useState(false);
    const [editFormData, setEditFormData] = useState<SchoolClass | null>(null);

    // Drag and Drop State
    const [draggedTeacherId, setDraggedTeacherId] = useState<string | null>(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);
    const teachers = staff.filter(s => s.role === 'Teacher');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [classesData, studentsData, staffData] = await Promise.all([
                    backend.fetchClassrooms(),
                    backend.fetchStudents(),
                    backend.fetchStaff(),
                ]);

                const studentList: StudentProfile[] = studentsData.map((student: any) => ({
                    id: String(student.id),
                    name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
                    grade: student.grade || '',
                    attendance: 100,
                    tuitionStatus: (student.tuitionStatus || student.tuition_status || 'Pending') as StudentProfile['tuitionStatus'],
                    dob: student.dob || student.birth_date || '',
                    cpf: student.cpf || '',
                    mainAddress: student.mainAddress || student.main_address || '',
                    reserveAddress: student.reserveAddress || student.reserve_address || '',
                    healthInfo: student.health_info || student.healthInfo || {
                        allergies: [],
                        medications: [],
                        conditions: '',
                        bloodType: '',
                    },
                    emergencyContacts: [],
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

                const classAllocations = await Promise.all(
                    classesData.map(async (item: any) => {
                        const allocations = await backend.fetchAllocations(String(item.id));
                        return { id: String(item.id), allocations };
                    })
                );
                const allocationsByClass = new Map(
                    classAllocations.map(({ id, allocations }) => [id, allocations])
                );

                const classesList: SchoolClass[] = classesData.map((cls: any) => ({
                    id: String(cls.id),
                    name: cls.name,
                    gradeLevel: cls.gradeLevel || cls.grade || '',
                    shift: cls.shift === 'morning' ? 'Morning' : cls.shift === 'afternoon' ? 'Afternoon' : 'Night',
                    academicYear: cls.academicYear || cls.year,
                    capacity: cls.capacity || 30,
                    enrolledStudentIds: studentIdsByClass.get(String(cls.id)) || [],
                    teacherAllocations: (allocationsByClass.get(String(cls.id)) || []).map((alloc: any) => ({
                        subject: alloc.subject,
                        teacherId: String(alloc.teacher_id),
                    })),
                }));

                setStudents(studentList);
                setStaff(staffList);
                setClasses(classesList);
            } catch (error) {
                console.error("Failed to load class allocation data", error);
            }
        };

        loadData();
    }, []);

    // Filter Logic
    const enrolledStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => selectedClass.enrolledStudentIds.includes(s.id));
    }, [selectedClass, students]);

    const availableStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s =>
            !selectedClass.enrolledStudentIds.includes(s.id) &&
            s.name.toLowerCase().includes(studentSearch.toLowerCase())
        );
    }, [selectedClass, students, studentSearch]);

    const filteredTeachers = useMemo(() => {
        return teachers.filter(t =>
            t.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
            t.department.toLowerCase().includes(teacherSearch.toLowerCase())
        );
    }, [teachers, teacherSearch]);

    // Handlers
    const handleToggleStudent = async (classId: string, studentId: string) => {
        const classItem = classes.find(c => c.id === classId);
        if (!classItem) return;
        const isEnrolled = classItem.enrolledStudentIds.includes(studentId);
        try {
            if (isEnrolled) {
                await backend.removeClassroomStudent(classId, studentId);
            } else {
                await backend.addClassroomStudent(classId, studentId);
            }
            setClasses(prev => prev.map(c => {
                if (c.id !== classId) return c;
                return {
                    ...c,
                    enrolledStudentIds: isEnrolled
                        ? c.enrolledStudentIds.filter(id => id !== studentId)
                        : [...c.enrolledStudentIds, studentId]
                };
            }));
        } catch (error) {
            console.error("Failed to toggle student", error);
        }
    };

    const handleAssignTeacher = async (classId: string, subject: string, teacherId: string) => {
        try {
            if (!teacherId) return;
            await backend.setAllocation(classId, teacherId, subject);
            setClasses(prev => prev.map(c => {
                if (c.id !== classId) return c;
                const existing = c.teacherAllocations.filter(t => t.subject !== subject);
                return {
                    ...c,
                    teacherAllocations: [...existing, { subject, teacherId }]
                };
            }));
        } catch (error) {
            console.error("Failed to assign teacher", error);
        }
    };

    const handleRemoveTeacher = async (classId: string, subject: string) => {
        const allocation = classes
            .find(c => c.id === classId)
            ?.teacherAllocations.find(t => t.subject === subject);
        if (!allocation) return;
        try {
            await backend.removeAllocation(classId, allocation.teacherId, subject);
            setClasses(prev => prev.map(c => {
                if (c.id !== classId) return c;
                return {
                    ...c,
                    teacherAllocations: c.teacherAllocations.filter(t => t.subject !== subject)
                };
            }));
        } catch (error) {
            console.error("Failed to remove teacher allocation", error);
        }
    };

    // Form Specific Drag and Drop Handlers
    const handleFormAssignTeacher = (subject: string, teacherId: string) => {
        if (!editFormData) return;
        setEditFormData(prev => {
            if (!prev) return null;
            const existing = prev.teacherAllocations.filter(t => t.subject !== subject);
            return {
                ...prev,
                teacherAllocations: [...existing, { subject, teacherId }]
            };
        });
    };

    const handleFormRemoveTeacher = (subject: string) => {
        if (!editFormData) return;
        setEditFormData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                teacherAllocations: prev.teacherAllocations.filter(t => t.subject !== subject)
            };
        });
    };

    // Drag and Drop Events
    const handleDragStart = (e: React.DragEvent, teacherId: string) => {
        setDraggedTeacherId(teacherId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent, subject: string) => {
        e.preventDefault();
        // Check if we are in Edit Mode or View Mode to call correct handler
        if (draggedTeacherId) {
            if (isEditingClass) {
                handleFormAssignTeacher(subject, draggedTeacherId);
            } else if (selectedClassId) {
                handleAssignTeacher(selectedClassId, subject, draggedTeacherId);
            }
        }
        setDraggedTeacherId(null);
    };

    const handleEditClass = () => {
        if (selectedClass) {
            setEditFormData({ ...selectedClass });
            setIsEditingClass(true);
        }
    };

    const handleSaveClass = async () => {
        if (editFormData && selectedClassId) {
            try {
                const shiftMap: Record<SchoolClass['shift'], string> = {
                    Morning: 'morning',
                    Afternoon: 'afternoon',
                    Night: 'evening'
                };
                await backend.updateClassroom(selectedClassId, {
                    name: editFormData.name,
                    gradeLevel: editFormData.gradeLevel,
                    academicYear: editFormData.academicYear,
                    shift: shiftMap[editFormData.shift],
                    capacity: editFormData.capacity
                });
                setClasses(prev => prev.map(c => c.id === selectedClassId ? editFormData : c));
                setIsEditingClass(false);
                setEditFormData(null);
            } catch (error) {
                console.error("Failed to update class", error);
            }
        }
    };

    const handleCancelEdit = () => {
        setIsEditingClass(false);
        setEditFormData(null);
    };

    return (
        <div className="flex flex-col gap-6 h-auto lg:h-[calc(100vh-120px)]">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Enturmação e Lotação</h2>
                    <p className="text-slate-500">Distribuição de alunos e atribuição de aulas aos professores.</p>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 h-auto lg:h-full">
                {/* LEFT SIDEBAR: CLASS LIST */}
                <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-[300px] lg:h-full">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Turmas Disponíveis</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {classes.map(cls => {
                            const occupancy = cls.enrolledStudentIds.length;
                            const percentage = (occupancy / cls.capacity) * 100;
                            const isFull = occupancy >= cls.capacity;

                            return (
                                <button
                                    key={cls.id}
                                    onClick={() => { setSelectedClassId(cls.id); setIsEditingClass(false); setViewMode('summary'); }}
                                    className={`w-full text-left p-4 rounded-xl transition-all border ${selectedClassId === cls.id
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-lg">{cls.name}</div>
                                        {selectedClassId === cls.id && <ChevronRight size={20} />}
                                    </div>
                                    <div className={`text-xs mb-3 ${selectedClassId === cls.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {cls.gradeLevel} • {cls.shift === 'Morning' ? 'Manhã' : cls.shift === 'Afternoon' ? 'Tarde' : 'Noite'}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span>{occupancy} alunos</span>
                                            <span>{cls.capacity} vagas</span>
                                        </div>
                                        <div className={`h-1.5 rounded-full overflow-hidden ${selectedClassId === cls.id ? 'bg-indigo-800' : 'bg-slate-100'}`}>
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-rose-400' :
                                                    selectedClassId === cls.id ? 'bg-white' : 'bg-indigo-500'
                                                    }`}
                                                style={{ width: `${Math.min(100, percentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="lg:col-span-9 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-auto min-h-[500px]">
                    {!selectedClass ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <School size={40} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-600">Nenhuma turma selecionada</h3>
                            <p className="text-sm">Selecione uma turma à esquerda para gerenciar.</p>
                        </div>
                    ) : isEditingClass && editFormData ? (
                        <div className="flex-1 flex flex-col p-8 animate-fade-in">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-100 gap-4 sm:gap-0">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        <Edit size={24} className="text-indigo-600" />
                                        Editar Turma
                                    </h2>
                                    <p className="text-slate-500 text-sm">Atualize os dados e a lotação de professores.</p>
                                </div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="flex-1 sm:flex-none justify-center px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                        <X size={16} /> Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveClass}
                                        className="flex-1 sm:flex-none justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                                    >
                                        <Save size={16} /> Salvar Alterações
                                    </button>
                                </div>
                            </div>

                            <div className="max-w-5xl mx-auto w-full space-y-8">
                                {/* BASIC INFO SECTION */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Turma</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editFormData.name}
                                            onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Ano Letivo</label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editFormData.academicYear}
                                            onChange={e => setEditFormData({ ...editFormData, academicYear: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade Máxima</label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editFormData.capacity}
                                            onChange={e => setEditFormData({ ...editFormData, capacity: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editFormData.shift}
                                            onChange={e => setEditFormData({ ...editFormData, shift: e.target.value as any })}
                                        >
                                            <option value="Morning">Matutino</option>
                                            <option value="Afternoon">Vespertino</option>
                                            <option value="Night">Noturno</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nível de Ensino (Série)</label>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={editFormData.gradeLevel}
                                            onChange={e => setEditFormData({ ...editFormData, gradeLevel: e.target.value })}
                                        >
                                            {Object.entries(EDUCATION_LEVELS).map(([level, grades]) => (
                                                <optgroup key={level} label={level}>
                                                    {grades.map(grade => (
                                                        <option key={grade} value={grade}>{grade}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* TEACHER ALLOCATION SECTION (DRAG & DROP) */}
                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Briefcase size={20} className="text-indigo-600" />
                                        Alocação de Professores (Arrastar e Soltar)
                                    </h3>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[500px]">
                                        {/* Source: Teachers */}
                                        <div className="lg:col-span-4 bg-slate-50 rounded-lg p-4 border border-slate-200 flex flex-col h-[300px] lg:h-auto">
                                            <div className="mb-3">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar professor..."
                                                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-md outline-none focus:border-indigo-500"
                                                        value={teacherSearch}
                                                        onChange={e => setTeacherSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                                {filteredTeachers.map(teacher => (
                                                    <div
                                                        key={teacher.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, teacher.id)}
                                                        className={`bg-white p-3 rounded-md border border-slate-200 shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-300 hover:shadow-md transition-all flex items-center gap-3 ${draggedTeacherId === teacher.id ? 'opacity-50 ring-2 ring-indigo-500' : ''}`}
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                                            {teacher.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-700">{teacher.name}</div>
                                                            <div className="text-[10px] text-slate-500">{teacher.department}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Target: Subjects */}
                                        <div className="lg:col-span-8 overflow-y-auto pr-2 h-[400px] lg:h-auto">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {SUBJECTS_LIST.map(subject => {
                                                    const alloc = editFormData.teacherAllocations.find(t => t.subject === subject);
                                                    const teacher = alloc ? teachers.find(t => t.id === alloc.teacherId) : null;
                                                    const isDragging = draggedTeacherId !== null;

                                                    return (
                                                        <div
                                                            key={subject}
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, subject)}
                                                            className={`relative p-3 rounded-lg border-2 transition-all min-h-[80px] flex flex-col justify-center ${teacher
                                                                ? 'bg-white border-indigo-200 shadow-sm'
                                                                : isDragging
                                                                    ? 'bg-indigo-50 border-indigo-400 border-dashed'
                                                                    : 'bg-slate-50 border-slate-200 border-dashed'
                                                                }`}
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{subject}</span>
                                                                {teacher && (
                                                                    <button
                                                                        onClick={() => handleFormRemoveTeacher(subject)}
                                                                        className="text-slate-400 hover:text-rose-500 transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {teacher ? (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                                                                        {teacher.name.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-slate-800">{teacher.name}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-xs text-slate-400 italic py-2">
                                                                    {isDragging ? 'Solte para atribuir' : 'Vago'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Class Header */}
                            {/* Class Header */}
                            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-50/50 gap-4">
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex flex-wrap items-center gap-2 md:gap-3">
                                        {selectedClass.name}
                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200 uppercase tracking-wide">
                                            {selectedClass.academicYear}
                                        </span>
                                    </h2>
                                    <div className="flex flex-wrap gap-2 md:gap-4 mt-2 text-sm text-slate-500 font-medium">
                                        <span className="flex items-center gap-1"><GraduationCap size={16} /> {selectedClass.gradeLevel}</span>
                                        <span className="flex items-center gap-1"><Clock size={16} /> {selectedClass.shift === 'Morning' ? 'Matutino' : selectedClass.shift === 'Afternoon' ? 'Vespertino' : 'Noturno'}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                                    <button
                                        onClick={handleEditClass}
                                        className="justify-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-2 text-sm font-medium"
                                        title="Editar Turma"
                                    >
                                        <Edit size={16} /> Editar
                                    </button>

                                    {/* View Switcher */}
                                    <div className="bg-slate-200 p-1 rounded-lg flex overflow-x-auto">
                                        <button
                                            onClick={() => setViewMode('summary')}
                                            className={`flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'summary'
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Layout size={16} /> <span className="hidden md:inline">Visão Geral</span>
                                        </button>
                                        <button
                                            onClick={() => setViewMode('students')}
                                            className={`flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'students'
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Users size={16} /> Alunos
                                        </button>
                                        <button
                                            onClick={() => setViewMode('teachers')}
                                            className={`flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${viewMode === 'teachers'
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            <Briefcase size={16} /> <span className="hidden md:inline">Professores</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* View Content */}
                            <div className="p-6 bg-slate-50/30">
                                {viewMode === 'summary' ? (
                                    <div className="animate-fade-in">
                                        {/* Metrics Row */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-medium text-slate-500">Ocupação</p>
                                                    <Users size={18} className="text-indigo-500" />
                                                </div>
                                                <h3 className="text-2xl font-bold text-slate-800">
                                                    {enrolledStudents.length} <span className="text-sm font-normal text-slate-400">/ {selectedClass.capacity}</span>
                                                </h3>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                                                    <div
                                                        className="bg-indigo-500 h-1.5 rounded-full"
                                                        style={{ width: `${(enrolledStudents.length / selectedClass.capacity) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-medium text-slate-500">Disciplinas</p>
                                                    <BookOpen size={18} className="text-emerald-500" />
                                                </div>
                                                <h3 className="text-2xl font-bold text-slate-800">
                                                    {SUBJECTS_LIST.length}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">Matérias na grade curricular</p>
                                            </div>

                                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-medium text-slate-500">Professores Alocados</p>
                                                    <Briefcase size={18} className="text-blue-500" />
                                                </div>
                                                <div className="flex items-end gap-2">
                                                    <h3 className="text-2xl font-bold text-slate-800">
                                                        {selectedClass.teacherAllocations.length}
                                                    </h3>
                                                    <span className="text-sm text-slate-400 mb-1">de {SUBJECTS_LIST.length} necessários</span>
                                                </div>
                                                {selectedClass.teacherAllocations.length < SUBJECTS_LIST.length && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-rose-500 font-medium">
                                                        <AlertTriangle size={12} />
                                                        <span>{SUBJECTS_LIST.length - selectedClass.teacherAllocations.length} disciplinas vagas</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                            {/* Students Summary List */}
                                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-auto min-h-[300px]">
                                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                        <Users size={16} /> Alunos Matriculados
                                                    </h4>
                                                    <button
                                                        onClick={() => setViewMode('students')}
                                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                                    >
                                                        Gerenciar
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2">
                                                    {enrolledStudents.length > 0 ? (
                                                        enrolledStudents.map(s => (
                                                            <div key={s.id} className="flex items-center gap-3 p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-bold text-indigo-600">
                                                                    {s.name.substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <span className="text-sm font-medium text-slate-700">{s.name}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                                            <Users size={32} className="mb-2 opacity-50" />
                                                            <p className="text-sm">Nenhum aluno matriculado nesta turma.</p>
                                                            <button
                                                                onClick={() => setViewMode('students')}
                                                                className="mt-2 text-indigo-600 text-xs font-bold hover:underline"
                                                            >
                                                                Adicionar Alunos
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Teachers Summary List */}
                                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-auto min-h-[300px]">
                                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                        <Briefcase size={16} /> Quadro de Professores
                                                    </h4>
                                                    <button
                                                        onClick={() => setViewMode('teachers')}
                                                        className="text-xs font-bold text-indigo-600 hover:underline"
                                                    >
                                                        Gerenciar
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-2">
                                                    {SUBJECTS_LIST.map(subject => {
                                                        const alloc = selectedClass.teacherAllocations.find(t => t.subject === subject);
                                                        const teacher = alloc ? teachers.find(t => t.id === alloc.teacherId) : null;

                                                        return (
                                                            <div key={subject} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                                                <span className="text-sm font-medium text-slate-700">{subject}</span>
                                                                {teacher ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm text-slate-600">{teacher.name}</span>
                                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                                                                            {teacher.name.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="px-2 py-1 bg-slate-100 text-slate-400 text-xs font-bold rounded uppercase">Vago</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : viewMode === 'students' ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 min-h-[500px]">
                                        {/* Available List */}
                                        <div className="flex flex-col h-[300px] lg:h-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden order-2 lg:order-1">
                                            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="font-bold text-slate-700">Alunos Disponíveis</h4>
                                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{availableStudents.length}</span>
                                                </div>
                                                <div className="relative">
                                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text" placeholder="Filtrar por nome..."
                                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2">
                                                {availableStudents.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-indigo-100 group transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                                {s.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-sm text-slate-700">{s.name}</div>
                                                                <div className="text-xs text-slate-400">Matrícula: {s.id}</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleToggleStudent(selectedClass.id, s.id)}
                                                            className="text-indigo-600 opacity-0 group-hover:opacity-100 p-2 hover:bg-indigo-50 rounded-full transition-all"
                                                        >
                                                            <ArrowRight size={18} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {availableStudents.length === 0 && <div className="text-center p-4 text-slate-400 text-sm">Nenhum aluno encontrado.</div>}
                                            </div>
                                        </div>

                                        {/* Enrolled List */}
                                        <div className="flex flex-col h-[300px] lg:h-auto bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden order-1 lg:order-2">
                                            <div className="p-4 border-b border-indigo-100 bg-indigo-50 flex justify-between items-center">
                                                <h4 className="font-bold text-indigo-900">Alunos Matriculados</h4>
                                                <span className="text-xs bg-white px-2 py-1 rounded text-indigo-600 font-bold border border-indigo-100">
                                                    {enrolledStudents.length} / {selectedClass.capacity}
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2">
                                                {enrolledStudents.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm mb-2 group">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleToggleStudent(selectedClass.id, s.id)}
                                                                className="text-rose-400 p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                            >
                                                                <ArrowLeft size={16} />
                                                            </button>
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                                                {s.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                                            <CheckSquare size={12} /> Confirmado
                                                        </div>
                                                    </div>
                                                ))}
                                                {enrolledStudents.length === 0 && (
                                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                                                        <Users size={32} className="mb-2 opacity-50" />
                                                        <p className="text-sm">A turma ainda não possui alunos.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
                                        {/* Teachers Source Column */}
                                        <div className="lg:col-span-4 flex flex-col h-[300px] lg:h-auto bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
                                                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                                                    <Users size={18} className="text-indigo-600" />
                                                    Professores
                                                </h4>
                                                <div className="relative">
                                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text" placeholder="Buscar docente..."
                                                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
                                                    />
                                                </div>
                                                <p className="text-xs text-slate-500">Arraste o professor para a disciplina desejada.</p>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                                {filteredTeachers.map(teacher => (
                                                    <div
                                                        key={teacher.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, teacher.id)}
                                                        className={`flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-200 cursor-grab active:cursor-grabbing transition-all group ${draggedTeacherId === teacher.id ? 'opacity-50 ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                                    >
                                                        <div className="text-slate-400 group-hover:text-indigo-500">
                                                            <GripVertical size={20} />
                                                        </div>
                                                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs">
                                                            {teacher.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-800">{teacher.name}</div>
                                                            <div className="text-xs text-slate-500">{teacher.department}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredTeachers.length === 0 && <div className="text-center p-4 text-slate-400 text-sm">Nenhum professor encontrado.</div>}
                                            </div>
                                        </div>

                                        {/* Curriculum Grid Drop Targets */}
                                        <div className="lg:col-span-8 flex flex-col h-auto min-h-[500px] overflow-hidden">
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1">
                                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                                    <Briefcase size={18} className="text-indigo-600" />
                                                    Grade Curricular
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                                    {SUBJECTS_LIST.map(subject => {
                                                        const allocation = selectedClass.teacherAllocations.find(t => t.subject === subject);
                                                        const allocatedTeacher = allocation ? teachers.find(t => t.id === allocation.teacherId) : null;

                                                        const isDragging = draggedTeacherId !== null;

                                                        return (
                                                            <div
                                                                key={subject}
                                                                onDragOver={handleDragOver}
                                                                onDrop={(e) => handleDrop(e, subject)}
                                                                className={`p-4 rounded-xl border-2 transition-all min-h-[100px] flex flex-col justify-between ${allocatedTeacher
                                                                    ? 'bg-white border-indigo-100 shadow-sm'
                                                                    : isDragging
                                                                        ? 'bg-indigo-50 border-indigo-400 border-dashed shadow-inner'
                                                                        : 'bg-slate-50 border-slate-200 border-dashed hover:border-indigo-300 hover:bg-indigo-50/30'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="font-bold text-slate-700">{subject}</div>
                                                                    {allocatedTeacher ? (
                                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">Definido</span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-[10px] font-bold rounded uppercase tracking-wide">Vago</span>
                                                                    )}
                                                                </div>

                                                                {allocatedTeacher ? (
                                                                    <div className="flex items-center justify-between mt-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100 group">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold text-indigo-700 border border-indigo-200">
                                                                                {allocatedTeacher.name.substring(0, 2).toUpperCase()}
                                                                            </div>
                                                                            <span className="text-sm font-medium text-indigo-900 line-clamp-1">{allocatedTeacher.name}</span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRemoveTeacher(selectedClass.id, subject)}
                                                                            className="text-indigo-300 hover:text-rose-500 transition-colors p-1"
                                                                            title="Remover professor"
                                                                        >
                                                                            <X size={16} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full text-slate-400 text-xs italic pointer-events-none mt-2">
                                                                        <span className="flex items-center gap-1">
                                                                            <User size={14} /> Arraste um professor aqui
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassAllocationModule;
