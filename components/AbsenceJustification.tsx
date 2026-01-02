import React, { useState } from 'react';
import { Search, ClipboardCheck, Upload, CheckCircle, Calendar, AlertTriangle, FileText, X } from 'lucide-react';
import { MOCK_STUDENTS, MOCK_ABSENCES } from '../constants';
import { Absence } from '../types';

const AbsenceJustification: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [absences, setAbsences] = useState<Absence[]>(MOCK_ABSENCES);
    
    // Form State
    const [justificationReason, setJustificationReason] = useState('');
    const [justificationObservation, setJustificationObservation] = useState('');
    const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
    const [attachedFile, setAttachedFile] = useState<string | null>(null);

    // Filter students
    const filteredStudents = MOCK_STUDENTS.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectStudent = (id: string) => {
        setSelectedStudentId(id);
        setSearchTerm(''); 
        setSelectedAbsenceId(null);
    };

    const studentAbsences = selectedStudentId 
        ? absences.filter(a => a.studentName === MOCK_STUDENTS.find(s => s.id === selectedStudentId)?.name)
        : [];
    
    const selectedStudentData = MOCK_STUDENTS.find(s => s.id === selectedStudentId);

    const handleJustify = () => {
        if (!selectedAbsenceId || !justificationReason) return;
        
        setAbsences(prev => prev.map(a => 
            a.id === selectedAbsenceId 
            ? { ...a, justified: true, reason: justificationReason, observation: justificationObservation } // In a real app, we'd save the file ref too
            : a
        ));

        // Reset Form
        setJustificationReason('');
        setJustificationObservation('');
        setAttachedFile(null);
        setSelectedAbsenceId(null);
    };

    const handleFileUpload = () => {
        // Simulation
        setAttachedFile("atestado_medico_scan.pdf");
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Justificativa de Faltas</h2>
                    <p className="text-slate-500">Regularize a frequência dos alunos mediante apresentação de documentos.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Search & Student Info */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Search size={20} className="text-indigo-600" />
                            Buscar Aluno
                        </h3>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Nome do aluno..."
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto z-20">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(student => (
                                            <button 
                                                key={student.id}
                                                onClick={() => handleSelectStudent(student.id)}
                                                className="w-full text-left p-3 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0 transition-colors"
                                            >
                                                <span className="font-bold text-slate-800 block">{student.name}</span>
                                                <span className="text-xs text-slate-500">{student.grade}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-3 text-sm text-slate-500 text-center">Nenhum aluno encontrado</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedStudentData && (
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                                    {selectedStudentData.name.substring(0,2).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{selectedStudentData.name}</h4>
                                    <p className="text-sm text-slate-500">{selectedStudentData.grade}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-sm text-slate-600">Frequência Global</span>
                                    <span className={`font-bold ${selectedStudentData.attendance < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {selectedStudentData.attendance}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-sm text-slate-600">Faltas Totais</span>
                                    <span className="font-bold text-slate-800">
                                        {studentAbsences.length}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-sm text-slate-600">Justificadas</span>
                                    <span className="font-bold text-indigo-600">
                                        {studentAbsences.filter(a => a.justified).length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel: Absences List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-rose-500" />
                            Registro de Faltas
                        </h3>
                    </div>
                    
                    {!selectedStudentId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <ClipboardCheck size={64} className="mb-4 text-slate-200" />
                            <p className="font-medium">Selecione um aluno para gerenciar as faltas.</p>
                        </div>
                    ) : studentAbsences.length === 0 ? (
                         <div className="flex-1 flex flex-col items-center justify-center text-emerald-500">
                            <CheckCircle size={64} className="mb-4 opacity-50" />
                            <p className="font-medium text-lg">Frequência Impecável!</p>
                            <p className="text-sm text-emerald-600/70">Nenhuma falta registrada para este aluno.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {studentAbsences.map(absence => (
                                <div 
                                    key={absence.id} 
                                    className={`rounded-xl border transition-all ${
                                        selectedAbsenceId === absence.id 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-200' 
                                        : absence.justified 
                                            ? 'bg-emerald-50/30 border-emerald-100' 
                                            : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                                    }`}
                                >
                                    <div className="p-4 flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg flex-shrink-0 ${absence.justified ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                <Calendar size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                    {new Date(absence.date).toLocaleDateString('pt-BR')}
                                                    <span className="text-sm font-normal text-slate-500">({new Date(absence.date).toLocaleDateString('pt-BR', { weekday: 'long' })})</span>
                                                </h4>
                                                <p className="text-sm text-slate-600 font-medium">{absence.subject}</p>
                                                
                                                {absence.justified && (
                                                    <div className="mt-2 space-y-1">
                                                        <p className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                                                            <CheckCircle size={12} /> Justificativa Aceita
                                                        </p>
                                                        <p className="text-xs text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded border border-emerald-100 inline-block">
                                                            {absence.reason}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            {absence.justified ? (
                                                <button disabled className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold cursor-default opacity-70">
                                                    Regularizado
                                                </button>
                                            ) : (
                                                 selectedAbsenceId === absence.id ? (
                                                    <button 
                                                        onClick={() => setSelectedAbsenceId(null)}
                                                        className="px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50"
                                                    >
                                                        Cancelar
                                                    </button>
                                                 ) : (
                                                    <button 
                                                        onClick={() => { setSelectedAbsenceId(absence.id); setJustificationReason(''); setJustificationObservation(''); setAttachedFile(null); }}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200"
                                                    >
                                                        Justificar Falta
                                                    </button>
                                                 )
                                            )}
                                        </div>
                                    </div>

                                    {/* Justification Form Panel */}
                                    {selectedAbsenceId === absence.id && !absence.justified && (
                                        <div className="px-4 pb-4 pt-0 animate-fade-in">
                                            <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-inner">
                                                <h5 className="font-bold text-indigo-900 text-sm mb-3 flex items-center gap-2">
                                                    <ClipboardCheck size={16} /> Detalhes da Justificativa
                                                </h5>
                                                
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo / Tipo de Documento <span className="text-rose-500">*</span></label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Ex: Atestado Médico, Declaração de Comparecimento..."
                                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                            value={justificationReason}
                                                            onChange={(e) => setJustificationReason(e.target.value)}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Anexo Comprobatório</label>
                                                        <div 
                                                            onClick={handleFileUpload}
                                                            className={`border-2 border-dashed rounded-lg p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                                                                attachedFile 
                                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700' 
                                                                : 'border-slate-300 hover:bg-slate-50 text-slate-500'
                                                            }`}
                                                        >
                                                            {attachedFile ? (
                                                                <>
                                                                    <FileText size={18} />
                                                                    <span className="text-sm font-medium truncate">{attachedFile}</span>
                                                                    <button onClick={(e) => { e.stopPropagation(); setAttachedFile(null); }} className="p-1 hover:bg-emerald-200 rounded-full"><X size={14} /></button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Upload size={18} />
                                                                    <span className="text-sm">Clique para anexar documento (PDF/IMG)</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações Internas</label>
                                                        <textarea 
                                                            placeholder="Informações adicionais para a coordenação..."
                                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                                                            value={justificationObservation}
                                                            onChange={(e) => setJustificationObservation(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className="flex justify-end pt-2">
                                                        <button 
                                                            onClick={handleJustify}
                                                            disabled={!justificationReason}
                                                            className="bg-indigo-600 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Confirmar e Abonar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AbsenceJustification;