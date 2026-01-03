import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, BookOpen, Sparkles, Send, FileText } from 'lucide-react';
import { generateLessonPlan } from '../services/geminiService';
import { backend } from '../services/backendService';

const TeacherDashboard: React.FC = () => {
    const [lessonTopic, setLessonTopic] = useState('');
    const [generatedPlan, setGeneratedPlan] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [pendingDiary, setPendingDiary] = useState(0);
    const [loadingData, setLoadingData] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const loadDashboard = async () => {
            setLoadingData(true);
            setErrorMessage('');
            try {
                const data = await backend.fetchTeacherDashboard();
                setTodayClasses(data.today_schedule || []);
                setPendingDiary(data.counts?.pending_diary || 0);
            } catch (error) {
                console.error('Failed to load teacher dashboard', error);
                setErrorMessage('Nao foi possivel carregar o painel do professor.');
            } finally {
                setLoadingData(false);
            }
        };

        loadDashboard();
    }, []);

    const handleCreatePlan = async () => {
        if (!lessonTopic) return;
        setIsGenerating(true);
        const plan = await generateLessonPlan('História', lessonTopic, '50 minutos');
        setGeneratedPlan(plan);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Sala dos Professores</h2>
                    <p className="text-slate-500">Gerencie suas aulas e conteúdo pedagógico.</p>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Schedule Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-indigo-600" />
                            Aulas de Hoje
                        </h3>
                        <div className="space-y-4">
                            {loadingData ? (
                                <p className="text-sm text-slate-500">Carregando aulas...</p>
                            ) : todayClasses.length === 0 ? (
                                <p className="text-sm text-slate-500">Nenhuma aula registrada para hoje.</p>
                            ) : todayClasses.map((cls) => (
                                <div key={cls.id} className="flex items-start p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors">
                                    <div className="min-w-[100px] border-r border-slate-200 pr-4 mr-4">
                                        <div className="flex items-center text-slate-800 font-bold mb-1">
                                            <Clock size={16} className="mr-2 text-indigo-500" />
                                            {String(cls.time).split(' - ')[0]}
                                        </div>
                                        <div className="text-xs text-slate-500">{cls.room}</div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-slate-800">{cls.subject}</h4>
                                        <p className="text-sm text-slate-600 mt-1">Tópico: Aula do dia</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button className="px-3 py-1 bg-white border border-slate-300 text-slate-600 text-xs rounded hover:bg-slate-100">
                                            Chamada
                                        </button>
                                        <button className="px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700">
                                            Diário
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Tasks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <CheckCircle size={18} className="text-emerald-500" />
                                Correções Pendentes
                            </h3>
                            <ul className="space-y-2 text-sm text-slate-600 mt-3">
                                <li className="flex justify-between">
                                    <span>Diarios pendentes</span>
                                    <span className="font-bold text-rose-500">{pendingDiary}</span>
                                </li>
                                <li className="flex justify-between">
                                    <span>Atualizacao semanal</span>
                                    <span className="font-bold text-emerald-600">Em dia</span>
                                </li>
                            </ul>
                        </div>
                         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                                <FileText size={18} className="text-blue-500" />
                                Diários em Aberto
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">Você tem {pendingDiary} diários para finalizar o registro.</p>
                        </div>
                    </div>
                </div>

                {/* AI Planner Sidebar */}
                <div className="bg-gradient-to-b from-indigo-50 to-white p-6 rounded-xl shadow-sm border border-indigo-100 h-fit">
                    <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Sparkles size={20} className="text-indigo-600" />
                        Criador de Plano de Aula
                    </h3>
                    <p className="text-xs text-indigo-700 mb-4">Use IA para estruturar sua próxima aula em segundos.</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Tópico da Aula</label>
                            <input 
                                type="text" 
                                value={lessonTopic}
                                onChange={(e) => setLessonTopic(e.target.value)}
                                placeholder="Ex: Revolução Industrial..."
                                className="w-full p-2 text-sm border border-indigo-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleCreatePlan}
                            disabled={isGenerating || !lessonTopic}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? 'Criando...' : 'Gerar Plano'}
                            {!isGenerating && <Send size={14} />}
                        </button>
                    </div>

                    {generatedPlan && (
                        <div className="mt-6 border-t border-indigo-100 pt-4">
                            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-2">Resultado</h4>
                            <div className="bg-white p-3 rounded border border-indigo-100 text-xs text-slate-700 h-64 overflow-y-auto markdown-content">
                                <div dangerouslySetInnerHTML={{__html: generatedPlan.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}} />
                            </div>
                            <button className="w-full mt-3 text-xs text-indigo-600 font-medium hover:underline">
                                Salvar no Planejamento
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;
