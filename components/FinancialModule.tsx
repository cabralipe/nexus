import React, { useState } from 'react';
import { DollarSign, AlertTriangle, FileText, Send, Check, TrendingDown, TrendingUp, Plus, Calendar, Download } from 'lucide-react';
import { MOCK_INVOICES, MOCK_TRANSACTIONS } from '../constants';
import { generateInsight } from '../services/geminiService';
import { exportToCSV } from '../utils';

type Tab = 'receivables' | 'payables';

const FinancialModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('receivables');
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
    const [messageDraft, setMessageDraft] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Expenses State
    const [expenses, setExpenses] = useState(MOCK_TRANSACTIONS.filter(t => t.type === 'expense'));
    const [newExpense, setNewExpense] = useState({ description: '', category: '', amount: '', date: '' });
    const [isAddingExpense, setIsAddingExpense] = useState(false);

    const handleGenerateMessage = async (studentName: string) => {
        setIsGenerating(true);
        const prompt = `Write a polite but firm WhatsApp message to the parents of ${studentName} reminding them that the school tuition of R$ 1200 is overdue. Be professional.`;
        const result = await generateInsight(prompt);
        setMessageDraft(result);
        setIsGenerating(false);
        setSelectedInvoice(studentName);
    };

    const handleAddExpense = () => {
        if(!newExpense.description || !newExpense.amount) return;
        const expense = {
            id: Math.random().toString(),
            description: newExpense.description,
            category: newExpense.category || 'Geral',
            amount: parseFloat(newExpense.amount),
            type: 'expense' as const,
            date: newExpense.date || new Date().toISOString().split('T')[0]
        };
        setExpenses([expense, ...expenses]);
        setIsAddingExpense(false);
        setNewExpense({ description: '', category: '', amount: '', date: '' });
    };

    const handleExportFinancial = () => {
        if (activeTab === 'receivables') {
            exportToCSV(MOCK_INVOICES, 'Relatorio_Mensalidades');
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
                                {MOCK_INVOICES.map((inv) => (
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
                                    <span className="font-bold text-emerald-700">R$ 145.000,00</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-rose-50 rounded-lg border border-rose-100">
                                    <span className="text-sm text-rose-800 font-medium">Total Despesas</span>
                                    <span className="font-bold text-rose-700">R$ {expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-4 mt-2">
                                     <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 font-bold">Saldo Previsto</span>
                                        <span className="text-xl font-bold text-slate-800">R$ 96.300,00</span>
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