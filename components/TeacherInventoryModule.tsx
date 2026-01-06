import React, { useEffect, useMemo, useState } from 'react';
import { Search, ClipboardList, Plus } from 'lucide-react';
import { InventoryItem } from '../types';
import { backend } from '../services/backendService';

const TeacherInventoryModule: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [requestQuantity, setRequestQuantity] = useState('1');
  const [requestNotes, setRequestNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [items, reqs] = await Promise.all([
        backend.fetchInventory(),
        backend.fetchInventoryRequests(),
      ]);
      const normalized = items.map((item: any) => ({
        ...item,
        id: String(item.id),
        minQuantity: item.minQuantity ?? item.min_quantity ?? 0,
      }));
      setInventory(normalized);
      setRequests(reqs);
    } catch (error) {
      console.error('Failed to load inventory requests', error);
      setErrorMessage('Nao foi possivel carregar os materiais.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [inventory, filter]);

  const handleCreateRequest = async () => {
    if (!selectedItemId || Number(requestQuantity) <= 0) return;
    setRequesting(true);
    try {
      await backend.createInventoryRequest({
        item_id: selectedItemId,
        quantity: Number(requestQuantity),
        notes: requestNotes,
      });
      setSelectedItemId('');
      setRequestQuantity('1');
      setRequestNotes('');
      await loadData();
    } catch (error) {
      console.error('Failed to create request', error);
      setErrorMessage('Nao foi possivel enviar a solicitacao.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Materiais do Estoque</h2>
          <p className="text-slate-500">Consulte o estoque e solicite materiais.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Itens Disponiveis</h3>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar material..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Item</th>
                  <th className="px-6 py-3 font-medium text-center">Estoque</th>
                  <th className="px-6 py-3 font-medium">Categoria</th>
                  <th className="px-6 py-3 font-medium">Local</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                      Carregando materiais...
                    </td>
                  </tr>
                )}
                {!loading && filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-slate-400">
                      Nenhum material encontrado.
                    </td>
                  </tr>
                )}
                {!loading && filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{item.name}</td>
                    <td className="px-6 py-4 text-center">{item.quantity} {item.unit}</td>
                    <td className="px-6 py-4 text-slate-500">{item.category}</td>
                    <td className="px-6 py-4 text-slate-500">{item.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={18} className="text-indigo-600" />
              Novo Pedido
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione...</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Observacoes</label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                  placeholder="Justifique o pedido..."
                />
              </div>
              <button
                onClick={handleCreateRequest}
                disabled={requesting}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-70"
              >
                {requesting ? 'Enviando...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-indigo-600" />
              Minhas Solicitações
            </h3>
            <div className="space-y-3">
              {requests.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma solicitacao registrada.</p>
              )}
              {requests.map((req: any) => (
                <div key={req.id} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium text-slate-800">{req.item_name}</div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : req.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {req.status === 'approved'
                        ? 'Aprovada'
                        : req.status === 'rejected'
                          ? 'Rejeitada'
                          : 'Pendente'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Quantidade: {req.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherInventoryModule;
