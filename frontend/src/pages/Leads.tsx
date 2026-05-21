import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '../api/conversations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import clsx from 'clsx';

const STATUS_COLUMNS = [
  { key: 'NEW', label: 'Novos', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'CONTACTED', label: 'Contatados', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'QUALIFIED', label: 'Qualificados', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'PROPOSAL', label: 'Proposta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'WON', label: 'Ganhos', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'LOST', label: 'Perdidos', color: 'bg-red-100 text-red-700 border-red-200' },
];

export default function Leads() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', statusFilter],
    queryFn: () =>
      leadsApi.list({ page: 1, limit: 100, ...(statusFilter && { status: statusFilter }) }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => leadsApi.updateStatus(id, status),
    onSuccess: () => { toast.success('Status atualizado!'); qc.invalidateQueries({ queryKey: ['leads'] }); },
    onError: () => toast.error('Erro ao atualizar status.'),
  });

  const leads: Array<{
    id: string; status: string; score: number; estimatedValue?: number;
    customer: { name?: string; phone: string; email?: string };
    store: { name: string; code: string }; notes?: string; createdAt: string;
  }> = data?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', !statusFilter ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
          Todos ({leads.length})
        </button>
        {STATUS_COLUMNS.map((s) => {
          const count = leads.filter((l) => l.status === s.key).length;
          return (
            <button key={s.key} onClick={() => setStatusFilter(s.key === statusFilter ? '' : s.key)}
              className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', statusFilter === s.key ? 'bg-brand-500 text-white border-transparent' : s.color)}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Loja</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Score</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Valor Est.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => {
                const statusConf = STATUS_COLUMNS.find((s) => s.key === lead.status);
                return (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{lead.customer.name ?? lead.customer.phone}</p>
                      {lead.customer.email && <p className="text-xs text-gray-400">{lead.customer.email}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{lead.store.code}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus.mutate({ id: lead.id, status: e.target.value })}
                        className={clsx('text-xs font-medium px-2 py-1 rounded-full border cursor-pointer', statusConf?.color ?? 'text-gray-600 bg-gray-100 border-gray-200')}
                      >
                        {STATUS_COLUMNS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full', lead.score >= 70 ? 'bg-green-50 text-green-700' : lead.score >= 40 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600')}>
                        {lead.score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm">
                      {lead.estimatedValue ? <span className="font-semibold text-gray-700">R$ {lead.estimatedValue.toFixed(2)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400">
                      {format(new Date(lead.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3.5" />
                  </tr>
                );
              })}
            </tbody>
          </table>
          {leads.length === 0 && (
            <p className="text-center text-gray-400 py-12">Nenhum lead encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
