import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, Download, CheckCircle, XCircle, FileText, Plus, Save, Edit, Trash2, FolderOpen, Video, File, ExternalLink, Paperclip, Eraser, ScrollText, Target, Book, Search } from 'lucide-react';
import { ClassDiaryEntry, GradeRecord, SchoolClass, StudentProfile } from '../types';
import { exportToCSV } from '../utils';
import { backend } from '../services/backendService';

type Tab = 'grades' | 'attendance' | 'diary' | 'materials' | 'syllabus';

interface Syllabus {
    id: string;
    subject: string;
    description: string;
    objectives: string[];
    bibliography: string;
}

const AcademicModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('grades');
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    // Simple state to track attendance checkboxes (id -> status)
    const [attendanceState, setAttendanceState] = useState<Record<string, string>>({});
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [students, setStudents] = useState<StudentProfile[]>([]);
    
    // Grade State
    const [gradesData, setGradesData] = useState<GradeRecord[]>([]);
    const [isSavingGrades, setIsSavingGrades] = useState(false);
    
    // Diary States
    const [diaryEntries, setDiaryEntries] = useState<ClassDiaryEntry[]>([]);
    const [newEntry, setNewEntry] = useState({ date: '', topic: '', description: '', homework: '' });
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [diarySearchTerm, setDiarySearchTerm] = useState('');

    // Materials State
    const [materials, setMaterials] = useState([
        { id: '1', title: 'Lista de Exercícios - Álgebra', type: 'PDF', date: '2023-10-20', size: '1.2 MB' },
    ]);
    const [newMaterialTitle, setNewMaterialTitle] = useState('');
    const [materialFile, setMaterialFile] = useState<File | null>(null);

    // Syllabus State
    const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
    const [selectedSyllabusId, setSelectedSyllabusId] = useState<string>('');
    const [isEditingSyllabus, setIsEditingSyllabus] = useState(false);
    const [syllabusFormData, setSyllabusFormData] = useState<Syllabus | null>(null);

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [classesData, studentsData, syllabiData] = await Promise.all([
                    backend.fetchClassrooms(),
                    backend.fetchStudents(),
                    backend.fetchSyllabi(),
                ]);
                const classesList: SchoolClass[] = classesData.map((cls: any) => ({
                    id: String(cls.id),
                    name: cls.name,
                    gradeLevel: cls.gradeLevel || cls.grade || '',
                    shift: cls.shift === 'morning' ? 'Morning' : cls.shift === 'afternoon' ? 'Afternoon' : 'Night',
                    academicYear: cls.academicYear || cls.year,
                    capacity: cls.capacity || 30,
                    enrolledStudentIds: [],
                    teacherAllocations: [],
                }));
                setClasses(classesList);
                setSelectedClassId(classesList[0]?.id || null);

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
                setStudents(studentList);

                const syllabiList = syllabiData.map((item: any) => ({
                    id: String(item.id),
                    subject: item.subject,
                    description: item.description || '',
                    objectives: item.objectives || [],
                    bibliography: item.bibliography || '',
                }));
                setSyllabi(syllabiList);
                if (syllabiList[0]) {
                    setSelectedSyllabusId(syllabiList[0].id);
                }
            } catch (error) {
                console.error("Failed to load academic data", error);
            }
        };

        loadInitial();
    }, []);

    useEffect(() => {
        if (!selectedClassId) return;
        const loadClassData = async () => {
            try {
                const [grades, attendance, diary, materialsList] = await Promise.all([
                    backend.fetchGrades({ classroom_id: selectedClassId }),
                    backend.fetchAttendance({ classroom_id: selectedClassId, date: attendanceDate }),
                    backend.fetchDiaryEntries({ classroom_id: selectedClassId }),
                    backend.fetchMaterials({ classroom_id: selectedClassId }),
                ]);

                const studentMap = new Map(students.map(s => [s.id, s.name]));
                const mappedGrades: any[] = grades.map((record: any) => ({
                    id: String(record.id),
                    studentName: studentMap.get(String(record.student_id)) || 'Aluno',
                    subject: record.subject,
                    grade1: record.grade1 ?? 0,
                    grade2: record.grade2 ?? 0,
                    recoveryGrade: record.recovery_grade ?? null,
                    average: record.average ?? 0,
                    finalGrade: record.final_grade ?? record.average ?? 0,
                    term: record.term || '',
                    date: record.date || '',
                    studentId: String(record.student_id),
                    classroomId: String(record.classroom_id),
                }));
                setGradesData(mappedGrades);

                const attendanceMap: Record<string, string> = {};
                attendance.forEach((item: any) => {
                    attendanceMap[String(item.student_id)] = item.status;
                });
                setAttendanceState(attendanceMap);

                setDiaryEntries(
                    diary.map((entry: any) => ({
                        id: String(entry.id),
                        date: entry.date,
                        subject: entry.subject,
                        topic: entry.topic,
                        description: entry.description,
                        homework: entry.homework,
                    }))
                );

                setMaterials(
                    materialsList.map((item: any) => ({
                        id: String(item.id),
                        title: item.title,
                        type: item.type || 'PDF',
                        date: item.date,
                        size: item.size,
                        url: item.url,
                    }))
                );
            } catch (error) {
                console.error("Failed to load class academic data", error);
            }
        };

        loadClassData();
    }, [selectedClassId, attendanceDate, students]);

    // --- Grades Logic ---
    const handleGradeChange = (id: string, field: 'grade1' | 'grade2', value: string) => {
        // Allow empty string for better UX while typing, otherwise parse float
        const numValue = value === '' ? '' : Math.min(10, Math.max(0, parseFloat(value)));
        
        setGradesData(prev => prev.map(record => {
            if (record.id === id) {
                const updatedRecord = { ...record, [field]: numValue };
                
                // Calculate average if both are numbers
                const g1 = typeof updatedRecord.grade1 === 'number' ? updatedRecord.grade1 : 0;
                const g2 = typeof updatedRecord.grade2 === 'number' ? updatedRecord.grade2 : 0;
                
                // Simple arithmetic average logic (backend recalculates final grade)
                updatedRecord.average = (g1 + g2) / 2;
                
                return updatedRecord;
            }
            return record;
        }));
    };

    const handleSaveGrades = async () => {
        if (!selectedClassId) return;
        setIsSavingGrades(true);
        try {
            const payloads = gradesData.map((record: any) => ({
                student_id: record.studentId,
                classroom_id: record.classroomId || selectedClassId,
                subject: record.subject,
                grade1: record.grade1,
                grade2: record.grade2,
                recovery_grade: record.recoveryGrade,
                term: record.term,
                date: record.date || attendanceDate,
            }));
            await Promise.all(payloads.map(payload => backend.upsertGrade(payload)));
            setIsSavingGrades(false);
            alert('Notas salvas com sucesso!');
        } catch (error) {
            console.error("Failed to save grades", error);
            setIsSavingGrades(false);
        }
    };

    const handleExportGrades = () => {
        const dataToExport = gradesData.map(g => ({
            Aluno: g.studentName,
            Disciplina: g.subject,
            'Nota 1': g.grade1,
            'Nota 2': g.grade2,
            'Média': g.average.toFixed(1)
        }));
        exportToCSV(dataToExport, 'Boletim_Notas');
    };

    // --- Attendance Logic ---
    const toggleAttendance = async (studentId: string, status: 'present' | 'absent') => {
        if (!selectedClassId) return;
        try {
            await backend.upsertAttendance({
                student_id: studentId,
                classroom_id: selectedClassId,
                date: attendanceDate,
                status
            });
            setAttendanceState(prev => ({
                ...prev,
                [studentId]: status
            }));
        } catch (error) {
            console.error("Failed to update attendance", error);
        }
    };

    // --- Diary Logic ---
    const handleEditEntry = (entry: ClassDiaryEntry) => {
        setNewEntry({
            date: entry.date,
            topic: entry.topic,
            description: entry.description,
            homework: entry.homework
        });
        setEditingEntryId(entry.id);
    };

    const handleDeleteEntry = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir este registro de aula?')) {
            try {
                await backend.deleteDiaryEntry(id);
                setDiaryEntries(diaryEntries.filter(entry => entry.id !== id));
                if (editingEntryId === id) {
                    handleCancelEdit();
                }
            } catch (error) {
                console.error("Failed to delete diary entry", error);
            }
        }
    };

    const handleCancelEdit = () => {
        setNewEntry({ date: '', topic: '', description: '', homework: '' });
        setEditingEntryId(null);
    };

    const handleSaveDiary = async () => {
        // Validation
        if (!newEntry.date || !newEntry.topic) {
            alert("Por favor, preencha a Data e o Tópico da aula.");
            return;
        }

        if (!selectedClassId) return;

        try {
            if (editingEntryId) {
                const updated = await backend.updateDiaryEntry(editingEntryId, {
                    date: newEntry.date,
                    topic: newEntry.topic,
                    description: newEntry.description,
                    homework: newEntry.homework,
                });
                setDiaryEntries(diaryEntries.map(entry => 
                    entry.id === editingEntryId 
                    ? { ...entry, ...updated }
                    : entry
                ));
                handleCancelEdit();
            } else {
                const created = await backend.createDiaryEntry({
                    classroom_id: selectedClassId,
                    subject: 'Matemática',
                    date: newEntry.date,
                    topic: newEntry.topic,
                    description: newEntry.description,
                    homework: newEntry.homework,
                });
                const entry: ClassDiaryEntry = {
                    id: String(created.id),
                    subject: created.subject,
                    date: created.date,
                    topic: created.topic,
                    description: created.description,
                    homework: created.homework,
                };
                setDiaryEntries([entry, ...diaryEntries]);
                setNewEntry({ date: '', topic: '', description: '', homework: '' });
            }
        } catch (error) {
            console.error("Failed to save diary entry", error);
        }
    };

    const filteredDiaryEntries = diaryEntries.filter(entry => 
        entry.topic.toLowerCase().includes(diarySearchTerm.toLowerCase()) ||
        entry.description.toLowerCase().includes(diarySearchTerm.toLowerCase())
    );

    const handleAddMaterial = async () => {
        if (!newMaterialTitle || !selectedClassId) return;
        try {
            const created = await backend.createMaterial({
                classroom_id: selectedClassId,
                title: newMaterialTitle,
                type: 'PDF',
                date: new Date().toISOString().split('T')[0],
                size: '0.5 MB',
            });
            let uploadUrl = '';
            if (materialFile) {
                const formData = new FormData();
                formData.append('entity_type', 'material');
                formData.append('entity_id', String(created.id));
                formData.append('file', materialFile);
                const upload = await backend.uploadFile(formData);
                uploadUrl = upload.url || '';
                if (uploadUrl) {
                    await backend.updateMaterial(String(created.id), { url: uploadUrl });
                }
            }
            setMaterials([
                {
                    id: String(created.id),
                    title: created.title,
                    type: created.type,
                    date: created.date,
                    size: created.size,
                    url: uploadUrl || created.url,
                },
                ...materials,
            ]);
            setNewMaterialTitle('');
            setMaterialFile(null);
        } catch (error) {
            console.error("Failed to add material", error);
        }
    };

    // --- Syllabus Logic ---
    const handleEditSyllabus = () => {
        const current = syllabi.find(s => s.id === selectedSyllabusId);
        if (current) {
            setSyllabusFormData({ ...current });
            setIsEditingSyllabus(true);
        }
    };

    const handleSaveSyllabus = async () => {
        if (!syllabusFormData) return;
        try {
            const updated = await backend.updateSyllabus(syllabusFormData.id, syllabusFormData);
            setSyllabi(prev => prev.map(s => s.id === syllabusFormData.id ? updated : s));
            setIsEditingSyllabus(false);
            setSyllabusFormData(null);
        } catch (error) {
            console.error("Failed to save syllabus", error);
        }
    };

    const handleObjectivesChange = (text: string) => {
        if (syllabusFormData) {
            const objectivesArray = text.split('\n');
            setSyllabusFormData({ ...syllabusFormData, objectives: objectivesArray });
        }
    };

    const activeSyllabus = syllabi.find(s => s.id === selectedSyllabusId);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestão Acadêmica</h2>
                    <p className="text-slate-500">Gerencie notas, frequência e conteúdo de aulas.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={selectedClassId || ''}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                        {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                                {cls.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('grades')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'grades' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <BookOpen size={16} /> Diário de Notas
                </button>
                <button 
                    onClick={() => setActiveTab('attendance')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'attendance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Clock size={16} /> Frequência
                </button>
                <button 
                    onClick={() => setActiveTab('diary')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'diary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FileText size={16} /> Conteúdo e Aulas
                </button>
                <button 
                    onClick={() => setActiveTab('materials')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'materials' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FolderOpen size={16} /> Materiais
                </button>
                <button 
                    onClick={() => setActiveTab('syllabus')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'syllabus' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <ScrollText size={16} /> Ementas
                </button>
            </div>

            {/* Tab Content: GRADES */}
            {activeTab === 'grades' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Notas do Bimestre</h3>
                        <button 
                            onClick={handleExportGrades}
                            className="flex items-center gap-2 text-indigo-600 text-sm hover:underline"
                        >
                            <Download size={14} /> Exportar Planilha
                        </button>
                    </div>
                    
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-medium w-1/3">Aluno</th>
                                <th className="px-6 py-3 font-medium text-center w-32">Prova 1</th>
                                <th className="px-6 py-3 font-medium text-center w-32">Prova 2</th>
                                <th className="px-6 py-3 font-medium text-center w-32">Média</th>
                                <th className="px-6 py-3 font-medium text-center">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {gradesData.map((record) => (
                                <tr key={record.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {record.studentName.substring(0,2).toUpperCase()}
                                        </div>
                                        {record.studentName}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="number" 
                                            value={record.grade1}
                                            onChange={(e) => handleGradeChange(record.id, 'grade1', e.target.value)}
                                            step="0.5"
                                            min="0"
                                            max="10"
                                            className="w-16 text-center border border-slate-200 rounded p-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-indigo-300"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="number" 
                                            value={record.grade2} 
                                            onChange={(e) => handleGradeChange(record.id, 'grade2', e.target.value)}
                                            step="0.5"
                                            min="0"
                                            max="10"
                                            className="w-16 text-center border border-slate-200 rounded p-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-indigo-300"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-slate-800">
                                            {(record.finalGrade ?? record.average).toFixed(1)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                            (record.finalGrade ?? record.average) >= 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {(record.finalGrade ?? record.average) >= 7 ? 'Aprovado' : 'Recuperação'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button 
                            onClick={handleSaveGrades}
                            disabled={isSavingGrades}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Save size={16} /> 
                            {isSavingGrades ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Content: ATTENDANCE */}
            {activeTab === 'attendance' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-slate-800">Chamada Diária</h3>
                            <input 
                                type="date" 
                                value={attendanceDate}
                                onChange={(e) => setAttendanceDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-700 outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="text-sm text-slate-500">
                            Total de Alunos: <span className="font-bold text-slate-800">{students.length}</span>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {students.map((student) => (
                            <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                                <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                        {student.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{student.name}</p>
                                        <p className="text-xs text-slate-500">Matrícula: 202300{student.id}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => toggleAttendance(student.id, 'present')}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                            attendanceState[student.id] === 'present' 
                                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500 font-semibold' 
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <CheckCircle size={16} /> Presente
                                    </button>
                                    <button 
                                        onClick={() => toggleAttendance(student.id, 'absent')}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                            attendanceState[student.id] === 'absent' 
                                            ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-500 font-semibold' 
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <XCircle size={16} /> Ausente
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                     <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium text-sm flex items-center gap-2">
                            <Save size={16} /> Salvar Chamada
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Content: DIARY */}
            {activeTab === 'diary' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    {/* Add/Edit Content Form */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className={`p-6 rounded-xl shadow-sm border transition-all ${editingEntryId ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                             <div className="flex justify-between items-center mb-4">
                                <h3 className={`font-bold flex items-center gap-2 ${editingEntryId ? 'text-indigo-800' : 'text-slate-800'}`}>
                                    {editingEntryId ? <Edit size={18} className="text-indigo-600" /> : <Plus size={18} className="text-indigo-600" />}
                                    {editingEntryId ? 'Editar Registro' : 'Novo Registro'}
                                </h3>
                                {!editingEntryId && (newEntry.date || newEntry.topic) && (
                                    <button onClick={handleCancelEdit} className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1">
                                        <Eraser size={12} /> Limpar
                                    </button>
                                )}
                             </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700">Data da Aula <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newEntry.date}
                                        onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700">Tópico Principal <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="text" placeholder="Ex: Equações Lineares"
                                        className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={newEntry.topic}
                                        onChange={(e) => setNewEntry({...newEntry, topic: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700">Descrição do Conteúdo</label>
                                    <textarea 
                                        placeholder="O que foi abordado na aula..."
                                        className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                                        value={newEntry.description}
                                        onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700">Tarefa de Casa</label>
                                    <textarea 
                                        placeholder="Exercícios ou leituras para a próxima aula..."
                                        className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                                        value={newEntry.homework}
                                        onChange={(e) => setNewEntry({...newEntry, homework: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    {editingEntryId && (
                                        <button 
                                            onClick={handleCancelEdit}
                                            className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleSaveDiary}
                                        className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                                    >
                                        <Save size={16} /> {editingEntryId ? 'Salvar Alterações' : 'Adicionar ao Diário'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline List */}
                    <div className="lg:col-span-2">
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar size={18} className="text-indigo-600" />
                                    Histórico de Aulas
                                </h3>
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por tópico..." 
                                        className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-indigo-500 transition-all focus:w-48 w-32"
                                        value={diarySearchTerm}
                                        onChange={(e) => setDiarySearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="relative border-l-2 border-indigo-100 ml-3 space-y-8">
                                {filteredDiaryEntries.length > 0 ? (
                                    filteredDiaryEntries.map((entry) => {
                                        const isEditing = entry.id === editingEntryId;
                                        return (
                                            <div key={entry.id} className="relative pl-8">
                                                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm transition-all ${isEditing ? 'bg-indigo-500 scale-125 ring-2 ring-indigo-200' : 'bg-indigo-600'}`}></div>
                                                <div>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                                {new Date(entry.date).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => handleEditEntry(entry)}
                                                                className={`p-1 rounded transition-colors ${isEditing ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'}`}
                                                                title="Editar registro"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => handleDeleteEntry(e, entry.id)}
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                                title="Excluir registro"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div 
                                                        onClick={() => handleEditEntry(entry)}
                                                        className={`p-4 rounded-lg border transition-all cursor-pointer group relative ${
                                                            isEditing 
                                                            ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                                                            : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <h4 className={`font-bold mb-2 transition-colors ${isEditing ? 'text-indigo-800' : 'text-slate-800'}`}>{entry.topic}</h4>
                                                        <p className="text-sm text-slate-600 mb-2">{entry.description}</p>
                                                        {entry.homework && (
                                                            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-slate-200/50 text-xs text-slate-500">
                                                                <BookOpen size={14} className="mt-0.5" />
                                                                <span><strong>Para Casa:</strong> {entry.homework}</span>
                                                            </div>
                                                        )}
                                                        {!isEditing && (
                                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">Clique para editar</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-slate-400 text-sm">
                                        Nenhum registro encontrado para "{diarySearchTerm}".
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content: MATERIALS */}
            {activeTab === 'materials' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
                    {/* Upload / Add Area */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Plus size={20} className="text-indigo-600" />
                            Novo Material
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1">Título do Material</label>
                                <input 
                                    type="text" placeholder="Ex: Lista de Exercícios 02"
                                    className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-indigo-500"
                                    value={newMaterialTitle}
                                    onChange={e => setNewMaterialTitle(e.target.value)}
                                />
                            </div>
                            <label className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 cursor-pointer transition-colors block">
                                <Paperclip size={24} className="mx-auto mb-2 text-slate-400" />
                                <p className="text-xs text-slate-500">
                                    {materialFile ? materialFile.name : "Arraste um arquivo ou clique para selecionar (PDF, DOCX, PPT)"}
                                </p>
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            <button 
                                onClick={handleAddMaterial}
                                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 text-sm"
                            >
                                Publicar na Turma
                            </button>
                        </div>
                    </div>

                    {/* Materials Grid */}
                    <div className="lg:col-span-3">
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <FolderOpen size={20} className="text-indigo-600" />
                                Arquivos da Turma
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {materials.map(item => (
                                    <div key={item.id} className="p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all bg-slate-50 group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className={`p-2 rounded-lg ${item.type === 'Video' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {item.type === 'Video' ? <Video size={20} /> : <File size={20} />}
                                            </div>
                                        {item.url ? (
                                            <a className="text-slate-400 hover:text-indigo-600" href={item.url} target="_blank" rel="noreferrer">
                                                <ExternalLink size={16} />
                                            </a>
                                        ) : (
                                            <button className="text-slate-300 cursor-not-allowed" disabled>
                                                <ExternalLink size={16} />
                                            </button>
                                        )}
                                        </div>
                                        <h4 className="font-bold text-slate-700 text-sm mb-1 line-clamp-2">{item.title}</h4>
                                        <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                                            <span>{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                                            {item.size && <span>{item.size}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Content: SYLLABUS */}
            {activeTab === 'syllabus' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in h-[calc(100vh-250px)]">
                    {/* Left Sidebar: Subjects List */}
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50">
                             <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Disciplinas</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {syllabi.map(syllabus => (
                                <button
                                    key={syllabus.id}
                                    onClick={() => { setSelectedSyllabusId(syllabus.id); setIsEditingSyllabus(false); }}
                                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${
                                        selectedSyllabusId === syllabus.id 
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' 
                                        : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                                    }`}
                                >
                                    <span className="font-semibold text-sm">{syllabus.subject}</span>
                                    {selectedSyllabusId === syllabus.id && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                                </button>
                            ))}
                            <button 
                                className="w-full text-left p-3 rounded-lg text-slate-400 text-sm border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 mt-4"
                                onClick={() => alert("Funcionalidade para adicionar nova disciplina em breve.")}
                            >
                                <Plus size={14} /> Adicionar Disciplina
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Content View / Edit */}
                    <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                        {activeSyllabus ? (
                            isEditingSyllabus && syllabusFormData ? (
                                // EDIT MODE
                                <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                            <Edit size={24} className="text-indigo-600" />
                                            Editar Ementa: {syllabusFormData.subject}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setIsEditingSyllabus(false)} 
                                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                                            >
                                                Cancelar
                                            </button>
                                            <button 
                                                onClick={handleSaveSyllabus}
                                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
                                            >
                                                <Save size={16} /> Salvar Alterações
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Descrição da Disciplina</label>
                                            <textarea 
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none leading-relaxed"
                                                value={syllabusFormData.description}
                                                onChange={e => setSyllabusFormData({...syllabusFormData, description: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Objetivos de Aprendizagem</label>
                                            <p className="text-xs text-slate-500 mb-2">Insira um objetivo por linha.</p>
                                            <textarea 
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-40 resize-none leading-relaxed"
                                                value={syllabusFormData.objectives.join('\n')}
                                                onChange={e => handleObjectivesChange(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Bibliografia Básica</label>
                                            <textarea 
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none leading-relaxed"
                                                value={syllabusFormData.bibliography}
                                                onChange={e => setSyllabusFormData({...syllabusFormData, bibliography: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // VIEW MODE
                                <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                    <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                                                    <Book size={24} />
                                                </div>
                                                <h2 className="text-2xl font-bold text-slate-800">{activeSyllabus.subject}</h2>
                                            </div>
                                            <p className="text-slate-500 text-sm">Plano de Ensino Anual • 9º Ano</p>
                                        </div>
                                        <button 
                                            onClick={handleEditSyllabus}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 font-medium"
                                        >
                                            <Edit size={16} /> Editar Ementa
                                        </button>
                                    </div>

                                    <div className="space-y-8 max-w-4xl">
                                        <div className="prose-sm">
                                            <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <FileText size={18} className="text-slate-400" />
                                                Descrição
                                            </h4>
                                            <p className="text-slate-600 leading-relaxed text-justify bg-slate-50 p-4 rounded-lg border border-slate-100">
                                                {activeSyllabus.description}
                                            </p>
                                        </div>

                                        <div>
                                            <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Target size={18} className="text-slate-400" />
                                                Objetivos de Aprendizagem
                                            </h4>
                                            <ul className="grid grid-cols-1 gap-3">
                                                {activeSyllabus.objectives.map((obj, idx) => (
                                                    <li key={idx} className="flex items-start gap-3 text-slate-700 text-sm bg-white border border-slate-100 p-3 rounded-lg shadow-sm">
                                                        <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                        <span>{obj}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <h4 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                <Book size={18} className="text-slate-400" />
                                                Bibliografia
                                            </h4>
                                            <div className="text-slate-600 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-line font-medium">
                                                {activeSyllabus.bibliography}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <ScrollText size={64} className="mb-4 text-slate-200" />
                                <p className="font-medium">Selecione uma disciplina para visualizar a ementa.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicModule;
