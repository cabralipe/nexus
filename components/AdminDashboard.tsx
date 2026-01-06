import React, { useEffect, useMemo, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Users, AlertTriangle, TrendingUp, Sparkles, FileText, Printer, ArrowLeft, Sliders, Calculator, Save, Settings, CheckCircle } from 'lucide-react';
import { StatCard } from './StatCard';
import { DEFAULT_GRADING_CONFIG } from '../constants';
import { analyzeFinancialHealth, generateSchoolDocument } from '../services/geminiService';
import { GradingConfig } from '../types';
import { backend } from '../services/backendService';

const COLORS = ['#4F46E5', '#EF4444', '#10B981', '#F59E0B'];

type AdminDashboardProps = {
    initialView?: 'overview' | 'documents' | 'grading' | 'lessonPlans';
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialView = 'overview' }) => {
    const [viewMode, setViewMode] = useState<'overview' | 'documents' | 'grading' | 'lessonPlans'>(initialView);
    const [insight, setInsight] = useState<string>("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [financeData, setFinanceData] = useState<any[]>([]);
    const [enrollmentData, setEnrollmentData] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [dashboard, setDashboard] = useState<any | null>(null);

    // Document State
    const [selectedStudent, setSelectedStudent] = useState('');
    const [docType, setDocType] = useState('Declaração de Matrícula');
    const [docDetails, setDocDetails] = useState('');
    const [generatedDoc, setGeneratedDoc] = useState('');
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
    const [lessonPlans, setLessonPlans] = useState<any[]>([]);
    const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | null>(null);
    const [lessonPlanFeedback, setLessonPlanFeedback] = useState('');
    const [isUpdatingLessonPlan, setIsUpdatingLessonPlan] = useState(false);
    const [pendingLessonPlansCount, setPendingLessonPlansCount] = useState(0);
    const printRef = useRef<HTMLDivElement | null>(null);

    // Grading Config State
    const [gradingConfig, setGradingConfig] = useState<GradingConfig>(DEFAULT_GRADING_CONFIG);
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoadingData(true);
            setErrorMessage('');
            try {
                const [dashboardData, transactionsData, studentsData, gradingData, pendingPlans] = await Promise.all([
                    backend.fetchAdminDashboard(),
                    backend.fetchTransactions(),
                    backend.fetchStudents(),
                    backend.fetchGradingConfig().catch(() => null),
                    backend.fetchLessonPlans({ status: 'Pending' }).catch(() => []),
                ]);
                setDashboard(dashboardData);
                setFinanceData(dashboardData?.finance_series || []);
                setEnrollmentData(dashboardData?.enrollment_by_grade || []);
                setTransactions(transactionsData || []);
                setStudents(studentsData || []);
                setPendingLessonPlansCount(Array.isArray(pendingPlans) ? pendingPlans.length : 0);
                if (gradingData) {
                    setGradingConfig({
                        system: gradingData.system,
                        calculationMethod: gradingData.calculation_method || gradingData.calculationMethod,
                        minPassingGrade: Number(gradingData.min_passing_grade || gradingData.minPassingGrade || 6),
                        weights: gradingData.weights || { exam: 60, activities: 30, participation: 10 },
                        recoveryType: gradingData.recovery_type || DEFAULT_GRADING_CONFIG.recoveryType,
                        recoveryRule: gradingData.recovery_rule || gradingData.recoveryRule || '',
                    });
                }
            } catch (error) {
                console.error('Failed to load admin dashboard', error);
                setErrorMessage('Nao foi possivel carregar o painel.');
            } finally {
                setLoadingData(false);
            }
        };

        loadData();
    }, []);

    useEffect(() => {
        setViewMode(initialView);
    }, [initialView]);

    useEffect(() => {
        if (viewMode !== 'lessonPlans') return;
        const loadPlans = async () => {
            try {
                const data = await backend.fetchLessonPlans();
                setLessonPlans(data.map((item: any) => ({
                    ...item,
                    id: String(item.id),
                })));
                if (data.length && !selectedLessonPlanId) {
                    setSelectedLessonPlanId(String(data[0].id));
                }
            } catch (error) {
                console.error('Failed to load lesson plans', error);
            }
        };
        loadPlans();
    }, [viewMode]);

    useEffect(() => {
        if (!selectedLessonPlan) return;
        setLessonPlanFeedback(selectedLessonPlan.feedback || '');
    }, [selectedLessonPlanId, lessonPlans]);

    const stats = useMemo(() => {
        const income = Number(dashboard?.finance_month?.income || 0);
        const expense = Number(dashboard?.finance_month?.expense || 0);
        const net = income - expense;
        return {
            income,
            students: dashboard?.counts?.students || 0,
            delinquency: dashboard?.invoices?.delinquency_rate || 0,
            net,
        };
    }, [dashboard]);

    const selectedLessonPlan = lessonPlans.find((plan) => String(plan.id) === String(selectedLessonPlanId)) || null;

    const handleUpdateLessonPlanStatus = async (status: 'Approved' | 'Rejected') => {
        if (!selectedLessonPlanId) return;
        setIsUpdatingLessonPlan(true);
        try {
            const updated = await backend.updateLessonPlan(selectedLessonPlanId, {
                status,
                feedback: lessonPlanFeedback,
            });
            setLessonPlans((prev) => prev.map((plan) => String(plan.id) === String(updated.id) ? { ...updated, id: String(updated.id) } : plan));
            setLessonPlanFeedback('');
        } catch (error) {
            console.error('Failed to update lesson plan', error);
        } finally {
            setIsUpdatingLessonPlan(false);
        }
    };

    const handlePrintDoc = () => {
        if (!printRef.current) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const content = printRef.current.innerHTML;
        printWindow.document.open();
        printWindow.document.write(`
            <html>
                <head>
                    <title>Documento</title>
                    <style>
                        body { font-family: "Times New Roman", serif; color: #0f172a; padding: 24px; }
                        h2 { text-align: center; margin-bottom: 24px; }
                        .markdown-content { font-size: 14px; line-height: 1.6; }
                        .signature { margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
                        .signature-line { border-top: 1px solid #1e293b; width: 140px; margin: 0 auto; }
                        .signature-label { text-transform: uppercase; font-size: 11px; font-weight: bold; text-align: center; margin-top: 8px; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 250);
    };

    const handleGenerateInsight = async () => {
        setLoadingAi(true);
        const summary = JSON.stringify({
            transactions: transactions.slice(0, 3),
            totalStudents: dashboard?.counts?.students || 0,
            delinquencyRate: `${dashboard?.invoices?.delinquency_rate || 0}%`,
        });
        const result = await analyzeFinancialHealth(summary);
        setInsight(result);
        setLoadingAi(false);
    };

    const handleGenerateDoc = async () => {
        if (!selectedStudent) return;
        setIsGeneratingDoc(true);
        const result = await generateSchoolDocument(selectedStudent, docType, docDetails);
        setGeneratedDoc(result);
        setIsGeneratingDoc(false);
    };

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            await backend.updateGradingConfig({
                system: gradingConfig.system,
                calculation_method: gradingConfig.calculationMethod,
                min_passing_grade: gradingConfig.minPassingGrade,
                weights: gradingConfig.weights,
                recovery_type: gradingConfig.recoveryType,
                recovery_rule: gradingConfig.recoveryRule,
            });
        } catch (error) {
            console.error('Failed to save grading config', error);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleWeightChange = (key: keyof GradingConfig['weights'], value: number) => {
        setGradingConfig(prev => ({
            ...prev,
            weights: {
                ...prev.weights,
                [key]: value
            }
        }));
    };

    const totalWeight = gradingConfig.weights.exam + gradingConfig.weights.activities + gradingConfig.weights.participation;

    return (
        <div className="space-y-6">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">
                        {viewMode === 'overview' ? 'Visão Geral da Escola' :
                            viewMode === 'documents' ? 'Secretaria Digital' :
                                viewMode === 'lessonPlans' ? 'Planos de Aula' : 'Configuração de Notas'}
                    </h2>
                    <p className="text-slate-500">
                        {viewMode === 'overview' ? 'Bem-vindo ao painel administrativo.' :
                            viewMode === 'documents' ? 'Emissão e gestão de documentos oficiais.' :
                                viewMode === 'lessonPlans' ? 'Aprove ou solicite ajustes nos planos enviados pelos professores.' :
                                    'Definição de critérios de avaliação e pesos.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {viewMode !== 'overview' ? (
                        <button
                            onClick={() => setViewMode('overview')}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <ArrowLeft size={18} /> Voltar ao Painel
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleGenerateInsight}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
                            >
                                <Sparkles size={18} />
                                {loadingAi ? 'Analisando...' : 'IA Insights'}
                            </button>
                            <button
                                onClick={() => setViewMode('grading')}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <Settings size={18} />
                                Config. Notas
                            </button>
                            <button
                                onClick={() => setViewMode('lessonPlans')}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <CheckCircle size={18} />
                                Planos de Aula
                                {pendingLessonPlansCount > 0 && (
                                    <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                                        {pendingLessonPlansCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setViewMode('documents')}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <FileText size={18} />
                                Emitir Declaração
                            </button>
                        </>
                    )}
                </div>
            </div>

            {viewMode === 'overview' ? (
                <>
                    {/* AI Insight Box */}
                    {insight && (
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg animate-fade-in">
                            <h4 className="flex items-center gap-2 font-semibold text-indigo-800 mb-2">
                                <Sparkles size={16} /> Análise Inteligente
                            </h4>
                            <div className="prose prose-sm text-indigo-900 markdown-content">
                                <div dangerouslySetInnerHTML={{ __html: insight.replace(/\n/g, '<br/>') }} />
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Receita Mensal" value={`R$ ${stats.income.toLocaleString('pt-BR')}`} trend="Atual" trendUp={true} icon={<DollarSign size={24} />} color="bg-indigo-500" />
                        <StatCard title="Alunos Ativos" value={`${stats.students}`} trend="Atual" trendUp={true} icon={<Users size={24} />} color="bg-blue-500" />
                        <StatCard title="Inadimplência" value={`${stats.delinquency}%`} trend="Atual" trendUp={false} icon={<AlertTriangle size={24} />} color="bg-rose-500" />
                        <StatCard title="Lucro Líquido" value={`R$ ${stats.net.toLocaleString('pt-BR')}`} trend="Atual" trendUp={stats.net >= 0} icon={<TrendingUp size={24} />} color="bg-emerald-500" />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Fluxo de Caixa (Semestral)</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={financeData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Bar dataKey="income" name="Receitas" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Matrículas por Ciclo</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={enrollmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {enrollmentData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {enrollmentData.map((item, idx) => (
                                        <div key={item.name} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                <span className="text-slate-600">{item.name}</span>
                                            </div>
                                            <span className="font-medium text-slate-800">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions List */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Transações Recentes</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 text-slate-500">
                                        <th className="pb-3 font-medium">Descrição</th>
                                        <th className="pb-3 font-medium">Categoria</th>
                                        <th className="pb-3 font-medium">Data</th>
                                        <th className="pb-3 font-medium text-right">Valor</th>
                                        <th className="pb-3 font-medium text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((t) => (
                                        <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 text-slate-800 font-medium">{t.description}</td>
                                            <td className="py-3 text-slate-500">{t.category}</td>
                                            <td className="py-3 text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                                            <td className={`py-3 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR')}
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Realizado</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : viewMode === 'grading' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                    {/* General Settings */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Sliders size={20} className="text-indigo-600" />
                            Parâmetros Gerais do Bimestre
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sistema de Avaliação</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${gradingConfig.system === 'bimestral' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500' : 'hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="system"
                                            className="sr-only"
                                            checked={gradingConfig.system === 'bimestral'}
                                            onChange={() => setGradingConfig({ ...gradingConfig, system: 'bimestral' })}
                                        />
                                        <div className="font-semibold text-slate-800">Bimestral</div>
                                        <div className="text-xs text-slate-500">4 etapas anuais</div>
                                    </label>
                                    <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors ${gradingConfig.system === 'trimestral' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500' : 'hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="system"
                                            className="sr-only"
                                            checked={gradingConfig.system === 'trimestral'}
                                            onChange={() => setGradingConfig({ ...gradingConfig, system: 'trimestral' })}
                                        />
                                        <div className="font-semibold text-slate-800">Trimestral</div>
                                        <div className="text-xs text-slate-500">3 etapas anuais</div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Média Mínima para Aprovação</label>
                                <div className="relative max-w-[120px]">
                                    <input
                                        type="number"
                                        value={gradingConfig.minPassingGrade}
                                        onChange={(e) => setGradingConfig({ ...gradingConfig, minPassingGrade: Number(e.target.value) })}
                                        step="0.5" max="10" min="0"
                                        className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-center"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">pts</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Método de Cálculo Final</label>
                                <select
                                    value={gradingConfig.calculationMethod}
                                    onChange={(e) => setGradingConfig({ ...gradingConfig, calculationMethod: e.target.value as any })}
                                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="arithmetic">Média Aritmética (Soma / N)</option>
                                    <option value="weighted">Média Ponderada (Pesos)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-2">
                                    Defina se a nota final do bimestre será uma média simples de todas as avaliações ou se haverá pesos específicos por tipo de atividade.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Recuperação</label>
                                <select
                                    value={gradingConfig.recoveryType}
                                    onChange={(e) => setGradingConfig({ ...gradingConfig, recoveryType: e.target.value as GradingConfig['recoveryType'] })}
                                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="none">Sem recuperação</option>
                                    <option value="grade">Recuperação por nota</option>
                                    <option value="exam">Recuperação por prova</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-2">
                                    Defina se a recuperação será aplicada como nota ou como prova extra.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Aplicação da Recuperação</label>
                                <select
                                    value={gradingConfig.recoveryRule}
                                    onChange={(e) => setGradingConfig({ ...gradingConfig, recoveryRule: e.target.value })}
                                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    disabled={gradingConfig.recoveryType === 'none'}
                                >
                                    <option value="replace">Substitui a menor nota do período</option>
                                    <option value="average">Faz média com a nota original</option>
                                    <option value="max">Prevalece a maior nota entre as duas</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Weights Configuration */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calculator size={20} className="text-indigo-600" />
                            Composição da Nota (Pesos)
                        </h3>

                        {gradingConfig.calculationMethod === 'arithmetic' ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                                <Calculator size={48} className="mb-3 opacity-20" />
                                <p className="font-medium">Média Aritmética Selecionada</p>
                                <p className="text-xs max-w-xs text-center mt-2">Neste modo, todas as atividades possuem o mesmo valor no cálculo final.</p>
                                <button
                                    onClick={() => setGradingConfig({ ...gradingConfig, calculationMethod: 'weighted' })}
                                    className="mt-4 text-indigo-600 text-sm font-medium hover:underline"
                                >
                                    Mudar para Ponderada
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 flex-1">
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <p className="text-sm text-indigo-900 mb-3 font-medium">Distribua o peso percentual para cada componente da nota:</p>

                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-700 font-medium">Provas e Avaliações</span>
                                                <span className="font-bold text-indigo-700">{gradingConfig.weights.exam}%</span>
                                            </div>
                                            <input
                                                type="range" className="w-full accent-indigo-600 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                min="0" max="100"
                                                value={gradingConfig.weights.exam}
                                                onChange={(e) => handleWeightChange('exam', Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-700 font-medium">Trabalhos e Atividades</span>
                                                <span className="font-bold text-indigo-700">{gradingConfig.weights.activities}%</span>
                                            </div>
                                            <input
                                                type="range" className="w-full accent-indigo-600 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                min="0" max="100"
                                                value={gradingConfig.weights.activities}
                                                onChange={(e) => handleWeightChange('activities', Number(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-700 font-medium">Participação em Aula</span>
                                                <span className="font-bold text-indigo-700">{gradingConfig.weights.participation}%</span>
                                            </div>
                                            <input
                                                type="range" className="w-full accent-indigo-600 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                                                min="0" max="100"
                                                value={gradingConfig.weights.participation}
                                                onChange={(e) => handleWeightChange('participation', Number(e.target.value))}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-indigo-200 flex justify-between items-center">
                                        <span className="text-sm font-bold text-indigo-900 uppercase">Total Acumulado</span>
                                        <div className={`flex items-center gap-2 text-lg font-bold ${totalWeight === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {totalWeight === 100 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                            {totalWeight}%
                                        </div>
                                    </div>
                                    {totalWeight !== 100 && (
                                        <p className="text-xs text-rose-600 font-medium text-right mt-1">
                                            A soma dos pesos deve ser exatamente 100%.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <button
                                onClick={handleSaveConfig}
                                disabled={totalWeight !== 100 && gradingConfig.calculationMethod === 'weighted'}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingConfig ? (
                                    <span>Salvando...</span>
                                ) : (
                                    <>
                                        <Save size={18} /> Salvar Configuração de Notas
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : viewMode === 'lessonPlans' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-bold text-slate-800">Planos Enviados</h3>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
                            {lessonPlans.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => {
                                        setSelectedLessonPlanId(String(plan.id));
                                        setLessonPlanFeedback(plan.feedback || '');
                                    }}
                                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${String(plan.id) === String(selectedLessonPlanId) ? 'bg-indigo-50' : ''}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <div className="font-semibold text-slate-800 text-sm">{plan.topic || plan.subject}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                {plan.teacher_name || 'Professor'} • {plan.classroom_name || 'Turma'}
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
                                <div className="p-6 text-sm text-slate-400 text-center">Nenhum plano enviado.</div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        {selectedLessonPlan ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800">{selectedLessonPlan.topic}</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {selectedLessonPlan.teacher_name || 'Professor'} • {selectedLessonPlan.classroom_name || 'Turma'} • {new Date(selectedLessonPlan.date).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${selectedLessonPlan.status === 'Approved'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : selectedLessonPlan.status === 'Rejected'
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {selectedLessonPlan.status === 'Approved' ? 'Aprovado' : selectedLessonPlan.status === 'Rejected' ? 'Reprovado' : 'Pendente'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                                    <div><span className="font-semibold text-slate-700">Disciplina:</span> {selectedLessonPlan.subject}</div>
                                    <div><span className="font-semibold text-slate-700">Série/Turma:</span> {selectedLessonPlan.grade_level || '—'}</div>
                                    <div><span className="font-semibold text-slate-700">Duração:</span> {selectedLessonPlan.duration || '—'}</div>
                                </div>

                                <div className="space-y-4 text-sm text-slate-700">
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Objetivos</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.objectives || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Conteúdo Programático</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.content_program || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Metodologia</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.methodology || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Recursos Didáticos</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.resources || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Atividades</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.activities || '—'}</div>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 mb-2">Avaliação</h4>
                                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-line">{selectedLessonPlan.assessment || '—'}</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-slate-700">Parecer</label>
                                    <textarea
                                        className="w-full border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                        value={lessonPlanFeedback}
                                        onChange={(e) => setLessonPlanFeedback(e.target.value)}
                                        placeholder="Oriente ajustes ou aprove."
                                    />
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => handleUpdateLessonPlanStatus('Approved')}
                                        disabled={isUpdatingLessonPlan}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-70"
                                    >
                                        Aprovar
                                    </button>
                                    <button
                                        onClick={() => handleUpdateLessonPlanStatus('Rejected')}
                                        disabled={isUpdatingLessonPlan}
                                        className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-70"
                                    >
                                        Reprovar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 py-12">
                                <FileText size={48} className="mx-auto mb-3 opacity-30" />
                                <p>Selecione um plano para revisar.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
                    {/* Document Controls */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <FileText size={20} className="text-indigo-600" />
                                Dados do Documento
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Selecione o Aluno</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        value={selectedStudent}
                                        onChange={(e) => setSelectedStudent(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {students.map((s: any) => (
                                            <option key={s.id} value={`${s.first_name} ${s.last_name}`.trim()}>
                                                {`${s.first_name} ${s.last_name}`.trim()} - {s.grade || s.gradeLevel || '—'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Documento</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        value={docType}
                                        onChange={(e) => setDocType(e.target.value)}
                                    >
                                        <option value="Declaração de Matrícula">Declaração de Matrícula</option>
                                        <option value="Histórico Escolar Parcial">Histórico Escolar Parcial</option>
                                        <option value="Atestado de Frequência">Atestado de Frequência</option>
                                        <option value="Carta de Transferência">Carta de Transferência</option>
                                        <option value="Declaração de Quitação (Financeiro)">Declaração de Quitação</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Observações ou Finalidade</label>
                                    <textarea
                                        className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                        placeholder="Ex: Para fins de comprovação junto ao convênio médico..."
                                        value={docDetails}
                                        onChange={(e) => setDocDetails(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleGenerateDoc}
                                    disabled={!selectedStudent || isGeneratingDoc}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isGeneratingDoc ? (
                                        <>
                                            <Sparkles size={18} className="animate-spin" /> Elaborando...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={18} /> Gerar Documento (IA)
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                            <h4 className="font-semibold text-indigo-900 text-sm mb-2">Dica Profissional</h4>
                            <p className="text-xs text-indigo-800">
                                O sistema utiliza inteligência artificial para redigir o texto com linguagem formal e jurídica adequada. Revise sempre antes de imprimir e assinar.
                            </p>
                        </div>
                    </div>

                    {/* Document Preview */}
                    <div className="lg:col-span-3 bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-100 min-h-[400px] md:min-h-[600px] flex flex-col">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-slate-100 gap-4 sm:gap-0">
                            <h3 className="font-bold text-slate-800">Visualização</h3>
                            {generatedDoc && (
                                <button
                                    onClick={handlePrintDoc}
                                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium w-full sm:w-auto justify-center sm:justify-start"
                                >
                                    <Printer size={16} /> Imprimir / Salvar PDF
                                </button>
                            )}
                        </div>

                        {generatedDoc ? (
                            <div className="flex-1 bg-white" ref={printRef}>
                                {/* Mock Paper Effect */}
                                <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed markdown-content font-serif">
                                    <div dangerouslySetInnerHTML={{ __html: generatedDoc.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/#(.*?)<br\/>/g, '<h2 class="text-xl font-bold text-center mb-6">$1</h2>') }} />
                                </div>

                                <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-8 signature">
                                    <div className="text-center">
                                        <div className="h-16 mb-2"></div>
                                        <div className="border-t border-slate-800 w-32 mx-auto signature-line"></div>
                                        <p className="text-xs font-bold uppercase mt-2 signature-label">Secretaria Escolar</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="h-16 mb-2"></div>
                                        <div className="border-t border-slate-800 w-32 mx-auto signature-line"></div>
                                        <p className="text-xs font-bold uppercase mt-2 signature-label">Diretoria</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <FileText size={64} className="mb-4 text-slate-200" />
                                <p>Preencha os dados e clique em "Gerar" para visualizar o documento.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
