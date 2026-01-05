import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, FileText, Send, Check, TrendingDown, TrendingUp, Plus, Calendar, Download } from 'lucide-react';
import { generateInsight } from '../services/geminiService';
import { exportToCSV } from '../utils';
import { backend } from '../services/backendService';

type Tab = 'receivables' | 'payables';

const FinancialModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('receivables');
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [cashflow, setCashflow] = useState<{ summary: any; monthly: any[] } | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [students, setStudents] = useState<any[]>([]);

    // Expenses State
    const [invoices, setInvoices] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [incomes, setIncomes] = useState<any[]>([]);
    const [newIncome, setNewIncome] = useState({
        description: '',
        category: '',
        amount: '',
        date: '',
        studentId: '',
        discountType: 'none',
        discountValue: '',
    });
    const [isAddingIncome, setIsAddingIncome] = useState(false);
    const [newExpense, setNewExpense] = useState({ description: '', category: '', amount: '', date: '' });
    const [isAddingExpense, setIsAddingExpense] = useState(false);

    useEffect(() => {
        const loadFinancial = async () => {
            try {
                const [invoiceData, studentsData, expenseData, incomeData, cashflowData] = await Promise.all([
                    backend.fetchInvoices(),
                    backend.fetchStudents(),
                    backend.fetchTransactions({ type: 'expense' }),
                    backend.fetchTransactions({ type: 'income' }),
                    backend.fetchCashflow(),
                ]);
                const studentMap = new Map(
                    studentsData.map((student: any) => [
                        String(student.id),
                        [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
                    ])
                );
                setStudents(
                    studentsData.map((student: any) => ({
                        id: String(student.id),
                        name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.name,
                    }))
                );
                setInvoices(
                    invoiceData.map((inv: any) => ({
                        id: String(inv.id),
                        studentName: studentMap.get(String(inv.student_id)) || 'Aluno',
                        amount: Number(inv.amount),
                        dueDate: inv.due_date,
                        status: inv.status === 'paid' ? 'Paid' : inv.status === 'overdue' ? 'Overdue' : 'Pending',
                    }))
                );
                setExpenses(
                    expenseData.map((tx: any) => ({
                        id: String(tx.id),
                        description: tx.description,
                        category: tx.category,
                        amount: Number(tx.amount),
                        type: 'expense' as const,
                        date: tx.date,
                    }))
                );
                setIncomes(
                    incomeData.map((tx: any) => ({
                        id: String(tx.id),
                        description: tx.description,
                        category: tx.category,
                        amount: Number(tx.amount),
                        type: 'income' as const,
                        date: tx.date,
                    }))
                );
                setCashflow(cashflowData);
            } catch (error) {
                console.error("Failed to load financial data", error);
                setErrorMessage('Nao foi possivel carregar o financeiro.');
            }
        };

        loadFinancial();
    }, []);

    const handleGenerateMessage = async (studentName: string) => {
        setIsGenerating(true);
        const prompt = `Write a polite but firm WhatsApp message to the parents of ${studentName} reminding them that the school tuition of R$ 1200 is overdue. Be professional.`;
        const result = await generateInsight(prompt);
        setMessageDraft(result);
        setIsGenerating(false);
        setSelectedInvoice(studentName);
    };

    const handleAddExpense = async () => {
        if(!newExpense.description || !newExpense.amount) return;
        const expense = {
            id: Math.random().toString(),
            description: newExpense.description,
            category: newExpense.category || 'Geral',
            amount: parseFloat(newExpense.amount),
            type: 'expense' as const,
            date: newExpense.date || new Date().toISOString().split('T')[0]
        };
        try {
            const created = await backend.createTransaction({
                description: expense.description,
                category: expense.category,
                amount: expense.amount,
                type: 'expense',
                status: 'open',
                date: expense.date,
            });
            setExpenses([{ ...expense, id: String(created.id) }, ...expenses]);
            setIsAddingExpense(false);
            setNewExpense({ description: '', category: '', amount: '', date: '' });
        } catch (error) {
            console.error("Failed to add expense", error);
        }
    };

    const handleAddIncome = async () => {
        setErrorMessage('');
        const isTuition = newIncome.category === 'Tuition';
        if (isTuition && !newIncome.studentId) {
            setErrorMessage('Selecione o aluno da mensalidade.');
            return;
        }
        if (!newIncome.amount) {
            setErrorMessage('Preencha o valor.');
            return;
        }
        if (!isTuition && !newIncome.description) {
            setErrorMessage('Preencha a descricao.');
            return;
        }
        const rawAmount = parseFloat(newIncome.amount);
        if (Number.isNaN(rawAmount)) {
            setErrorMessage('Valor invalido.');
            return;
        }
        const discountRaw = parseFloat(newIncome.discountValue || '0');
        const discountValue = Number.isNaN(discountRaw) ? 0 : discountRaw;
        const discountAmount = newIncome.discountType === 'percent'
            ? rawAmount * (Math.min(discountValue, 100) / 100)
            : newIncome.discountType === 'amount'
                ? Math.min(discountValue, rawAmount)
                : 0;
        const netAmount = Math.max(0, rawAmount - discountAmount);
        const studentLabel = isTuition
            ? students.find((student: any) => String(student.id) === String(newIncome.studentId))?.name
            : '';
        const discountLabel = newIncome.discountType === 'percent'
            ? `${discountValue}%`
            : newIncome.discountType === 'amount'
                ? `R$ ${discountValue.toFixed(2)}`
                : '';
        const finalDescription = isTuition
            ? `Mensalidade - ${studentLabel || 'Aluno'}${discountLabel ? ` (Desconto ${discountLabel})` : ''}`
            : newIncome.description;
        const income = {
            id: Math.random().toString(),
            description: finalDescription,
            category: newIncome.category || 'Geral',
            amount: netAmount,
            grossAmount: rawAmount,
            discountType: newIncome.discountType,
            discountValue: discountValue,
            studentId: isTuition ? newIncome.studentId : '',
            type: 'income' as const,
            date: newIncome.date || new Date().toISOString().split('T')[0]
        };
        try {
            const created = await backend.createTransaction({
                description: income.description,
                category: income.category,
                amount: income.amount,
                gross_amount: income.grossAmount,
                discount_type: income.discountType,
                discount_value: income.discountValue,
                student_id: income.studentId || undefined,
                type: 'income',
                status: 'paid',
                date: income.date,
            });
            setIncomes([{ ...income, id: String(created.id) }, ...incomes]);
            setIsAddingIncome(false);
            setNewIncome({
                description: '',
                category: '',
                amount: '',
                date: '',
                studentId: '',
                discountType: 'none',
                discountValue: '',
            });
        } catch (error) {
            console.error("Failed to add income", error);
            setErrorMessage('Nao foi possivel salvar a receita.');
        }
    };

    const handleExportFinancial = () => {
        if (activeTab === 'receivables') {
            exportToCSV(invoices, 'Relatorio_Mensalidades');
        } else {
            exportToCSV(expenses, 'Relatorio_Despesas');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
                    <p className="text-slate-500">Gestão de fluxo de caixa, mensalidades e despesas.</p>
                </div>
                <div className="flex gap-4">
                     <button 
                        onClick={handleExportFinancial}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium"
                    >
                        <Download size={16} /> Exportar Relatório
                    </button>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('receivables')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'receivables' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <TrendingUp size={16} /> Receitas (Mensalidades)
                        </button>
                        <button 
                            onClick={() => setActiveTab('payables')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'payables' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <TrendingDown size={16} /> Despesas (Contas a Pagar)
                        </button>
                    </div>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}

            {activeTab === 'receivables' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    {/* Invoices List */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Mensalidades Recentes</h3>
                            <button className="text-indigo-600 text-sm font-medium hover:underline">Ver Todas</button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Aluno</th>
                                    <th className="px-6 py-3 font-medium">Vencimento</th>
                                    <th className="px-6 py-3 font-medium text-right">Valor</th>
                                    <th className="px-6 py-3 font-medium text-center">Status</th>
                                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800">{inv.studentName}</td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-right">R$ {inv.amount.toLocaleString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                                inv.status === 'Overdue' ? 'bg-rose-100 text-rose-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {inv.status === 'Paid' ? 'Pago' : inv.status === 'Overdue' ? 'Atrasado' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {inv.status === 'Overdue' && (
                                                <button 
                                                    onClick={() => handleGenerateMessage(inv.studentName)}
                                                    className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                                                >
                                                    Cobrar
                                                </button>
                                            )}
                                            {inv.status === 'Paid' && (
                                                <span className="text-emerald-600 text-xs font-medium flex items-center justify-end gap-1">
                                                    <Check size={14} /> Baixado
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Collection Action Panel */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800">Receitas Avulsas</h3>
                                <button
                                    onClick={() => setIsAddingIncome(true)}
                                    className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700"
                                >
                                    <Plus size={16} /> Nova Receita
                                </button>
                            </div>
                            <div className="space-y-3">
                                {incomes.length === 0 ? (
                                    <p className="text-sm text-slate-500">Nenhuma receita registrada.</p>
                                ) : (
                                    incomes.slice(0, 5).map((income) => (
                                        <div key={income.id} className="flex justify-between items-center border border-slate-100 rounded-lg p-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">{income.description}</p>
                                                <p className="text-xs text-slate-400">{new Date(income.date).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-600">
                                                + R$ {income.amount.toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {isAddingIncome && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                                <h3 className="font-bold text-slate-800 mb-4">Registrar Receita</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">Descrição</label>
                                        <input
                                            type="text" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                            value={newIncome.description} onChange={e => setNewIncome({...newIncome, description: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">Categoria</label>
                                        <select
                                            className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                            value={newIncome.category} onChange={e => setNewIncome({...newIncome, category: e.target.value})}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Tuition">Mensalidade</option>
                                            <option value="Services">Serviços</option>
                                            <option value="Donations">Doações</option>
                                            <option value="Other">Outros</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600">Valor (R$)</label>
                                            <input
                                                type="number" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                value={newIncome.amount} onChange={e => setNewIncome({...newIncome, amount: e.target.value})}
                                            />
                                        </div>
                                        {newIncome.category === 'Tuition' ? (
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600">Aluno</label>
                                                <select
                                                    className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={newIncome.studentId} onChange={e => setNewIncome({...newIncome, studentId: e.target.value})}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {students.map((student: any) => (
                                                        <option key={student.id} value={student.id}>
                                                            {student.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="hidden lg:block"></div>
                                        )}
                                    </div>
                                    {newIncome.category === 'Tuition' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600">Desconto</label>
                                                <select
                                                    className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={newIncome.discountType} onChange={e => setNewIncome({...newIncome, discountType: e.target.value})}
                                                >
                                                    <option value="none">Sem desconto</option>
                                                    <option value="percent">Percentual</option>
                                                    <option value="amount">Valor</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600">Valor do Desconto</label>
                                                <input
                                                    type="number" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                                    value={newIncome.discountValue} onChange={e => setNewIncome({...newIncome, discountValue: e.target.value})}
                                                    disabled={newIncome.discountType === 'none'}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">Data de Recebimento</label>
                                        <input
                                            type="date" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                            value={newIncome.date} onChange={e => setNewIncome({...newIncome, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setIsAddingIncome(false)} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded hover:bg-slate-200">Cancelar</button>
                                        <button onClick={handleAddIncome} className="flex-1 py-2 text-sm text-white bg-emerald-600 rounded hover:bg-emerald-700 font-medium">Salvar</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-xl">
                            <h3 className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                                <AlertTriangle size={20} />
                                Alerta de Inadimplência
                            </h3>
                            <p className="text-sm text-rose-900 mb-4">
                                2 alunos estão com mensalidades vencidas há mais de 5 dias. O valor total em aberto é <strong>R$ 2.400,00</strong>.
                            </p>
                        </div>

                        {/* AI Message Drafter */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Send size={18} className="text-indigo-600" />
                                Régua de Cobrança (IA)
                            </h3>
                            
                            {!selectedInvoice ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    Selecione um aluno com pagamento atrasado para gerar uma mensagem de cobrança.
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Rascunho para: {selectedInvoice}</div>
                                    {isGenerating ? (
                                        <div className="text-sm text-indigo-600 italic">Escrevendo mensagem...</div>
                                    ) : (
                                        <>
                                            <textarea 
                                                value={messageDraft}
                                                onChange={(e) => setMessageDraft(e.target.value)}
                                                className="w-full h-40 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                                                    Enviar WhatsApp
                                                </button>
                                                <button 
                                                    onClick={() => setSelectedInvoice(null)}
                                                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    {/* Expenses List */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Contas a Pagar</h3>
                            <button 
                                onClick={() => setIsAddingExpense(true)}
                                className="flex items-center gap-2 bg-rose-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-rose-700"
                            >
                                <Plus size={16} /> Nova Despesa
                            </button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Descrição</th>
                                    <th className="px-6 py-3 font-medium">Categoria</th>
                                    <th className="px-6 py-3 font-medium">Vencimento</th>
                                    <th className="px-6 py-3 font-medium text-right">Valor</th>
                                    <th className="px-6 py-3 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800">{expense.description}</td>
                                        <td className="px-6 py-4 text-slate-500 capitalize">{expense.category}</td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(expense.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-right font-bold text-rose-600">- R$ {expense.amount.toLocaleString('pt-BR')}</td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="text-slate-400 hover:text-emerald-600" title="Marcar como pago">
                                                <Check size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add Expense Form / Summary */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                             <h3 className="font-bold text-slate-800 mb-4">Resumo do Mês</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                    <span className="text-sm text-emerald-800 font-medium">Total Receitas</span>
                                    <span className="font-bold text-emerald-700">
                                        R$ {Number(cashflow?.summary?.income || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-100">
                                    <span className="text-sm text-rose-800 font-medium">Total Despesas</span>
                                    <span className="font-bold text-rose-700">
                                        R$ {Number(cashflow?.summary?.expense || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </span>
                                </div>
                                <div className="border-t border-slate-100 pt-4 mt-2">
                                     <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 font-bold">Saldo Previsto</span>
                                        <span className="text-xl font-bold text-slate-800">
                                            R$ {Number(cashflow?.summary?.net || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                </div>
                             </div>
                        </div>

                        {isAddingExpense && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
                                <h3 className="font-bold text-slate-800 mb-4">Registrar Saída</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">Descrição</label>
                                        <input 
                                            type="text" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                                            value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600">Valor (R$)</label>
                                            <input 
                                                type="number" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                                                value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600">Categoria</label>
                                            <select 
                                                className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                                                value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                                            >
                                                <option value="">Selecione...</option>
                                                <option value="Payroll">Folha de Pagto</option>
                                                <option value="Maintenance">Manutenção</option>
                                                <option value="Supplies">Suprimentos</option>
                                                <option value="Taxes">Impostos</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-600">Data Vencimento</label>
                                        <input 
                                            type="date" className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                                            value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setIsAddingExpense(false)} className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded hover:bg-slate-200">Cancelar</button>
                                        <button onClick={handleAddExpense} className="flex-1 py-2 text-sm text-white bg-rose-600 rounded hover:bg-rose-700 font-medium">Salvar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialModule;
