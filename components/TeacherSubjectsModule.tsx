import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, Users } from 'lucide-react';
import { SchoolClass, Staff } from '../types';
import { backend } from '../services/backendService';

const SUBJECTS_LIST = [
    'Matemática',
    'Português',
    'História',
    'Geografia',
    'Ciências',
    'Inglês',
    'Educação Física',
    'Artes',
    'Recreação',
    'Desenvolvimento Cognitivo',
];

const TeacherSubjectsModule: React.FC = () => {
    const [teachers, setTeachers] = useState<Staff[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [classesData, staffData] = await Promise.all([
                    backend.fetchClassrooms(),
                    backend.fetchStaff(),
                ]);

                const classAllocations = await Promise.all(
                    classesData.map(async (item: any) => {
                        const allocations = await backend.fetchAllocations(String(item.id));
                        return { id: String(item.id), allocations };
                    })
                );
                const allocationsByClass = new Map(
                    classAllocations.map(({ id, allocations }) => [id, allocations])
                );

                const classList: SchoolClass[] = classesData.map((cls: any) => ({
                    id: String(cls.id),
                    name: cls.name,
                    gradeLevel: cls.gradeLevel || cls.grade || '',
                    shift: cls.shift === 'morning' ? 'Morning' : cls.shift === 'afternoon' ? 'Afternoon' : 'Night',
                    academicYear: cls.academicYear || cls.year,
                    capacity: cls.capacity || 30,
                    enrolledStudentIds: [],
                    teacherAllocations: (allocationsByClass.get(String(cls.id)) || []).map((alloc: any) => ({
                        subject: alloc.subject,
                        teacherId: String(alloc.teacher_id),
                    })),
                }));
                setClasses(classList);
                setSelectedClassId(classList[0]?.id || null);

                const teacherList: Staff[] = staffData
                    .filter((member: any) => member.role === 'Teacher')
                    .map((member: any) => ({
                        id: String(member.id),
                        name: member.name,
                        role: member.role,
                        department: member.department || '',
                        phone: member.phone || '',
                        email: member.email || '',
                        admissionDate: member.admissionDate || member.admission_date || '',
                    }));
                setTeachers(teacherList);
                setSelectedTeacherId(teacherList[0]?.id || null);
            } catch (error) {
                console.error('Failed to load teacher subjects data', error);
            }
        };

        loadData();
    }, []);

    const filteredTeachers = useMemo(() => {
        return teachers.filter((teacher) =>
            teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [teachers, searchTerm]);

    const selectedClass = classes.find((cls) => cls.id === selectedClassId);
    const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId);

    const assignedSubjects = useMemo(() => {
        if (!selectedClass || !selectedTeacherId) return [];
        return selectedClass.teacherAllocations
            .filter((alloc) => alloc.teacherId === selectedTeacherId)
            .map((alloc) => alloc.subject);
    }, [selectedClass, selectedTeacherId]);

    const toggleSubject = async (subject: string) => {
        if (!selectedClassId || !selectedTeacherId) return;
        const isAssigned = assignedSubjects.includes(subject);
        try {
            if (isAssigned) {
                await backend.removeAllocation(selectedClassId, selectedTeacherId, subject);
                setClasses((prev) =>
                    prev.map((cls) => {
                        if (cls.id !== selectedClassId) return cls;
                        return {
                            ...cls,
                            teacherAllocations: cls.teacherAllocations.filter(
                                (alloc) =>
                                    !(alloc.teacherId === selectedTeacherId && alloc.subject === subject)
                            ),
                        };
                    })
                );
            } else {
                await backend.setAllocation(selectedClassId, selectedTeacherId, subject);
                setClasses((prev) =>
                    prev.map((cls) => {
                        if (cls.id !== selectedClassId) return cls;
                        return {
                            ...cls,
                            teacherAllocations: [
                                ...cls.teacherAllocations,
                                { teacherId: selectedTeacherId, subject },
                            ],
                        };
                    })
                );
            }
        } catch (error) {
            console.error('Failed to update teacher subject allocation', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Disciplinas por Professor</h2>
                    <p className="text-slate-500">
                        Selecione um professor e atribua mais de uma disciplina por turma.
                    </p>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                            <Users size={16} /> Professores
                        </h3>
                        <div className="relative mt-3">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar professor..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-[520px] overflow-y-auto p-2 space-y-1">
                        {filteredTeachers.map((teacher) => (
                            <button
                                key={teacher.id}
                                onClick={() => setSelectedTeacherId(teacher.id)}
                                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${selectedTeacherId === teacher.id
                                    ? 'bg-indigo-50 border border-indigo-200'
                                    : 'hover:bg-slate-50 border border-transparent'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${selectedTeacherId === teacher.id
                                    ? 'bg-indigo-200 text-indigo-700'
                                    : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    {teacher.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className={`font-semibold text-sm ${selectedTeacherId === teacher.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                                        {teacher.name}
                                    </div>
                                    <div className="text-xs text-slate-500">{teacher.department || 'Sem departamento'}</div>
                                </div>
                            </button>
                        ))}
                        {filteredTeachers.length === 0 && (
                            <div className="text-center text-sm text-slate-400 py-6">
                                Nenhum professor encontrado.
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    {!selectedTeacher || !selectedClass ? (
                        <div className="flex flex-col items-center justify-center text-slate-400 h-full">
                            <BookOpen size={48} className="mb-3 text-slate-200" />
                            <p className="text-sm">Selecione um professor e uma turma para atribuir disciplinas.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">{selectedTeacher.name}</h3>
                                    <p className="text-sm text-slate-500">
                                        Turma: <span className="font-semibold">{selectedClass.name}</span>
                                    </p>
                                </div>
                                <div className="text-sm text-slate-500">
                                    {assignedSubjects.length} disciplinas atribuídas
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {SUBJECTS_LIST.map((subject) => {
                                    const isAssigned = assignedSubjects.includes(subject);
                                    return (
                                        <button
                                            key={subject}
                                            onClick={() => toggleSubject(subject)}
                                            className={`border rounded-lg p-3 text-left transition-all ${isAssigned
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold">{subject}</span>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAssigned
                                                    ? 'bg-emerald-200 text-emerald-800'
                                                    : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {isAssigned ? 'Ativo' : 'Vazio'}
                                                </span>
                                            </div>
                                            <p className="text-xs mt-1 text-slate-500">
                                                Clique para {isAssigned ? 'remover' : 'atribuir'} disciplina.
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherSubjectsModule;
