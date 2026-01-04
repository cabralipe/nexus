import React, { useEffect, useState } from 'react';
import { Package, Search, Plus, AlertCircle, RefreshCw, Archive, AlertTriangle, XCircle, Pencil, Trash2 } from 'lucide-react';
import { InventoryItem } from '../types';
import { backend } from '../services/backendService';

const InventoryModule: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [filter, setFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({
        name: '',
        category: 'Stationery',
        quantity: 0,
        minQuantity: 0,
        unit: '',
        location: '',
    });

    const loadInventory = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await backend.fetchInventory();
            const normalized = data.map((item: any) => ({
                ...item,
                id: String(item.id),
                minQuantity: item.minQuantity ?? item.min_quantity ?? 0,
            }));
            setInventory(normalized);
        } catch (error) {
            console.error('Failed to load inventory', error);
            setErrorMessage('Nao foi possivel carregar o estoque.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventory();
    }, []);

    const handleSaveItem = async () => {
        if (!newItem.name.trim()) return;
        setLoading(true);
        setErrorMessage('');
        try {
            if (editingId) {
                const updated = await backend.updateInventoryItem(editingId, {
                    name: newItem.name,
                    category: newItem.category,
                    quantity: newItem.quantity,
                    minQuantity: newItem.minQuantity,
                    unit: newItem.unit,
                    location: newItem.location,
                });
                const normalized = {
                    ...updated,
                    id: String(updated.id),
                    minQuantity: updated.minQuantity ?? updated.min_quantity ?? 0,
                };
                setInventory(prev => prev.map(item => item.id === editingId ? { ...item, ...normalized } : item));
            } else {
                const created = await backend.createInventoryItem({
                    name: newItem.name,
                    category: newItem.category,
                    quantity: newItem.quantity,
                    minQuantity: newItem.minQuantity,
                    unit: newItem.unit,
                    location: newItem.location,
                });
                setInventory(prev => [{ ...created, id: String(created.id) }, ...prev]);
            }
            setShowCreateModal(false);
            setEditingId(null);
            setNewItem({
                name: '',
                category: 'Stationery',
                quantity: 0,
                minQuantity: 0,
                unit: '',
                location: '',
            });
        } catch (error) {
            console.error('Failed to save inventory item', error);
            setErrorMessage('Nao foi possivel salvar o item.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item: InventoryItem) => {
        setNewItem({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            minQuantity: item.minQuantity,
            unit: item.unit,
            location: item.location,
        });
        setEditingId(item.id);
        setShowCreateModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este item?')) return;
        try {
            await backend.deleteInventoryItem(id);
            setInventory(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error('Failed to delete item', error);
            setErrorMessage('Nao foi possivel excluir o item.');
        }
    };

    const handleUpdateQuantity = async (id: string, delta: number) => {
        const item = inventory.find((entry) => entry.id === id);
        if (!item) return;
        const nextQuantity = Math.max(0, item.quantity + delta);
        setInventory(prev =>
            prev.map(entry => (entry.id === id ? { ...entry, quantity: nextQuantity } : entry))
        );
        try {
            const updated = await backend.updateInventoryItem(id, { quantity: nextQuantity });
            const normalized = {
                ...updated,
                id: String(updated.id),
                minQuantity: updated.minQuantity ?? updated.min_quantity ?? item.minQuantity,
            };
            setInventory(prev =>
                prev.map(entry => (entry.id === id ? { ...entry, ...normalized } : entry))
            );
        } catch (error) {
            console.error('Failed to update inventory item', error);
            setErrorMessage('Nao foi possivel atualizar o item.');
            setInventory(prev =>
                prev.map(entry => (entry.id === id ? { ...entry, quantity: item.quantity } : entry))
            );
        }
    };

    const filteredInventory = inventory.filter(item => {
        const matchesName = item.name.toLowerCase().includes(filter.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        const matchesLowStock = showLowStockOnly ? item.quantity <= item.minQuantity : true;
        return matchesName && matchesCategory && matchesLowStock;
    });

    const lowStockCount = inventory.filter(i => i.quantity <= i.minQuantity).length;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Almoxarifado e Estoque</h2>
                    <p className="text-slate-500">Gestão de materiais, equipamentos e suprimentos.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setNewItem({
                            name: '',
                            category: 'Stationery',
                            quantity: 0,
                            minQuantity: 0,
                            unit: '',
                            location: '',
                        });
                        setShowCreateModal(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
                >
                    <Plus size={18} /> Novo Item
                </button>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
                    {errorMessage}
                </div>
            )}

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Total de Itens</p>
                        <h3 className="text-2xl font-bold text-slate-800">{inventory.length}</h3>
                    </div>
                </div>

                {/* Clickable Low Stock Metric */}
                <div
                    onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                    className={`bg-white p-6 rounded-xl shadow-sm border cursor-pointer transition-all ${showLowStockOnly
                        ? 'border-rose-300 ring-2 ring-rose-100 bg-rose-50'
                        : 'border-slate-100 hover:border-rose-200'
                        } flex items-center gap-4 group`}
                >
                    <div className={`p-3 rounded-full transition-colors ${showLowStockOnly ? 'bg-rose-200 text-rose-700' : 'bg-rose-100 text-rose-600'}`}>
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className={`text-sm font-medium ${showLowStockOnly ? 'text-rose-700' : 'text-slate-500'}`}>Estoque Baixo</p>
                        <h3 className={`text-2xl font-bold ${showLowStockOnly ? 'text-rose-800' : 'text-slate-800'}`}>
                            {lowStockCount}
                        </h3>
                        <p className={`text-xs mt-1 font-medium transition-colors ${showLowStockOnly ? 'text-rose-600' : 'text-slate-400 group-hover:text-rose-500'}`}>
                            {showLowStockOnly ? 'Filtro Ativo (Remover)' : 'Clique para filtrar'}
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                        <Archive size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Valor Estimado</p>
                        <h3 className="text-2xl font-bold text-slate-800">R$ 12.450</h3>
                    </div>
                </div>
            </div>

            {/* Visual Alert Banner for Low Stock */}
            {lowStockCount > 0 && !showLowStockOnly && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                            <AlertTriangle size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-orange-800">Atenção Necessária no Estoque</p>
                            <p className="text-xs text-orange-700">Você possui <span className="font-bold">{lowStockCount} itens</span> abaixo do nível mínimo de segurança.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowLowStockOnly(true)}
                        className="text-orange-700 text-xs font-bold hover:text-orange-900 bg-orange-100 hover:bg-orange-200 px-3 py-2 rounded transition-colors"
                    >
                        Filtrar Itens Críticos
                    </button>
                </div>
            )}

            {/* Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex gap-4 items-center flex-1 w-full flex-wrap">
                        <div className="relative flex-1 max-w-md min-w-[200px]">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar material..."
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                        <select
                            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="All">Todas Categorias</option>
                            <option value="Stationery">Papelaria</option>
                            <option value="Cleaning">Limpeza</option>
                            <option value="Electronics">Eletrônicos</option>
                            <option value="Didactic">Didático</option>
                        </select>

                        <button
                            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${showLowStockOnly
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <AlertCircle size={16} />
                            {showLowStockOnly ? 'Mostrando Baixo Estoque' : 'Filtrar Baixo Estoque'}
                        </button>
                    </div>
                </div>

                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                        <tr>
                            <th className="px-6 py-3 font-medium">Item</th>
                            <th className="px-6 py-3 font-medium">Categoria</th>
                            <th className="px-6 py-3 font-medium">Localização</th>
                            <th className="px-6 py-3 font-medium text-center">Quantidade</th>
                            <th className="px-6 py-3 font-medium text-center">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <p className="font-medium">Carregando itens...</p>
                                </td>
                            </tr>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map(item => {
                                const isLowStock = item.quantity <= item.minQuantity;
                                return (
                                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${isLowStock && showLowStockOnly ? 'bg-rose-50/30' : ''}`}>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            {item.name}
                                            <div className="text-xs text-slate-500 font-normal">Unidade: {item.unit}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{item.category === 'Stationery' ? 'Papelaria' : item.category === 'Cleaning' ? 'Limpeza' : item.category}</td>
                                        <td className="px-6 py-4 text-slate-600">{item.location}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-3">
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, -1)}
                                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                >-</button>
                                                <span className={`font-bold w-8 ${isLowStock ? 'text-rose-600' : 'text-slate-800'}`}>
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.id, 1)}
                                                    className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                >+</button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLowStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {isLowStock ? 'Estoque Baixo' : 'Normal'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <Package size={48} className="mx-auto mb-4 text-slate-300" />
                                    <p className="font-medium">Nenhum item encontrado.</p>
                                    <p className="text-xs mt-1">Tente ajustar seus filtros de busca.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Editar Item' : 'Novo Item'}</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700">Nome</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2"
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Categoria</label>
                                    <select
                                        className="w-full border rounded p-2 bg-white"
                                        value={newItem.category}
                                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                    >
                                        <option value="Stationery">Papelaria</option>
                                        <option value="Cleaning">Limpeza</option>
                                        <option value="Electronics">Eletronicos</option>
                                        <option value="Didactic">Didatico</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Localizacao</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2"
                                        value={newItem.location}
                                        onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Quantidade</label>
                                    <input
                                        type="number"
                                        className="w-full border rounded p-2"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Minimo</label>
                                    <input
                                        type="number"
                                        className="w-full border rounded p-2"
                                        value={newItem.minQuantity}
                                        onChange={(e) => setNewItem({ ...newItem, minQuantity: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-700">Unidade</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded p-2"
                                        value={newItem.unit}
                                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveItem}
                                    className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                    disabled={loading || !newItem.name.trim()}
                                >
                                    {editingId ? 'Salvar Alterações' : 'Criar Item'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryModule;
