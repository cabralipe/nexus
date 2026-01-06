import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Clock, Download, CheckCircle, XCircle, FileText, Plus, Save, Edit, Trash2, FolderOpen, Video, File, ExternalLink, Paperclip, Eraser, ScrollText, Target, Book, Search, ClipboardList } from 'lucide-react';
import { ClassDiaryEntry, GradeRecord, GradingConfig, SchoolClass, StudentProfile } from '../types';
import { DEFAULT_GRADING_CONFIG } from '../constants';
import { exportToCSV } from '../utils';
import { backend } from '../services/backendService';
import { generateInsight } from '../services/geminiService';

type Tab = 'grades' | 'attendance' | 'diary' | 'materials' | 'syllabus' | 'lessonPlans';

interface Syllabus {
    id: string;
    subject: string;
    gradeLevel: string;
    description: string;
    objectives: string[];
    bibliography: string;
}

interface LessonPlan {
    id: string;
    teacherName: string;
    classroomId: string;
    classroomName: string;
    subject: string;
    gradeLevel: string;
    date: string;
    duration: string;
    topic: string;
    objectives: string;
    contentProgram: string;
    methodology: string;
    resources: string;
    activities: string;
    assessment: string;
    status: string;
    feedback?: string;
}

const getLocalDateString = (referenceDate = new Date()): string => {
    const offsetMs = referenceDate.getTimezoneOffset() * 60 * 1000;
    return new Date(referenceDate.getTime() - offsetMs).toISOString().split('T')[0];
};

const getDefaultTerm = (system: GradingConfig['system'], referenceDate = new Date()): string => {
    const month = referenceDate.getMonth() + 1;
    if (system === 'trimestral') {
        if (month <= 3) return '1';
        if (month <= 6) return '2';
        if (month <= 9) return '3';
        return '3';
    }
    if (month <= 2) return '1';
    if (month <= 4) return '2';
    if (month <= 6) return '3';
    if (month <= 8) return '4';
    return '4';
};

const AcademicModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('grades');
    const [attendanceDate, setAttendanceDate] = useState(getLocalDateString());
    // Simple state to track attendance checkboxes (id -> status)
    const [attendanceState, setAttendanceState] = useState<Record<string, string>>({});
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [selectedSubject, setSelectedSubject] = useState('');
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
    const [gradingConfig, setGradingConfig] = useState<GradingConfig>(DEFAULT_GRADING_CONFIG);
    const [selectedTerm, setSelectedTerm] = useState<string>('');
    const [schoolName, setSchoolName] = useState('');
    const [teacherName, setTeacherName] = useState('');

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
    const [isCreatingSyllabus, setIsCreatingSyllabus] = useState(false);
    const [syllabusFormData, setSyllabusFormData] = useState<Syllabus | null>(null);

    // Lesson Plans State
    const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
    const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | null>(null);
    const [isEditingLessonPlan, setIsEditingLessonPlan] = useState(false);
    const [isSavingLessonPlan, setIsSavingLessonPlan] = useState(false);
    const [isGeneratingLessonPlan, setIsGeneratingLessonPlan] = useState(false);
    const [lessonPlanForm, setLessonPlanForm] = useState<LessonPlan | null>(null);
    const [lessonPlanAiContext, setLessonPlanAiContext] = useState('');

    useEffect(() => {
        const loadInitial = async () => {
            try {
                const [me, classesData, studentsData, syllabiData, gradingData] = await Promise.all([
                    backend.fetchMe(),
                    backend.fetchClassrooms(),
                    backend.fetchStudents(),
                    backend.fetchSyllabi(),
                    backend.fetchGradingConfig().catch(() => null),
                ]);
                const normalizedRole = String(me.role || '').toLowerCase();
                setCurrentUserId(String(me.id));
                setCurrentUserRole(normalizedRole || null);
                setCurrentStudentId(me.student_id ? String(me.student_id) : null);
                setSchoolName(me.school?.name || '');
                setTeacherName(me.username || '');

                const allocationsByClass = await Promise.all(
                    classesData.map(async (item: any) => {
                        const allocations = await backend.fetchAllocations(String(item.id));
                        return { id: String(item.id), allocations };
                    })
                );
                const allocationsMap = new Map(
                    allocationsByClass.map(({ id, allocations }) => [id, allocations])
                );
                const classesList: SchoolClass[] = classesData.map((cls: any) => ({
                    id: String(cls.id),
                    name: cls.name,
                    gradeLevel: cls.gradeLevel || cls.grade || '',
                    shift: cls.shift === 'morning' ? 'Morning' : cls.shift === 'afternoon' ? 'Afternoon' : 'Night',
                    academicYear: cls.academicYear || cls.year,
                    capacity: cls.capacity || 30,
                    enrolledStudentIds: [],
                    teacherAllocations: (allocationsMap.get(String(cls.id)) || []).map((alloc: any) => ({
                        subject: alloc.subject,
                        teacherId: String(alloc.teacher_id),
                    })),
                }));
                let filteredClasses = classesList;
                if (normalizedRole === 'teacher') {
                    filteredClasses = classesList.filter((cls) =>
                        cls.teacherAllocations.some((alloc) => alloc.teacherId === String(me.id))
                    );
                } else if (normalizedRole === 'student' && me.student_id) {
                    const memberships = await Promise.all(
                        classesData.map(async (item: any) => {
                            const students = await backend.fetchClassroomStudents(String(item.id));
                            return { id: String(item.id), students: students.map(String) };
                        })
                    );
                    const membershipMap = new Map(memberships.map(({ id, students }) => [id, students]));
                    filteredClasses = classesList.filter((cls) =>
                        membershipMap.get(cls.id)?.includes(String(me.student_id))
                    );
                }
                setClasses(filteredClasses);
                setSelectedClassId(filteredClasses[0]?.id || null);

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
                    gradeLevel: item.grade_level || item.gradeLevel || '',
                    description: item.description || '',
                    objectives: item.objectives || [],
                    bibliography: item.bibliography || '',
                }));
                setSyllabi(syllabiList);
                if (syllabiList[0]) {
                    setSelectedSyllabusId(syllabiList[0].id);
                }

                if (gradingData) {
                    setGradingConfig({
                        system: gradingData.system,
                        calculationMethod: gradingData.calculation_method || gradingData.calculationMethod,
                        minPassingGrade: Number(gradingData.min_passing_grade || gradingData.minPassingGrade || DEFAULT_GRADING_CONFIG.minPassingGrade),
                        weights: gradingData.weights || DEFAULT_GRADING_CONFIG.weights,
                        recoveryType: gradingData.recovery_type || DEFAULT_GRADING_CONFIG.recoveryType,
                        recoveryRule: gradingData.recovery_rule || DEFAULT_GRADING_CONFIG.recoveryRule,
                    });
                }
            } catch (error) {
                console.error("Failed to load academic data", error);
            }
        };

        loadInitial();
    }, []);

    useEffect(() => {
        const maxTerm = gradingConfig.system === 'trimestral' ? 3 : 4;
        if (!selectedTerm) {
            setSelectedTerm(getDefaultTerm(gradingConfig.system));
            return;
        }
        if (Number(selectedTerm) > maxTerm) {
            setSelectedTerm(String(maxTerm));
        }
    }, [gradingConfig.system, selectedTerm]);

    const visibleClasses = React.useMemo(() => {
        if (currentUserRole === 'teacher' && currentUserId) {
            return classes.filter((cls) =>
                cls.teacherAllocations.some((alloc) => alloc.teacherId === currentUserId)
            );
        }
        return classes;
    }, [classes, currentUserId, currentUserRole]);

    useEffect(() => {
        if (visibleClasses.length === 0) {
            setSelectedClassId(null);
            return;
        }
        if (!selectedClassId || !visibleClasses.some((cls) => cls.id === selectedClassId)) {
            setSelectedClassId(visibleClasses[0].id);
        }
    }, [visibleClasses, selectedClassId]);

    const isStudent = currentUserRole === 'student';
    const isTeacher = currentUserRole === 'teacher';
    const selectedClass = visibleClasses.find(c => c.id === selectedClassId);

    const availableSubjects = React.useMemo(() => {
        if (!selectedClass) return [];
        const allocations = selectedClass.teacherAllocations || [];
        const filtered = currentUserRole === 'teacher' && currentUserId
            ? allocations.filter((alloc) => alloc.teacherId === currentUserId)
            : allocations;
        return Array.from(new Set(filtered.map((alloc) => alloc.subject))).filter(Boolean);
    }, [selectedClass, currentUserId, currentUserRole]);

    useEffect(() => {
        if (!selectedClassId) {
            setSelectedSubject('');
            return;
        }
        if (availableSubjects.length === 0) {
            setSelectedSubject('');
            return;
        }
        if (!availableSubjects.includes(selectedSubject)) {
            setSelectedSubject(availableSubjects[0]);
        }
    }, [availableSubjects, selectedClassId, selectedSubject]);

    useEffect(() => {
        if (!selectedClassId) return;
        const loadClassData = async () => {
            try {
                const gradeParams: Record<string, string> = { classroom_id: selectedClassId };
                const attendanceParams: Record<string, string> = { classroom_id: selectedClassId, date: attendanceDate };
                const diaryParams: Record<string, string> = { classroom_id: selectedClassId };
                if (selectedTerm) {
                    gradeParams.term = selectedTerm;
                }
                let classStudentIds: string[] = [];
                if (currentUserRole === 'student' && currentStudentId) {
                    classStudentIds = [currentStudentId];
                } else {
                    const classroomStudents = await backend.fetchClassroomStudents(selectedClassId);
                    classStudentIds = classroomStudents.map(String);
                }
                if (currentUserRole === 'student' && currentStudentId) {
                    gradeParams.student_id = currentStudentId;
                }
                if (selectedSubject) {
                    gradeParams.subject = selectedSubject;
                    attendanceParams.subject = selectedSubject;
                    diaryParams.subject = selectedSubject;
                }
                const materialsParams: Record<string, string> = { classroom_id: selectedClassId };
                if (selectedSubject) {
                    materialsParams.subject = selectedSubject;
                }
                const [grades, attendance, diary, materialsList] = await Promise.all([
                    backend.fetchGrades(gradeParams),
                    currentUserRole === 'student' ? [] : backend.fetchAttendance(attendanceParams),
                    backend.fetchDiaryEntries(diaryParams),
                    backend.fetchMaterials(materialsParams),
                ]);

                const studentMap = new Map(students.map(s => [s.id, s.name]));
                const gradeByStudent = new Map<string, any>();
                grades.forEach((record: any) => {
                    gradeByStudent.set(String(record.student_id), record);
                });
                const rosterIds = classStudentIds.length
                    ? classStudentIds
                    : grades.map((record: any) => String(record.student_id));
                const mappedGrades: any[] = rosterIds.map((studentId) => {
                    const record = gradeByStudent.get(studentId);
                    return {
                        id: record ? String(record.id) : `local-${studentId}`,
                        studentName: studentMap.get(studentId) || 'Aluno',
                        subject: record?.subject || selectedSubject || '',
                        grade1: record?.grade1 ?? null,
                        grade2: record?.grade2 ?? null,
                        recoveryGrade: record?.recovery_grade ?? null,
                        average: record?.average ?? 0,
                        finalGrade: record?.final_grade ?? record?.average ?? 0,
                        term: record?.term || selectedTerm || '',
                        date: record?.date || '',
                        studentId: String(studentId),
                        classroomId: record?.classroom_id ? String(record.classroom_id) : selectedClassId,
                    };
                });
                setGradesData(mappedGrades);

                if (currentUserRole !== 'student') {
                    const attendanceMap: Record<string, string> = {};
                    (attendance as any[]).forEach((item: any) => {
                        attendanceMap[String(item.student_id)] = item.status;
                    });
                    setAttendanceState(attendanceMap);
                }

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
                        subject: item.subject,
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
    }, [selectedClassId, attendanceDate, selectedSubject, selectedTerm, students]);

    useEffect(() => {
        if (activeTab !== 'lessonPlans') return;
        const loadLessonPlans = async () => {
            try {
                const params: Record<string, string> = {};
                if (selectedClassId) params.classroom_id = selectedClassId;
                if (selectedSubject) params.subject = selectedSubject;
                const data = await backend.fetchLessonPlans(params);
                const mapped = data.map(mapLessonPlan);
                setLessonPlans(mapped);
                if (mapped.length && !selectedLessonPlanId) {
                    setSelectedLessonPlanId(mapped[0].id);
                }
            } catch (error) {
                console.error("Failed to load lesson plans", error);
            }
        };
        loadLessonPlans();
    }, [activeTab, selectedClassId, selectedSubject]);

    const calculateAverage = (grade1: number | '' | null, grade2: number | '' | null) => {
        if (typeof grade1 !== 'number' || typeof grade2 !== 'number') return null;
        if (gradingConfig.calculationMethod === 'weighted') {
            const examWeight = gradingConfig.weights.exam ?? 50;
            const activitiesWeight = gradingConfig.weights.activities ?? 50;
            const total = examWeight + activitiesWeight || 100;
            return (grade1 * examWeight + grade2 * activitiesWeight) / total;
        }
        return (grade1 + grade2) / 2;
    };

    const calculateFinalGrade = (average: number | null, recoveryGrade: number | null) => {
        if (average === null) return null;
        if (gradingConfig.recoveryType === 'none' || recoveryGrade === null) return average;
        if (gradingConfig.recoveryRule === 'average') {
            return (average + recoveryGrade) / 2;
        }
        if (gradingConfig.recoveryRule === 'max') {
            return Math.max(average, recoveryGrade);
        }
        return recoveryGrade;
    };

    useEffect(() => {
        setGradesData(prev => prev.map(record => {
            const average = calculateAverage(record.grade1, record.grade2);
            const recoveryGrade = typeof record.recoveryGrade === 'number' ? record.recoveryGrade : null;
            const finalGrade = calculateFinalGrade(average, recoveryGrade);
            return {
                ...record,
                average: average ?? record.average,
                finalGrade: finalGrade ?? record.finalGrade,
            };
        }));
    }, [gradingConfig]);

    // --- Grades Logic ---
    const handleGradeChange = (id: string, field: 'grade1' | 'grade2', value: string) => {
        // Allow empty string for better UX while typing, otherwise parse float
        const numValue = value === '' ? '' : Math.min(10, Math.max(0, parseFloat(value)));

        setGradesData(prev => prev.map(record => {
            if (record.id === id) {
                const updatedRecord = { ...record, [field]: numValue };
                const average = calculateAverage(updatedRecord.grade1, updatedRecord.grade2);
                const recoveryGrade = typeof updatedRecord.recoveryGrade === 'number' ? updatedRecord.recoveryGrade : null;
                updatedRecord.average = average ?? 0;
                updatedRecord.finalGrade = calculateFinalGrade(average, recoveryGrade) ?? updatedRecord.average;
                return updatedRecord;
            }
            return record;
        }));
    };

    const handleRecoveryChange = (id: string, value: string) => {
        const numValue = value === '' ? '' : Math.min(10, Math.max(0, parseFloat(value)));
        setGradesData(prev => prev.map(record => {
            if (record.id === id) {
                const updatedRecord = { ...record, recoveryGrade: numValue };
                const average = calculateAverage(updatedRecord.grade1, updatedRecord.grade2);
                const recoveryGrade = typeof updatedRecord.recoveryGrade === 'number' ? updatedRecord.recoveryGrade : null;
                updatedRecord.average = average ?? updatedRecord.average;
                updatedRecord.finalGrade = calculateFinalGrade(average, recoveryGrade) ?? updatedRecord.average;
                return updatedRecord;
            }
            return record;
        }));
    };

    const handleSaveGrades = async () => {
        if (!selectedClassId) return;
        if (!selectedSubject) {
            alert('Selecione a disciplina antes de salvar as notas.');
            return;
        }
        setIsSavingGrades(true);
        try {
            const payloads = gradesData.map((record: any) => ({
                student_id: record.studentId,
                classroom_id: record.classroomId || selectedClassId,
                subject: selectedSubject,
                grade1: record.grade1,
                grade2: record.grade2,
                recovery_grade: gradingConfig.recoveryType === 'none' ? null : record.recoveryGrade,
                term: selectedTerm || record.term,
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
            'Recuperação': gradingConfig.recoveryType === 'none' ? '' : (g.recoveryGrade ?? ''),
            'Média': g.average.toFixed(1),
            'Nota Final': (g.finalGrade ?? g.average).toFixed(1),
        }));
        exportToCSV(dataToExport, 'Boletim_Notas');
    };

    const gradingPeriodLabel = gradingConfig.system === 'trimestral' ? 'Trimestre' : 'Bimestre';
    const recoveryLabel = gradingConfig.recoveryType === 'exam' ? 'Recuperação (Prova)' : 'Recuperação (Nota)';
    const termLabel = selectedTerm ? `${gradingPeriodLabel} ${selectedTerm}` : gradingPeriodLabel;
    const maxTerm = gradingConfig.system === 'trimestral' ? 3 : 4;
    const grade1Label = gradingConfig.calculationMethod === 'weighted'
        ? `Provas (${gradingConfig.weights.exam}%)`
        : 'Nota 1';
    const grade2Label = gradingConfig.calculationMethod === 'weighted'
        ? `Atividades (${gradingConfig.weights.activities}%)`
        : 'Nota 2';

    // --- Attendance Logic ---
    const toggleAttendance = async (studentId: string, status: 'present' | 'absent') => {
        if (!selectedClassId) return;
        if (!selectedSubject) {
            alert('Selecione a disciplina antes de registrar a frequência.');
            return;
        }
        try {
            await backend.upsertAttendance({
                student_id: studentId,
                classroom_id: selectedClassId,
                date: attendanceDate,
                status,
                subject: selectedSubject,
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

        if (!selectedSubject) {
            alert('Selecione a disciplina antes de registrar a aula.');
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
                    subject: selectedSubject,
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
        if (!selectedSubject) {
            alert('Selecione a disciplina antes de adicionar materiais.');
            return;
        }
        try {
            const created = await backend.createMaterial({
                classroom_id: selectedClassId,
                title: newMaterialTitle,
                subject: selectedSubject,
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
                    subject: created.subject,
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
            setIsCreatingSyllabus(false);
        }
    };

    const handleCreateSyllabus = () => {
        setSyllabusFormData({
            id: '',
            subject: '',
            gradeLevel: selectedClass?.gradeLevel || '',
            description: '',
            objectives: [],
            bibliography: '',
        });
        setIsEditingSyllabus(true);
        setIsCreatingSyllabus(true);
        setSelectedSyllabusId('');
    };

    const handleSaveSyllabus = async () => {
        if (!syllabusFormData) return;
        if (!syllabusFormData.subject.trim()) {
            alert('Informe a disciplina da ementa.');
            return;
        }
        try {
            if (isCreatingSyllabus) {
                const created = await backend.createSyllabus({
                    subject: syllabusFormData.subject,
                    grade_level: syllabusFormData.gradeLevel,
                    description: syllabusFormData.description,
                    objectives: syllabusFormData.objectives,
                    bibliography: syllabusFormData.bibliography,
                });
                const createdSyllabus: Syllabus = {
                    id: String(created.id),
                    subject: created.subject,
                    gradeLevel: created.grade_level || created.gradeLevel || '',
                    description: created.description || '',
                    objectives: created.objectives || [],
                    bibliography: created.bibliography || '',
                };
                setSyllabi(prev => [createdSyllabus, ...prev]);
                setSelectedSyllabusId(createdSyllabus.id);
            } else {
                const updated = await backend.updateSyllabus(syllabusFormData.id, {
                    subject: syllabusFormData.subject,
                    grade_level: syllabusFormData.gradeLevel,
                    description: syllabusFormData.description,
                    objectives: syllabusFormData.objectives,
                    bibliography: syllabusFormData.bibliography,
                });
                const updatedSyllabus: Syllabus = {
                    id: String(updated.id),
                    subject: updated.subject,
                    gradeLevel: updated.grade_level || updated.gradeLevel || '',
                    description: updated.description || '',
                    objectives: updated.objectives || [],
                    bibliography: updated.bibliography || '',
                };
                setSyllabi(prev => prev.map(s => s.id === updatedSyllabus.id ? updatedSyllabus : s));
            }
            setIsEditingSyllabus(false);
            setIsCreatingSyllabus(false);
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
    const selectedLessonPlan = lessonPlans.find(p => p.id === selectedLessonPlanId) || null;

    const mapLessonPlan = (item: any): LessonPlan => ({
        id: String(item.id),
        teacherName: item.teacher_name || '',
        classroomId: item.classroom_id ? String(item.classroom_id) : '',
        classroomName: item.classroom_name || '',
        subject: item.subject || '',
        gradeLevel: item.grade_level || '',
        date: item.date || '',
        duration: item.duration || '',
        topic: item.topic || '',
        objectives: item.objectives || '',
        contentProgram: item.content_program || '',
        methodology: item.methodology || '',
        resources: item.resources || '',
        activities: item.activities || '',
        assessment: item.assessment || '',
        status: item.status || 'Pending',
        feedback: item.feedback || '',
    });

    const extractJsonPayload = (text: string) => {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    };

    const normalizeAiField = (value: any) => {
        if (!value) return '';
        if (Array.isArray(value)) return value.join('\n');
        if (typeof value === 'string') return value;
        return String(value);
    };

    const handleStartLessonPlan = () => {
        setLessonPlanForm({
            id: '',
            teacherName: teacherName || 'Professor(a)',
            classroomId: selectedClassId || '',
            classroomName: selectedClass?.name || '',
            subject: selectedSubject || '',
            gradeLevel: selectedClass?.gradeLevel || '',
            date: getLocalDateString(),
            duration: '',
            topic: '',
            objectives: '',
            contentProgram: '',
            methodology: '',
            resources: '',
            activities: '',
            assessment: '',
            status: 'Pending',
            feedback: '',
        });
        setSelectedLessonPlanId(null);
        setIsEditingLessonPlan(true);
        setLessonPlanAiContext('');
    };

    const handleEditLessonPlan = (plan: LessonPlan) => {
        setLessonPlanForm({ ...plan });
        setSelectedLessonPlanId(plan.id);
        setIsEditingLessonPlan(true);
    };

    const handleSelectLessonPlan = (plan: LessonPlan) => {
        setSelectedLessonPlanId(plan.id);
        setIsEditingLessonPlan(false);
        setLessonPlanForm(null);
    };

    const handleSaveLessonPlan = async () => {
        if (!lessonPlanForm) return;
        if (!lessonPlanForm.classroomId || !lessonPlanForm.subject || !lessonPlanForm.date || !lessonPlanForm.topic) {
            alert('Preencha Turma, Disciplina, Data e Tema/Assunto.');
            return;
        }
        setIsSavingLessonPlan(true);
        try {
            const payload = {
                classroom_id: lessonPlanForm.classroomId,
                subject: lessonPlanForm.subject,
                grade_level: lessonPlanForm.gradeLevel,
                date: lessonPlanForm.date,
                duration: lessonPlanForm.duration,
                topic: lessonPlanForm.topic,
                objectives: lessonPlanForm.objectives,
                content_program: lessonPlanForm.contentProgram,
                methodology: lessonPlanForm.methodology,
                resources: lessonPlanForm.resources,
                activities: lessonPlanForm.activities,
                assessment: lessonPlanForm.assessment,
            };
            if (lessonPlanForm.id) {
                const updated = await backend.updateLessonPlan(lessonPlanForm.id, payload);
                const mapped = mapLessonPlan(updated);
                setLessonPlans(prev => prev.map(p => p.id === mapped.id ? mapped : p));
                setLessonPlanForm(mapped);
            } else {
                const created = await backend.createLessonPlan(payload);
                const mapped = mapLessonPlan(created);
                setLessonPlans(prev => [mapped, ...prev]);
                setLessonPlanForm(mapped);
                setSelectedLessonPlanId(mapped.id);
            }
            setIsEditingLessonPlan(false);
        } catch (error) {
            console.error("Failed to save lesson plan", error);
        } finally {
            setIsSavingLessonPlan(false);
        }
    };

    const handleGenerateLessonPlan = async () => {
        if (!lessonPlanForm) return;
        setIsGeneratingLessonPlan(true);
        const prompt = `Gere um plano de aula em JSON com os campos: tema, objetivos, conteudo_programatico, metodologia, recursos_didaticos, atividades, avaliacao. Use verbos no infinitivo nos objetivos. Contexto: disciplina "${lessonPlanForm.subject}", serie/turma "${lessonPlanForm.gradeLevel}", duracao "${lessonPlanForm.duration}". Informacoes adicionais: "${lessonPlanAiContext}".`;
        try {
            const result = await generateInsight(prompt);
            const parsed = extractJsonPayload(result);
            if (parsed) {
                setLessonPlanForm(prev => prev ? ({
                    ...prev,
                    topic: normalizeAiField(parsed.tema) || prev.topic,
                    objectives: normalizeAiField(parsed.objetivos) || prev.objectives,
                    contentProgram: normalizeAiField(parsed.conteudo_programatico || parsed.conteudoProgramatico) || prev.contentProgram,
                    methodology: normalizeAiField(parsed.metodologia) || prev.methodology,
                    resources: normalizeAiField(parsed.recursos_didaticos || parsed.recursos) || prev.resources,
                    activities: normalizeAiField(parsed.atividades) || prev.activities,
                    assessment: normalizeAiField(parsed.avaliacao) || prev.assessment,
                }) : prev);
            } else {
                setLessonPlanForm(prev => prev ? ({
                    ...prev,
                    activities: result || prev.activities,
                }) : prev);
            }
        } catch (error) {
            console.error("Failed to generate lesson plan", error);
        } finally {
            setIsGeneratingLessonPlan(false);
        }
    };

    useEffect(() => {
        if (!isStudent) return;
        if (activeTab === 'attendance') {
            setActiveTab('grades');
        }
    }, [activeTab, isStudent]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestão Acadêmica</h2>
                    <p className="text-slate-500">Gerencie notas, frequência e conteúdo de aulas.</p>
                </div>
                <div className="flex items-center gap-3">
                    {!isStudent && (
                        <select
                            className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                            value={selectedClassId || ''}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                        >
                            {visibleClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <select
                        className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:bg-slate-50"
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        disabled={availableSubjects.length === 0}
                    >
                        <option value="">Selecione a disciplina</option>
                        {availableSubjects.map((subject) => (
                            <option key={subject} value={subject}>
                                {subject}
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
                {!isStudent && (
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'attendance' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Clock size={16} /> Frequência
                    </button>
                )}
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
                {isTeacher && (
                    <button
                        onClick={() => setActiveTab('lessonPlans')}
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'lessonPlans' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <ClipboardList size={16} /> Plano de Aula
                    </button>
                )}
            </div>

            {/* Tab Content: GRADES */}
            {activeTab === 'grades' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-slate-800">Notas do {termLabel}</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="text-xs uppercase tracking-wide text-slate-400">Período</span>
                                <select
                                    className="border border-slate-200 rounded-lg px-2 py-1 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={selectedTerm || '1'}
                                    onChange={(e) => setSelectedTerm(e.target.value)}
                                >
                                    {Array.from({ length: maxTerm }, (_, idx) => (
                                        <option key={idx + 1} value={String(idx + 1)}>
                                            {gradingPeriodLabel} {idx + 1}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
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
                                <th className="px-6 py-3 font-medium text-center w-40">{grade1Label}</th>
                                <th className="px-6 py-3 font-medium text-center w-40">{grade2Label}</th>
                                {gradingConfig.recoveryType !== 'none' && (
                                    <th className="px-6 py-3 font-medium text-center w-40">{recoveryLabel}</th>
                                )}
                                <th className="px-6 py-3 font-medium text-center w-32">Média</th>
                                <th className="px-6 py-3 font-medium text-center">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {gradesData.map((record) => (
                                <tr key={record.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {record.studentName.substring(0, 2).toUpperCase()}
                                        </div>
                                        {record.studentName}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isStudent ? (
                                            <span className="font-semibold text-slate-700">
                                                {record.grade1 ?? '-'}
                                            </span>
                                        ) : (
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
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isStudent ? (
                                            <span className="font-semibold text-slate-700">
                                                {record.grade2 ?? '-'}
                                            </span>
                                        ) : (
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
                                        )}
                                    </td>
                                    {gradingConfig.recoveryType !== 'none' && (
                                        <td className="px-6 py-4 text-center">
                                            {isStudent ? (
                                                <span className="font-semibold text-slate-700">
                                                    {record.recoveryGrade ?? '-'}
                                                </span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={record.recoveryGrade ?? ''}
                                                    onChange={(e) => handleRecoveryChange(record.id, e.target.value)}
                                                    step="0.5"
                                                    min="0"
                                                    max="10"
                                                    className="w-20 text-center border border-slate-200 rounded p-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-indigo-300"
                                                    placeholder="-"
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-center font-bold text-slate-800">
                                        {(record.finalGrade ?? record.average).toFixed(1)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${(record.finalGrade ?? record.average) >= gradingConfig.minPassingGrade ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                            }`}>
                                            {(record.finalGrade ?? record.average) >= gradingConfig.minPassingGrade ? 'Aprovado' : 'Recuperação'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!isStudent && (
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
                    )}
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
                                        {student.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{student.name}</p>
                                        <p className="text-xs text-slate-500">Matrícula: 202300{student.id}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleAttendance(student.id, 'present')}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${attendanceState[student.id] === 'present'
                                                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500 font-semibold'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <CheckCircle size={16} /> Presente
                                    </button>
                                    <button
                                        onClick={() => toggleAttendance(student.id, 'absent')}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${attendanceState[student.id] === 'absent'
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
                    {!isStudent && (
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
                                            onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">Tópico Principal <span className="text-rose-500">*</span></label>
                                        <input
                                            type="text" placeholder="Ex: Equações Lineares"
                                            className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={newEntry.topic}
                                            onChange={(e) => setNewEntry({ ...newEntry, topic: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">Descrição do Conteúdo</label>
                                        <textarea
                                            placeholder="O que foi abordado na aula..."
                                            className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                                            value={newEntry.description}
                                            onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700">Tarefa de Casa</label>
                                        <textarea
                                            placeholder="Exercícios ou leituras para a próxima aula..."
                                            className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                                            value={newEntry.homework}
                                            onChange={(e) => setNewEntry({ ...newEntry, homework: e.target.value })}
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
                    )}

                    {/* Timeline List */}
                    <div className={isStudent ? 'lg:col-span-3' : 'lg:col-span-2'}>
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
                                                            {!isStudent && (
                                                                <>
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
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => {
                                                            if (isStudent) return;
                                                            handleEditEntry(entry);
                                                        }}
                                                        className={`p-4 rounded-lg border transition-all ${isStudent ? '' : 'cursor-pointer'} group relative ${isEditing
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
                                                        {!isEditing && !isStudent && (
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
                    {!isStudent && (
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
                    )}

                    {/* Materials Grid */}
                    <div className={isStudent ? 'lg:col-span-4' : 'lg:col-span-3'}>
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
                                    className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${selectedSyllabusId === syllabus.id
                                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                                            : 'hover:bg-slate-50 text-slate-600 border border-transparent'
                                        }`}
                                >
                                    <span className="font-semibold text-sm">{syllabus.subject}</span>
                                    {selectedSyllabusId === syllabus.id && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                                </button>
                            ))}
                            {!isStudent && (
                                <button
                                    className="w-full text-left p-3 rounded-lg text-slate-400 text-sm border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 mt-4"
                                    onClick={handleCreateSyllabus}
                                >
                                    <Plus size={14} /> Adicionar Disciplina
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Content View / Edit */}
                    <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                        {isEditingSyllabus && syllabusFormData ? (
                            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Edit size={24} className="text-indigo-600" />
                                        {isCreatingSyllabus ? 'Nova Ementa' : `Editar Ementa: ${syllabusFormData.subject}`}
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setIsEditingSyllabus(false);
                                                setIsCreatingSyllabus(false);
                                                setSyllabusFormData(null);
                                            }}
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Disciplina</label>
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={syllabusFormData.subject}
                                                onChange={e => setSyllabusFormData({ ...syllabusFormData, subject: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Série/Ano</label>
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={syllabusFormData.gradeLevel}
                                                onChange={e => setSyllabusFormData({ ...syllabusFormData, gradeLevel: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Descrição da Disciplina</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none leading-relaxed"
                                            value={syllabusFormData.description}
                                            onChange={e => setSyllabusFormData({ ...syllabusFormData, description: e.target.value })}
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
                                            onChange={e => setSyllabusFormData({ ...syllabusFormData, bibliography: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : activeSyllabus ? (
                            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                                                <Book size={24} />
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-800">{activeSyllabus.subject}</h2>
                                        </div>
                                        <p className="text-slate-500 text-sm">
                                            Plano de Ensino Anual
                                            {activeSyllabus.gradeLevel ? ` • ${activeSyllabus.gradeLevel}` : ''}
                                        </p>
                                    </div>
                                    {!isStudent && (
                                        <button
                                            onClick={handleEditSyllabus}
                                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 font-medium"
                                        >
                                            <Edit size={16} /> Editar Ementa
                                        </button>
                                    )}
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
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <ScrollText size={64} className="mb-4 text-slate-200" />
                                <p className="font-medium">Selecione uma disciplina para visualizar a ementa.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab Content: LESSON PLANS */}
            {activeTab === 'lessonPlans' && isTeacher && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in h-[calc(100vh-250px)]">
                    <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Planos</h3>
                            <button
                                onClick={handleStartLessonPlan}
                                className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                                Novo
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {lessonPlans.map(plan => (
                                <button
                                    key={plan.id}
                                    onClick={() => handleSelectLessonPlan(plan)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${selectedLessonPlanId === plan.id
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'hover:bg-slate-50 border-transparent text-slate-600'
                                    }`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <div className="font-semibold text-sm">{plan.topic || plan.subject}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {plan.classroomName || 'Turma'} • {new Date(plan.date).toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${plan.status === 'Approved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : plan.status === 'Rejected'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {plan.status === 'Approved' ? 'Aprovado' : plan.status === 'Rejected' ? 'Reprovado' : 'Pendente'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                            {lessonPlans.length === 0 && (
                                <div className="text-center text-sm text-slate-400 py-6">
                                    Nenhum plano enviado.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                        {isEditingLessonPlan && lessonPlanForm ? (
                            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <ClipboardList size={22} className="text-indigo-600" />
                                        Plano de Aula
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setIsEditingLessonPlan(false);
                                                setLessonPlanForm(null);
                                            }}
                                            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveLessonPlan}
                                            disabled={isSavingLessonPlan}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-70"
                                        >
                                            <Save size={16} /> {isSavingLessonPlan ? 'Salvando...' : 'Enviar Plano'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Escola</label>
                                            <input
                                                type="text"
                                                readOnly
                                                className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 text-slate-600"
                                                value={schoolName || '—'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Professor(a)</label>
                                            <input
                                                type="text"
                                                readOnly
                                                className="w-full border border-slate-200 rounded-lg p-3 text-sm bg-slate-50 text-slate-600"
                                                value={teacherName || 'Professor(a)'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Disciplina</label>
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={lessonPlanForm.subject}
                                                onChange={e => setLessonPlanForm({ ...lessonPlanForm, subject: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Série/Turma</label>
                                            <select
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={lessonPlanForm.classroomId}
                                                onChange={e => {
                                                    const classroomId = e.target.value;
                                                    const classroom = visibleClasses.find(cls => cls.id === classroomId);
                                                    setLessonPlanForm({
                                                        ...lessonPlanForm,
                                                        classroomId,
                                                        classroomName: classroom?.name || '',
                                                        gradeLevel: classroom?.gradeLevel || lessonPlanForm.gradeLevel,
                                                    });
                                                }}
                                            >
                                                <option value="">Selecione...</option>
                                                {visibleClasses.map(cls => (
                                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Data</label>
                                            <input
                                                type="date"
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={lessonPlanForm.date}
                                                onChange={e => setLessonPlanForm({ ...lessonPlanForm, date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Duração</label>
                                            <input
                                                type="text"
                                                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Ex: 50 minutos"
                                                value={lessonPlanForm.duration}
                                                onChange={e => setLessonPlanForm({ ...lessonPlanForm, duration: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-700">Gerar com IA</div>
                                            <div className="text-xs text-slate-500">Preencha disciplina, série e duração para melhorar o resultado.</div>
                                        </div>
                                        <button
                                            onClick={handleGenerateLessonPlan}
                                            disabled={isGeneratingLessonPlan}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70"
                                        >
                                            {isGeneratingLessonPlan ? 'Gerando...' : 'Usar IA'}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Contexto para a IA</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                                            placeholder="Ex: turma com dificuldade em leitura, foco em BNCC EF05LP..."
                                            value={lessonPlanAiContext}
                                            onChange={e => setLessonPlanAiContext(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Tema/Assunto</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                            value={lessonPlanForm.topic}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, topic: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Objetivos de Aprendizagem</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-28 resize-none"
                                            value={lessonPlanForm.objectives}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, objectives: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Conteúdo Programático</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-28 resize-none"
                                            value={lessonPlanForm.contentProgram}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, contentProgram: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Metodologia/Estratégias</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                            value={lessonPlanForm.methodology}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, methodology: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Recursos Didáticos</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                                            value={lessonPlanForm.resources}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, resources: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Atividades</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-28 resize-none"
                                            value={lessonPlanForm.activities}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, activities: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Avaliação</label>
                                        <textarea
                                            className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                                            value={lessonPlanForm.assessment}
                                            onChange={e => setLessonPlanForm({ ...lessonPlanForm, assessment: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : selectedLessonPlan ? (
                            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                                <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedLessonPlan.topic}</h2>
                                        <p className="text-slate-500 text-sm mt-1">
                                            {selectedLessonPlan.classroomName} • {new Date(selectedLessonPlan.date).toLocaleDateString('pt-BR')}
                                        </p>
                                        <span className={`inline-flex mt-3 px-3 py-1 rounded-full text-xs font-semibold ${selectedLessonPlan.status === 'Approved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : selectedLessonPlan.status === 'Rejected'
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {selectedLessonPlan.status === 'Approved' ? 'Aprovado' : selectedLessonPlan.status === 'Rejected' ? 'Reprovado' : 'Pendente'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleEditLessonPlan(selectedLessonPlan)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 font-medium"
                                    >
                                        <Edit size={16} /> Editar Plano
                                    </button>
                                </div>

                                {selectedLessonPlan.feedback && (
                                    <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                                        Parecer: {selectedLessonPlan.feedback}
                                    </div>
                                )}

                                <div className="space-y-6 text-sm text-slate-700">
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Objetivos de Aprendizagem</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.objectives || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Conteúdo Programático</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.contentProgram || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Metodologia/Estratégias</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.methodology || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Recursos Didáticos</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.resources || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Atividades</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.activities || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Avaliação</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 whitespace-pre-line">{selectedLessonPlan.assessment || '—'}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <ClipboardList size={64} className="mb-4 text-slate-200" />
                                <p className="font-medium">Clique em "Novo" para criar um plano de aula.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicModule;
