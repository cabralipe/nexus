import React, { useEffect, useState } from 'react';
import { Calendar, FileText, Upload, CheckCircle, AlertCircle, MessageSquare, Clock, X } from 'lucide-react';
import { AcademicTarget, ExamSubmission } from '../types';
import { backend } from '../services/backendService';

const PedagogicalCoordination: React.FC = () => {
    // State for Calendar Targets
    const [targets, setTargets] = useState<AcademicTarget[]>([]);
    const [newTarget, setNewTarget] = useState({ month: '', requiredClasses: 0, gradeSubmissionDeadline: '', examSubmissionDeadline: '' });
    
    // State for Exams
    const [exams, setExams] = useState<ExamSubmission[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
    const [feedbackText, setFeedbackText] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [examFile, setExamFile] = useState<File | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    
    // Mock upload state
    const [uploadData, setUploadData] = useState({ title: '', subject: '', type: 'Standard', studentName: '' });
    const isTeacher = currentUserRole === 'teacher';

    // Handlers
    const handleAddTarget = async () => {
        if (!newTarget.month) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const created = await backend.createAcademicTarget({
                month: newTarget.month,
                requiredClasses: newTarget.requiredClasses,
                gradeSubmissionDeadline: newTarget.gradeSubmissionDeadline,
                examSubmissionDeadline: newTarget.examSubmissionDeadline,
            });
            setTargets(prev => [{ ...created, id: String(created.id) }, ...prev]);
            setNewTarget({ month: '', requiredClasses: 0, gradeSubmissionDeadline: '', examSubmissionDeadline: '' });
        } catch (error) {
            console.error('Failed to create target', error);
            setErrorMessage('Nao foi possivel salvar a meta.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (status: 'Approved' | 'ChangesRequested') => {
        if (!selectedExamId) return;
        setLoading(true);
        setErrorMessage('');
        try {
            const updated = await backend.updateExamSubmission(selectedExamId, {
                status,
                feedback: feedbackText,
            });
            setExams(prev => prev.map(exam => exam.id === selectedExamId ? { ...updated, id: String(updated.id) } : exam));
            setSelectedExamId(null);
            setFeedbackText('');
        } catch (error) {
            console.error('Failed to update exam submission', error);
            setErrorMessage('Nao foi possivel atualizar a prova.');
        } finally {
            setLoading(false);
        }
    };

    const handleSimulateUpload = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const created = await backend.createExamSubmission({
                title: uploadData.title || 'Nova Prova',
                subject: uploadData.subject || 'Geral',
                gradeLevel: '9º Ano',
                type: uploadData.type,
                status: 'Pending',
                studentName: uploadData.type === 'Adapted' ? uploadData.studentName : '',
            });
            if (examFile) {
                const formData = new FormData();
                formData.append('entity_type', 'exam');
                formData.append('entity_id', String(created.id));
                formData.append('file', examFile);
                await backend.uploadFile(formData);
            }
            setExams(prev => [{ ...created, id: String(created.id) }, ...prev]);
            setShowUploadModal(false);
            setUploadData({ title: '', subject: '', type: 'Standard', studentName: '' });
            setExamFile(null);
        } catch (error) {
            console.error('Failed to create exam submission', error);
            setErrorMessage('Nao foi possivel enviar a prova.');
        } finally {
            setLoading(false);
        }
    };

    const selectedExam = exams.find(e => e.id === selectedExamId);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setErrorMessage('');
            try {
                const me = await backend.fetchMe();
                const normalizedRole = String(me.role || '').toLowerCase() || null;
                setCurrentUserRole(normalizedRole);
                if (normalizedRole === 'teacher') {
                    const examsData = await backend.fetchExamSubmissions();
                    setTargets([]);
                    setExams(examsData.map((item: any) => ({ ...item, id: String(item.id) })));
                } else {
                    const [targetsData, examsData] = await Promise.all([
                        backend.fetchAcademicTargets(),
                        backend.fetchExamSubmissions(),
                    ]);
                    setTargets(targetsData.map((item: any) => ({ ...item, id: String(item.id) })));
                    setExams(examsData.map((item: any) => ({ ...item, id: String(item.id) })));
                }
            } catch (error) {
                console.error('Failed to load coordination data', error);
                setErrorMessage('Nao foi possivel carregar os dados da coordenacao.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                        {isTeacher ? 'Envio de Provas' : 'Coordenação Pedagógica'}
                    </h2>
                    <p className="text-slate-500">
                        {isTeacher
                            ? 'Envie provas para análise e acompanhe o status.'
                            : 'Gestão de calendário acadêmico e aprovação de avaliações.'}
                    </p>
                </div>
                <button 
                    onClick={() => {
                        setShowUploadModal(true);
                        setExamFile(null);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Upload size={18} />
                    {isTeacher ? 'Enviar Prova' : 'Enviar Prova (Professor)'}
                </button>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}

            {!isTeacher && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Calendar size={20} className="text-indigo-600" />
                    Metas Mensais e Prazos
                </h3>
                
                {/* Add Target Form */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Mês de Referência</label>
                        <input 
                            type="text" placeholder="Ex: Dezembro 2023"
                            className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-indigo-500"
                            value={newTarget.month} onChange={e => setNewTarget({...newTarget, month: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Aulas Obrigatórias</label>
                        <input 
                            type="number" 
                            className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-indigo-500"
                            value={newTarget.requiredClasses || ''} onChange={e => setNewTarget({...newTarget, requiredClasses: Number(e.target.value)})}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Prazo Notas</label>
                        <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-indigo-500"
                            value={newTarget.gradeSubmissionDeadline} onChange={e => setNewTarget({...newTarget, gradeSubmissionDeadline: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Prazo Provas</label>
                        <input 
                            type="date" 
                            className="w-full border border-slate-300 rounded p-2 text-sm outline-none focus:border-indigo-500"
                            value={newTarget.examSubmissionDeadline} onChange={e => setNewTarget({...newTarget, examSubmissionDeadline: e.target.value})}
                        />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                        <button 
                            onClick={handleAddTarget}
                            className="w-full bg-slate-800 text-white p-2 rounded text-sm font-medium hover:bg-slate-900"
                            disabled={loading}
                        >
                            Definir Metas
                        </button>
                    </div>
                </div>

                {/* Targets List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                            <tr>
                                <th className="px-6 py-3 font-medium">Mês</th>
                                <th className="px-6 py-3 font-medium text-center">Meta de Aulas</th>
                                <th className="px-6 py-3 font-medium text-center">Prazo Provas</th>
                                <th className="px-6 py-3 font-medium text-center">Prazo Notas</th>
                                <th className="px-6 py-3 font-medium text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {targets.map(target => (
                                <tr key={target.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-bold text-slate-800">{target.month}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">{target.requiredClasses}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-slate-600">{new Date(target.examSubmissionDeadline).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-center text-slate-600">{new Date(target.gradeSubmissionDeadline).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Ativo</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* Section 2: Exam Approval Workflow */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Exam List */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <FileText size={20} className="text-indigo-600" />
                            {isTeacher ? 'Minhas Avaliações' : 'Banco de Avaliações'}
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {exams.map(exam => (
                            <div key={exam.id} className="p-4 hover:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${exam.type === 'Adapted' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800">{exam.title}</h4>
                                                {exam.type === 'Adapted' && (
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold border border-purple-200">
                                                        Adaptada
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                {exam.subject} • {exam.gradeLevel} • Prof. {exam.teacherName}
                                            </p>
                                            {exam.studentName && (
                                                <p className="text-xs text-purple-600 font-medium mt-1">Aluno: {exam.studentName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                                            exam.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                            exam.status === 'ChangesRequested' ? 'bg-rose-100 text-rose-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {exam.status === 'Approved' ? <CheckCircle size={12} /> : 
                                             exam.status === 'ChangesRequested' ? <AlertCircle size={12} /> : 
                                             <Clock size={12} />}
                                            {exam.status === 'Approved' ? 'Aprovado' : 
                                             exam.status === 'ChangesRequested' ? 'Revisão Solicitada' : 
                                             'Pendente'}
                                        </span>
                                        <button 
                                            onClick={() => setSelectedExamId(exam.id)}
                                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium underline"
                                        >
                                            {isTeacher ? 'Ver status' : 'Analisar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Review Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <MessageSquare size={20} className="text-indigo-600" />
                        {isTeacher ? 'Status da Avaliação' : 'Parecer da Direção'}
                    </h3>
                    
                    {!selectedExam ? (
                        <div className="text-center py-12 text-slate-400">
                            <FileText size={48} className="mx-auto mb-3 opacity-20" />
                            <p className="text-sm">
                                {isTeacher
                                    ? 'Selecione uma prova para visualizar o status.'
                                    : 'Selecione uma prova para visualizar e emitir parecer.'}
                            </p>
                        </div>
                    ) : (
                        <div className="animate-fade-in space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                                <div className="font-bold text-slate-700 mb-1">{selectedExam.title}</div>
                                <div className="text-slate-500 mb-2">Enviado em: {new Date(selectedExam.submittedDate).toLocaleDateString('pt-BR')}</div>
                                {selectedExam.attachments && selectedExam.attachments.length === 0 && (
                                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                                        <FileText size={16} />
                                        <span>Nenhum anexo enviado.</span>
                                    </div>
                                )}
                                {selectedExam.attachments && selectedExam.attachments.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {selectedExam.attachments.map((attachment: any) => (
                                            <a
                                                key={attachment.id}
                                                href={attachment.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 text-indigo-600 hover:underline text-xs"
                                            >
                                                <FileText size={14} />
                                                {attachment.original_name || 'Arquivo'}
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {selectedExam.feedback && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Último Parecer:</span>
                                        <p className="text-slate-700 italic mt-1">"{selectedExam.feedback}"</p>
                                    </div>
                                )}
                            </div>

                            {!isTeacher && (
                                <>
                                    <textarea 
                                        className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        placeholder="Digite seu parecer pedagógico aqui..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => handleUpdateStatus('ChangesRequested')}
                                            disabled={!feedbackText}
                                            className="bg-rose-100 text-rose-700 py-2 rounded-lg text-sm font-medium hover:bg-rose-200 disabled:opacity-50"
                                        >
                                            Solicitar Ajustes
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateStatus('Approved')}
                                            className="bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
                                        >
                                            Aprovar Prova
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal (Simulation for Teacher interaction) */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800">Enviar Nova Prova</h3>
                            <button
                                onClick={() => {
                                    setShowUploadModal(false);
                                    setExamFile(null);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Título</label>
                                <input type="text" className="w-full border rounded p-2" value={uploadData.title} onChange={e => setUploadData({...uploadData, title: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Disciplina</label>
                                <input type="text" className="w-full border rounded p-2" value={uploadData.subject} onChange={e => setUploadData({...uploadData, subject: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700">Tipo de Avaliação</label>
                                <select className="w-full border rounded p-2 bg-white" value={uploadData.type} onChange={e => setUploadData({...uploadData, type: e.target.value})}>
                                    <option value="Standard">Padrão</option>
                                    <option value="Adapted">Adaptada (Inclusão)</option>
                                </select>
                            </div>
                            {uploadData.type === 'Adapted' && (
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Nome do Aluno</label>
                                    <input type="text" className="w-full border rounded p-2" placeholder="Para qual aluno?" value={uploadData.studentName} onChange={e => setUploadData({...uploadData, studentName: e.target.value})} />
                                </div>
                            )}
                            <label className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center text-slate-500 text-sm cursor-pointer hover:bg-slate-50 block">
                                <Upload size={24} className="mx-auto mb-2" />
                                <span>{examFile ? examFile.name : 'Clique para selecionar o arquivo PDF/DOCX'}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                                />
                            </label>
                            <button
                                onClick={handleSimulateUpload}
                                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium"
                                disabled={loading}
                            >
                                Enviar para Análise
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PedagogicalCoordination;
