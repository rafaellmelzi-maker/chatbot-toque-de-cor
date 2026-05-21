import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/products';
import { Plus, Search, Edit, Trash2, Cpu, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import clsx from 'clsx';

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page],
    queryFn: () => productsApi.list({ page, limit: 20, ...(search && { search }) }).then((r) => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => { toast.success('Produto removido.'); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: () => toast.error('Erro ao remover produto.'),
  });

  const embedMutation = useMutation({
    mutationFn: (id: string) => productsApi.generateEmbedding(id),
    onSuccess: () => toast.success('Embedding gerado! O produto agora aparece nas buscas de IA.'),
    onError: () => toast.error('Erro ao gerar embedding.'),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar produto..."
            className="input pl-9"
          />
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo Produto
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.data?.map((p: {
            id: string; name: string; sku: string; price: number; priceUnit: string; stock: number;
            coverage?: number; category: { name: string }; brand: { name: string };
            surfaces: string[]; finishes: string[]; isActive: boolean;
            images?: Array<{ url: string; isPrimary: boolean }>;
          }) => (
            <div key={p.id} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
              {/* Image placeholder */}
              <div className="w-full h-36 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
                {p.images?.[0] ? (
                  <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={36} className="text-gray-300" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                <p className="text-sm font-semibold text-gray-900 leading-tight mt-0.5">{p.name}</p>
                <p className="text-xs text-gray-500 mt-1">{p.brand.name} · {p.category.name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.surfaces.slice(0, 3).map((s) => (
                    <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-bold text-brand-600">R$ {p.price.toFixed(2)}/{p.priceUnit}</p>
                  <p className="text-xs text-gray-400">Estoque: {p.stock} · {p.coverage ?? '—'} m²/L</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => embedMutation.mutate(p.id)}
                    title="Gerar embedding para IA"
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Cpu size={14} />
                  </button>
                  <button className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors">
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm('Remover este produto?')) removeMutation.mutate(p.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">{data.total} produtos</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs px-3 py-1">← Anterior</button>
            <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="btn-secondary text-xs px-3 py-1">Próxima →</button>
          </div>
        </div>
      )}
    </div>
  );
}
