import React, { useState, useMemo, useEffect } from 'react';
import { CalendarClock, User, Check, Clock, School, ChevronRight, Ban, Settings, Plus, Trash2, ArrowRight, Printer, Layout } from 'lucide-react';
import { Staff, SchoolClass } from '../types';
import { backend } from '../services/backendService';

type Mode = 'availability' | 'timetable' | 'configuration' | 'personal';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const INITIAL_TIME_SLOTS = [
    '07:30 - 08:20',
    '08:20 - 09:10',
    '09:10 - 10:00',
    '10:20 - 11:10',
    '11:10 - 12:00'
];

type TimeSlotItem = {
    id: string;
    label: string;
    start: string;
    end: string;
};

// Record<TeacherID, Record<DayIndex, SlotIndex[]>>
type AvailabilityMap = Record<string, Record<number, number[]>>;
// Record<ClassID, Record<DayIndex, Record<SlotIndex, SubjectName>>>
type ScheduleMap = Record<string, Record<number, Record<number, string>>>;

// Pre-populate some schedule data for demonstration purposes
const INITIAL_SCHEDULE_DATA: ScheduleMap = {
    'c1': { // 9º Ano A
        0: { 0: 'Matemática', 1: 'Matemática', 2: 'Português' }, // Segunda
        1: { 0: 'História', 1: 'Geografia', 2: 'Matemática' }, // Terça
        2: { 0: 'Português', 1: 'Português', 2: 'Ciências' }, // Quarta
    },
    'c2': { // 8º Ano C
        0: { 2: 'Matemática', 3: 'Matemática' }, // Segunda (Carlos teaches here too)
        1: { 0: 'Português', 1: 'História' }
    }
};

