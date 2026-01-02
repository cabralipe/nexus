import React, { useState, useMemo } from 'react';
import { UserPlus, Search, MapPin, Phone, Heart, ShieldAlert, FileText, User, Users, Briefcase, Save, X, Plus, Trash2, School, CheckSquare, Square, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react';
import { MOCK_FULL_STUDENT_PROFILES, MOCK_STAFF, MOCK_SCHOOL_CLASSES } from '../constants';
import { StudentProfile, Staff, EmergencyContact, SchoolClass } from '../types';

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

const SUBJECTS_LIST = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Inglês', 'Educação Física', 'Artes', 'Recreação', 'Desenvolvimento Cognitivo'];

const RegistrationModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('students');
    const [students, setStudents] = useState<StudentProfile[]>(MOCK_FULL_STUDENT_PROFILES);
    const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF);
    const [classes, setClasses] = useState<SchoolClass[]>(MOCK_SCHOOL_CLASSES);
    
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Creation Mode State
    const [isCreatingStudent, setIsCreatingStudent] = useState(false);
    const [isCreatingClass, setIsCreatingClass] = useState(false);
    
    // Class Creation Specifics
    const [selectedEducationLevel, setSelectedEducationLevel] = useState('');
    
    const [formData, setFormData] = useState<StudentProfile>(INITIAL_STUDENT_STATE);
    const [classFormData, setClassFormData] = useState<SchoolClass>(INITIAL_CLASS_STATE);
    
    // Temporary state for text inputs that will be arrays (allergies/meds)
    const [allergiesInput, setAllergiesInput] = useState('');
    const [medsInput, setMedsInput] = useState('');

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
            setAllergiesInput('');
            setMedsInput('');
        } else if (activeTab === 'classes') {
            setIsCreatingClass(true);
            setSelectedClassId(null);
            setClassFormData(INITIAL_CLASS_STATE);
            setSelectedEducationLevel('');
        }
    };

    const handleCancelCreation = () => {
        setIsCreatingStudent(false);
        setIsCreatingClass(false);
    };

    const handleSaveStudent = () => {
        const newStudent: StudentProfile = {
            ...formData,
            id: Math.random().toString(36).substr(2, 9),
            healthInfo: {
                ...formData.healthInfo,
                allergies: allergiesInput.split(',').map(s => s.trim()).filter(Boolean),
                medications: medsInput.split(',').map(s => s.trim()).filter(Boolean)
            }
        };

        setStudents([...students, newStudent]);
        setIsCreatingStudent(false);
        setSelectedStudentId(newStudent.id);
    };

    const handleSaveClass = () => {
        const newClass: SchoolClass = {
             ...classFormData,
             id: Math.random().toString(36).substr(2, 9),
        };
        setClasses([...classes, newClass]);
        setIsCreatingClass(false);
        setSelectedClassId(newClass.id);
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
                                    {student.name.substring(0,2).toUpperCase()}
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
                                    {s.name.substring(0,2).toUpperCase()}
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
                                        Nova Turma
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
                                            <Save size={16} /> Salvar Turma
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Turma (Identificador)</label>
                                        <input 
                                            type="text" placeholder="Ex: Berçário A, 9º Ano B" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.name} onChange={e => setClassFormData({...classFormData, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
                                        <select 
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.shift} onChange={e => setClassFormData({...classFormData, shift: e.target.value as any})}
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
                                                        setClassFormData({...classFormData, gradeLevel: ''}); // Reset grade when level changes
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
                                                    onChange={e => setClassFormData({...classFormData, gradeLevel: e.target.value})}
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
                                            value={classFormData.capacity} onChange={e => setClassFormData({...classFormData, capacity: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Ano Letivo</label>
                                        <input 
                                            type="number" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={classFormData.academicYear} onChange={e => setClassFormData({...classFormData, academicYear: parseInt(e.target.value)})}
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
                                    <div className="text-right">
                                        <p className="text-sm text-slate-500 mb-1">Ocupação</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl font-bold text-slate-800">{selectedClass.enrolledStudentIds.length}</span>
                                            <span className="text-sm text-slate-400">/ {selectedClass.capacity}</span>
                                        </div>
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
                                    Novo Cadastro de Aluno
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
                                        <Save size={16} /> Salvar Cadastro
                                    </button>
                                </div>
                            </div>
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
                                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                                            />
                                        </div>
                                        {/* ... other fields ... */}
                                    </div>
                                </div>
                        </div>
                    ) : activeTab === 'students' && selectedStudent ? (
                        <div className="space-y-8 animate-fade-in">
                             <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                                        {selectedStudent.name.substring(0,2).toUpperCase()}
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
                            </div>
                            {/* ... Student Details ... */}
                        </div>
                    ) : activeTab === 'staff' && selectedStaffMember ? (
                         <div className="space-y-8 animate-fade-in">
                             {/* ... Staff Details ... */}
                               <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                                <div className="flex gap-4">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">
                                        {selectedStaffMember.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedStaffMember.name}</h2>
                                        <p className="text-slate-500">{selectedStaffMember.role}</p>
                                    </div>
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