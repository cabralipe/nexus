import React, { useState } from 'react';
import { BookOpen, Calendar, Clock, Award, TrendingUp, HelpCircle, Send } from 'lucide-react';
import { StatCard } from './StatCard';
import { generateInsight } from '../services/geminiService';

const StudentDashboard: React.FC = () => {
    const [question, setQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAskAi = async () => {
        if (!question) return;
        setLoading(true);
        const prompt = `Act as a helpful tutor for a high school student. Explain this concept simply and briefly: "${question}". Use Markdown.`;
        const result = await generateInsight(prompt);
        setAiResponse(result);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Olá, Alice! 👋</h2>
                <p className="text-slate-500">Aqui está o resumo dos seus estudos hoje.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Média Geral" 
                    value="8.7" 
                    trend="+0.2" 
                    trendUp={true} 
                    icon={<Award size={24} />} 
                    color="bg-purple-500" 
                />
                <StatCard 
                    title="Frequência" 
                    value="95%" 
                    trend="Estável" 
                    trendUp={true} 
                    icon={<Clock size={24} />} 
                    color="bg-blue-500" 
                />
                <StatCard 
                    title="Próxima Mensalidade" 
                    value="Em Dia" 
                    icon={<TrendingUp size={24} />} 
                    color="bg-emerald-500" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Academic Schedule */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-indigo-600" />
                            Próximas Provas e Entregas
                        </h3>
                        <div className="space-y-3">
                            {[
                                { date: '20 Out', subject: 'Matemática', type: 'Prova Bimestral', status: 'Agendada' },
                                { date: '22 Out', subject: 'Geografia', type: 'Trabalho em Grupo', status: 'Pendente' },
                                { date: '25 Out', subject: 'Português', type: 'Redação', status: 'Pendente' },
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white border border-slate-200 rounded px-2 py-1 text-center min-w-[60px]">
                                            <div className="text-xs text-slate-500 uppercase">{item.date.split(' ')[1]}</div>
                                            <div className="text-lg font-bold text-slate-800">{item.date.split(' ')[0]}</div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800">{item.subject}</h4>
                                            <p className="text-xs text-slate-500">{item.type}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                                        item.status === 'Agendada' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Study Buddy */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-xl text-white shadow-lg">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                        <HelpCircle size={20} className="text-white/80" />
                        Tira-Dúvidas AI
                    </h3>
                    <p className="text-indigo-100 text-sm mb-4">Está travado em alguma matéria? Pergunte para o assistente!</p>
                    
                    <div className="space-y-3">
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ex: Explique a Fórmula de Bhaskara..."
                            className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-indigo-200 text-sm outline-none focus:bg-white/20 transition-colors"
                            rows={3}
                        />
                        <button 
                            onClick={handleAskAi}
                            disabled={loading || !question}
                            className="w-full bg-white text-indigo-700 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Pensando...' : 'Obter Ajuda'}
                            {!loading && <Send size={14} />}
                        </button>
                    </div>

                    {aiResponse && (
                        <div className="mt-4 bg-white/10 rounded-lg p-3 border border-white/10 text-sm text-indigo-50 markdown-content max-h-60 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{__html: aiResponse.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