const ScheduleModule: React.FC = () => {
    const [mode, setMode] = useState<Mode>('availability');

    // Time Slot Configuration State
    const [timeSlots, setTimeSlots] = useState<TimeSlotItem[]>([]);
    const [newSlotStart, setNewSlotStart] = useState('');
    const [newSlotEnd, setNewSlotEnd] = useState('');

    const [teachers, setTeachers] = useState<Staff[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);

    // Default to first teacher for demo purposes if null
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    // Mock Data State
    const [availability, setAvailability] = useState<AvailabilityMap>({});
    const [availabilityIds, setAvailabilityIds] = useState<Record<string, string>>({});
    const [schedules, setSchedules] = useState<ScheduleMap>({});
    const [scheduleIds, setScheduleIds] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadScheduleData = async () => {
            try {
                const [me, staffData, classesData, slotsData, availabilityData, schedulesData] = await Promise.all([
                    backend.fetchMe(),
                    backend.fetchStaff(),
                    backend.fetchClassrooms(),
                    backend.fetchTimeSlots(),
                    backend.fetchAvailability(),
                    backend.fetchSchedules(),
                ]);

                const normalizedRole = String(me.role || '').toLowerCase() || null;

                const teachersList: Staff[] = staffData
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
                if (normalizedRole === 'teacher') {
                    const selfTeacher = teachersList.find((teacher) => teacher.id === String(me.id));
                    setTeachers(selfTeacher ? [selfTeacher] : []);
                    setSelectedTeacherId(selfTeacher?.id || null);
                } else {
                    setTeachers(teachersList);
                    setSelectedTeacherId(teachersList[0]?.id || null);
                }

                const allocationsByClass = await Promise.all(
                    classesData.map(async (item: any) => {
                        const allocations = await backend.fetchAllocations(String(item.id));
                        return { id: String(item.id), allocations };
                    })
                );
                const allocationsMap = new Map(
                    allocationsByClass.map(({ id, allocations }) => [id, allocations])
                );

                const classList: SchoolClass[] = classesData.map((cls: any) => ({
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
                setClasses(classList);
                setSelectedClassId(classList[0]?.id || null);

                const slotItems: TimeSlotItem[] = slotsData.length
                    ? slotsData.map((slot: any) => ({
                        id: String(slot.id),
                        label: slot.label || `${slot.start_time} - ${slot.end_time}`,
                        start: slot.start_time,
                        end: slot.end_time,
                    }))
                    : INITIAL_TIME_SLOTS.map((label, idx) => ({
                        id: `local-${idx}`,
                        label,
                        start: label.split(' - ')[0],
                        end: label.split(' - ')[1],
                    }));
                setTimeSlots(slotItems);

                const availabilityMap: AvailabilityMap = {};
                const availabilityIdMap: Record<string, string> = {};
                availabilityData.forEach((item: any) => {
                    const teacherId = String(item.teacher_id);
                    const slotIndex = slotItems.findIndex(slot => slot.id === String(item.time_slot_id));
                    if (slotIndex < 0) return;
                    if (!availabilityMap[teacherId]) availabilityMap[teacherId] = {};
                    if (!availabilityMap[teacherId][item.day_of_week]) availabilityMap[teacherId][item.day_of_week] = [];
                    availabilityMap[teacherId][item.day_of_week].push(slotIndex);
                    availabilityIdMap[`${teacherId}-${item.day_of_week}-${slotIndex}`] = String(item.id);
                });
                setAvailability(availabilityMap);
                setAvailabilityIds(availabilityIdMap);

                const scheduleMap: ScheduleMap = {};
                const scheduleIdMap: Record<string, string> = {};
                schedulesData.forEach((entry: any) => {
                    const classId = String(entry.classroom_id);
                    const slotIndex = slotItems.findIndex(slot => slot.id === String(entry.time_slot_id));
                    if (slotIndex < 0) return;
                    if (!scheduleMap[classId]) scheduleMap[classId] = {};
                    if (!scheduleMap[classId][entry.day_of_week]) scheduleMap[classId][entry.day_of_week] = {};
                    scheduleMap[classId][entry.day_of_week][slotIndex] = entry.subject;
                    scheduleIdMap[`${classId}-${entry.day_of_week}-${slotIndex}`] = String(entry.id);
                });
                setSchedules(scheduleMap);
                setScheduleIds(scheduleIdMap);
            } catch (error) {
                console.error("Failed to load schedule data", error);
            }
        };

        loadScheduleData();
    }, []);

    // --- Configuration Logic ---
    const handleAddSlot = async () => {
        if (!newSlotStart || !newSlotEnd) return;
        if (newSlotStart >= newSlotEnd) {
            alert("O horário de início deve ser anterior ao horário de fim.");
            return;
        }
        try {
            const created = await backend.createTimeSlot({
                label: `${newSlotStart} - ${newSlotEnd}`,
                start_time: newSlotStart,
                end_time: newSlotEnd,
                sort_order: timeSlots.length,
            });
            setTimeSlots([
                ...timeSlots,
                {
                    id: String(created.id),
                    label: created.label,
                    start: created.start_time,
                    end: created.end_time,
                },
            ]);
            setNewSlotStart('');
            setNewSlotEnd('');
        } catch (error) {
            console.error("Failed to add time slot", error);
        }
    };

    const handleDeleteSlot = async (index: number) => {
        const slot = timeSlots[index];
        if (!slot) return;
        if (!/^\d+$/.test(slot.id)) {
            setTimeSlots(timeSlots.filter((_, i) => i !== index));
            return;
        }
        try {
            await backend.deleteTimeSlot(slot.id);
            const newSlots = timeSlots.filter((_, i) => i !== index);
            setTimeSlots(newSlots);
        } catch (error) {
            console.error("Failed to delete time slot", error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // --- Availability Logic ---
    const toggleAvailability = async (dayIndex: number, slotIndex: number) => {
        if (!selectedTeacherId) return;
        const slot = timeSlots[slotIndex];
        if (!slot) return;
        if (!/^\d+$/.test(slot.id)) {
            return;
        }

        const key = `${selectedTeacherId}-${dayIndex}-${slotIndex}`;
        const isUnavailable = availability[selectedTeacherId]?.[dayIndex]?.includes(slotIndex);

        try {
            if (isUnavailable) {
                const availabilityId = availabilityIds[key];
                if (availabilityId) {
                    await backend.deleteAvailability(availabilityId);
                }
            } else {
                const created = await backend.setAvailability({
                    teacher_id: selectedTeacherId,
                    time_slot_id: slot.id,
                    day_of_week: dayIndex,
                });
                setAvailabilityIds(prev => ({ ...prev, [key]: String(created.id) }));
            }

            setAvailability(prev => {
                const teacherAvail = prev[selectedTeacherId] || {};
                const dayAvail = teacherAvail[dayIndex] || [];
                const newDayAvail = isUnavailable
                    ? dayAvail.filter(s => s !== slotIndex)
                    : [...dayAvail, slotIndex];
                return {
                    ...prev,
                    [selectedTeacherId]: {
                        ...teacherAvail,
                        [dayIndex]: newDayAvail
                    }
                };
            });
        } catch (error) {
            console.error("Failed to update availability", error);
        }
    };

    const isSlotUnavailable = (teacherId: string, dayIndex: number, slotIndex: number) => {
        return availability[teacherId]?.[dayIndex]?.includes(slotIndex);
    };

    // --- Schedule Logic ---
    const selectedClass = classes.find(c => c.id === selectedClassId);

    const handleSetSubject = async (dayIndex: number, slotIndex: number, subject: string) => {
        if (!selectedClassId) return;
        const slot = timeSlots[slotIndex];
        if (!slot) return;
        if (!/^\d+$/.test(slot.id)) {
            return;
        }
        const key = `${selectedClassId}-${dayIndex}-${slotIndex}`;

        try {
            const current = schedules[selectedClassId]?.[dayIndex]?.[slotIndex];
            if (current === subject || !subject) {
                const scheduleId = scheduleIds[key];
                if (scheduleId) {
                    await backend.deleteSchedule(scheduleId);
                }
                setSchedules(prev => {
                    const classSched = prev[selectedClassId] || {};
                    const daySched = classSched[dayIndex] || {};
                    const newDaySched = { ...daySched };
                    delete newDaySched[slotIndex];
                    return {
                        ...prev,
                        [selectedClassId]: { ...classSched, [dayIndex]: newDaySched }
                    };
                });
                setScheduleIds(prev => {
                    const updated = { ...prev };
                    delete updated[key];
                    return updated;
                });
                return;
            }

            const teacherId = selectedClass?.teacherAllocations.find(t => t.subject === subject)?.teacherId;
            const created = await backend.setSchedule({
                classroom_id: selectedClassId,
                time_slot_id: slot.id,
                day_of_week: dayIndex,
                subject,
                teacher_id: teacherId,
            });
            setScheduleIds(prev => ({ ...prev, [key]: String(created.id) }));
            setSchedules(prev => {
                const classSched = prev[selectedClassId] || {};
                const daySched = classSched[dayIndex] || {};
                return {
                    ...prev,
                    [selectedClassId]: {
                        ...classSched,
                        [dayIndex]: {
                            ...daySched,
                            [slotIndex]: subject
                        }
                    }
                };
            });
        } catch (error) {
            console.error("Failed to update schedule", error);
        }
    };

    const getScheduledSubject = (classId: string, dayIndex: number, slotIndex: number) => {
        return schedules[classId]?.[dayIndex]?.[slotIndex];
    };

    // --- Teacher Personal View Logic ---
    const getTeacherPersonalSchedule = useMemo(() => {
        if (!selectedTeacherId) return {};

        // Structure: Record<DayIndex, Record<SlotIndex, { className: string, subject: string }>>
        const personalSchedule: Record<number, Record<number, { className: string, subject: string }>> = {};

        // Iterate through ALL classes to find where this teacher is assigned
        classes.forEach(cls => {
            // Check if teacher is allocated to any subject in this class
            const teacherAllocations = cls.teacherAllocations.filter(t => t.teacherId === selectedTeacherId);

            if (teacherAllocations.length > 0) {
                // Get the schedule for this class
                const classSchedule = schedules[cls.id];
                if (!classSchedule) return;

                // Loop through days and slots of this class schedule
                Object.entries(classSchedule).forEach(([dayIdxStr, slots]) => {
                    const dayIdx = parseInt(dayIdxStr);
                    Object.entries(slots).forEach(([slotIdxStr, subject]) => {
                        const slotIdx = parseInt(slotIdxStr);

                        // If the subject at this slot matches one of the teacher's allocated subjects
                        if (teacherAllocations.some(t => t.subject === subject)) {
                            if (!personalSchedule[dayIdx]) personalSchedule[dayIdx] = {};
                            personalSchedule[dayIdx][slotIdx] = {
                                className: cls.name,
                                subject: subject
                            };
                        }
                    });
                });
            }
        });

        return personalSchedule;
    }, [classes, schedules, selectedTeacherId]);

    const currentTeacherName = teachers.find(t => t.id === selectedTeacherId)?.name;

    return (
        <div className="space-y-6 h-auto lg:h-[calc(100vh-140px)] flex flex-col">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #personal-schedule-container, #personal-schedule-container * {
                        visibility: visible;
                    }
                    #personal-schedule-container {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        z-index: 9999;
                        padding: 20px;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Grade e Horários</h2>
                    <p className="text-slate-500">Defina a disponibilidade dos professores e monte o quadro de aulas.</p>
                </div>
                <div className="bg-slate-200 p-1 rounded-lg flex overflow-x-auto w-full lg:w-auto">
                    <button
                        onClick={() => setMode('personal')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'personal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layout size={16} /> Minha Grade
                    </button>
                    <div className="w-px bg-slate-300 mx-1 my-2"></div>
                    <button
                        onClick={() => setMode('configuration')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'configuration' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Settings size={16} /> Definição
                    </button>
                    <button
                        onClick={() => setMode('availability')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'availability' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={16} /> Disponibilidade
                    </button>
                    <button
                        onClick={() => setMode('timetable')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${mode === 'timetable' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CalendarClock size={16} /> Quadro Geral
                    </button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left Sidebar or Config Panel */}
                {mode === 'configuration' ? (
                    <div className="col-span-1 lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Config Form */}
                        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-fit">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Plus size={20} className="text-indigo-600" />
                                Adicionar Intervalo
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">Início da Aula</label>
                                    <input
                                        type="time"
                                        className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newSlotStart}
                                        onChange={(e) => setNewSlotStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1">Fim da Aula</label>
                                    <input
                                        type="time"
                                        className="w-full border border-slate-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newSlotEnd}
                                        onChange={(e) => setNewSlotEnd(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleAddSlot}
                                    className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    Adicionar Horário
                                </button>
                            </div>
                        </div>

                        {/* List of Slots */}
                        <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-indigo-600" />
                                Horários Definidos ({timeSlots.length})
                            </h3>
                            <div className="flex-1 overflow-y-auto">
                                <div className="space-y-2">
                                    {timeSlots.map((slot, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-lg hover:border-indigo-200 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-white px-3 py-1 rounded border border-slate-200 text-sm font-bold text-slate-700 font-mono">
                                                    {index + 1}º Aula
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-800 font-medium">
                                                    <Clock size={16} className="text-indigo-500" />
                                                    {slot.start}
                                                    <ArrowRight size={14} className="text-slate-400" />
                                                    {slot.end}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSlot(index)}
                                                className="text-slate-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded transition-all"
                                                title="Remover horário"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {timeSlots.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                            <Clock size={48} className="mx-auto mb-3 opacity-20" />
                                            <p>Nenhum horário definido.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : mode === 'personal' ? (
                    <div id="personal-schedule-container" className="col-span-12 flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <User size={20} className="text-indigo-600" />
                                    Minha Grade: {currentTeacherName}
                                </h3>
                                <p className="text-xs text-slate-500">Visualização exclusiva das suas aulas atribuídas.</p>
                            </div>
                            <div className="flex items-center gap-4 no-print">
                                {/* Simulator for Demo Purposes */}
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                    <span className="text-xs text-slate-500 font-bold uppercase">Vendo como:</span>
                                    <select
                                        value={selectedTeacherId || ''}
                                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                                        className="text-sm font-medium text-slate-700 outline-none bg-transparent"
                                    >
                                        {teachers.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                                >
                                    <Printer size={16} /> Imprimir
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            <div className="grid grid-cols-6 gap-3 min-w-[800px]">
                                {/* Header Row */}
                                <div className="p-3 font-bold text-slate-400 text-xs uppercase text-center flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">Horário</div>
                                {DAYS.map(day => (
                                    <div key={day} className="p-3 font-bold text-white text-sm text-center bg-indigo-600 rounded-lg shadow-sm print:bg-slate-200 print:text-black print:border print:border-slate-300">
                                        {day}
                                    </div>
                                ))}

                                {/* Rows */}
                                {timeSlots.map((slot, slotIndex) => (
                                    <React.Fragment key={slot.id}>
                                        <div className="p-4 font-bold text-slate-600 text-xs flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100">
                                            <span>{slot.start}</span>
                                            <ArrowRight size={10} className="text-slate-300 my-1 rotate-90" />
                                            <span>{slot.end}</span>
                                        </div>
                                        {DAYS.map((_, dayIndex) => {
                                            const scheduleItem = getTeacherPersonalSchedule[dayIndex]?.[slotIndex];

                                            return (
                                                <div
                                                    key={`${dayIndex}-${slotIndex}`}
                                                    className={`rounded-xl border p-3 flex flex-col justify-center min-h-[100px] transition-all relative overflow-hidden ${scheduleItem
                                                        ? 'bg-white border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 group'
                                                        : 'bg-slate-50/50 border-slate-100 border-dashed'
                                                        }`}
                                                >
                                                    {scheduleItem ? (
                                                        <>
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 print:bg-slate-400"></div>
                                                            <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                                                                {scheduleItem.className}
                                                            </div>
                                                            <div className="font-bold text-sm text-indigo-900 leading-tight">
                                                                {scheduleItem.subject}
                                                            </div>
                                                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                                                <School size={10} /> Sala 10{dayIndex + 1}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-[10px] font-medium text-slate-300 uppercase">Livre</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Left Sidebar: List */}
                        <div className="col-span-1 lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden max-h-[300px] lg:max-h-none">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
                                    {mode === 'availability' ? 'Professores' : 'Turmas'}
                                </h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {mode === 'availability' ? (
                                    teachers.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedTeacherId(t.id)}
                                            className={`w-full text-left p-3 rounded-lg transition-all border flex items-center justify-between ${selectedTeacherId === t.id
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-bold text-sm">{t.name}</div>
                                                <div className={`text-xs ${selectedTeacherId === t.id ? 'text-indigo-200' : 'text-slate-400'}`}>{t.department}</div>
                                            </div>
                                            {selectedTeacherId === t.id && <ChevronRight size={16} />}
                                        </button>
                                    ))
                                ) : (
                                    classes.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => setSelectedClassId(c.id)}
                                            className={`w-full text-left p-3 rounded-lg transition-all border flex items-center justify-between ${selectedClassId === c.id
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-bold text-sm">{c.name}</div>
                                                <div className={`text-xs ${selectedClassId === c.id ? 'text-indigo-200' : 'text-slate-400'}`}>{c.shift === 'Morning' ? 'Manhã' : 'Tarde'}</div>
                                            </div>
                                            {selectedClassId === c.id && <ChevronRight size={16} />}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Area: Grid */}
                        <div className="col-span-1 lg:col-span-9 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden min-h-[500px]">
                            {((mode === 'availability' && !selectedTeacherId) || (mode === 'timetable' && !selectedClassId)) ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                    {mode === 'availability' ? <User size={48} className="mb-4 opacity-50" /> : <School size={48} className="mb-4 opacity-50" />}
                                    <p className="font-medium">Selecione um item à esquerda para visualizar</p>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col">
                                    {/* Header Info */}
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800">
                                                {mode === 'availability'
                                                    ? `Disponibilidade: ${teachers.find(t => t.id === selectedTeacherId)?.name}`
                                                    : `Grade Horária: ${classes.find(c => c.id === selectedClassId)?.name}`
                                                }
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {mode === 'availability'
                                                    ? 'Clique nos horários para marcar como Indisponível (Vermelho).'
                                                    : 'Clique nos horários para atribuir uma disciplina.'
                                                }
                                            </p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-medium">
                                            {mode === 'availability' && (
                                                <>
                                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div> Disponível</div>
                                                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-100 border border-rose-300 rounded"></div> Indisponível</div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* The Grid */}
                                    <div className="flex-1 overflow-auto p-6">
                                        {timeSlots.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                <Clock size={48} className="mb-4 opacity-20" />
                                                <p>Nenhum horário configurado.</p>
                                                <button onClick={() => setMode('configuration')} className="text-indigo-600 hover:underline mt-2">Configurar Horários</button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-6 gap-2 min-w-[800px]">
                                                {/* Header Row */}
                                                <div className="p-2 font-bold text-slate-400 text-xs uppercase text-center flex items-center justify-center bg-slate-50 rounded">Horário</div>
                                                {DAYS.map(day => (
                                                    <div key={day} className="p-2 font-bold text-slate-700 text-sm text-center bg-slate-100 rounded border border-slate-200">
                                                        {day}
                                                    </div>
                                                ))}

                                                {/* Rows */}
                                                {timeSlots.map((slot, slotIndex) => (
                                                    <React.Fragment key={slot.id}>
                                                        <div className="p-3 font-semibold text-slate-500 text-xs flex items-center justify-center bg-slate-50 rounded border border-slate-100">
                                                            <Clock size={12} className="mr-1" />
                                                            {slot.label}
                                                        </div>
                                                        {DAYS.map((_, dayIndex) => {
                                                            // RENDER CELL LOGIC
                                                            if (mode === 'availability') {
                                                                const unavailable = isSlotUnavailable(selectedTeacherId!, dayIndex, slotIndex);
                                                                return (
                                                                    <button
                                                                        key={`${dayIndex}-${slotIndex}`}
                                                                        onClick={() => toggleAvailability(dayIndex, slotIndex)}
                                                                        className={`h-24 rounded border transition-all flex items-center justify-center relative group ${unavailable
                                                                            ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                                                                            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                                                            }`}
                                                                    >
                                                                        {unavailable ? (
                                                                            <div className="flex flex-col items-center text-rose-400">
                                                                                <Ban size={20} />
                                                                                <span className="text-[10px] font-bold mt-1">Bloqueado</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col items-center text-emerald-400 opacity-50 group-hover:opacity-100">
                                                                                <Check size={20} />
                                                                            </div>
                                                                        )}
                                                                    </button>
                                                                );
                                                            } else {
                                                                // TIMETABLE MODE
                                                                const subject = getScheduledSubject(selectedClassId!, dayIndex, slotIndex);
                                                                const teacherAlloc = selectedClass?.teacherAllocations.find(t => t.subject === subject);
                                                                const teacher = teachers.find(t => t.id === teacherAlloc?.teacherId);

                                                                return (
                                                                    <div key={`${dayIndex}-${slotIndex}`} className="relative group">
                                                                        <button
                                                                            className={`w-full h-24 rounded border transition-all p-2 flex flex-col items-start justify-start text-left ${subject
                                                                                ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-300 shadow-sm'
                                                                                : 'bg-white border-slate-200 hover:border-indigo-300 border-dashed'
                                                                                }`}
                                                                        >
                                                                            {subject ? (
                                                                                <>
                                                                                    <div className="font-bold text-xs text-indigo-900 line-clamp-2">{subject}</div>
                                                                                    {teacher && (
                                                                                        <div className="mt-auto flex items-center gap-1 text-[10px] text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-100 w-full">
                                                                                            <User size={10} /> {teacher.name.split(' ')[0]}
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-slate-300 group-hover:text-indigo-400">
                                                                                    <span className="text-xs">+ Add</span>
                                                                                </div>
                                                                            )}
                                                                        </button>

                                                                        {/* HOVER MENU TO SELECT SUBJECT */}
                                                                        <div className="absolute top-full left-0 z-10 w-48 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden hidden group-hover:block max-h-48 overflow-y-auto">
                                                                            <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">Atribuir Aula</div>
                                                                            {selectedClass?.teacherAllocations.map(alloc => (
                                                                                <button
                                                                                    key={alloc.subject}
                                                                                    onClick={() => handleSetSubject(dayIndex, slotIndex, alloc.subject)}
                                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-slate-700 border-b border-slate-50 last:border-0"
                                                                                >
                                                                                    <span className="font-bold">{alloc.subject}</span>
                                                                                    {/* Find teacher name */}
                                                                                    <span className="block text-[10px] text-slate-400">
                                                                                        {teachers.find(t => t.id === alloc.teacherId)?.name || 'Sem prof.'}
                                                                                    </span>
                                                                                </button>
                                                                            ))}
                                                                            <button
                                                                                onClick={() => handleSetSubject(dayIndex, slotIndex, '')}
                                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 text-rose-600 font-bold"
                                                                            >
                                                                                Limpar Horário
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ScheduleModule;
