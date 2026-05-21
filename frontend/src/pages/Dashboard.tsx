import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import StatsCard from '../components/StatsCard';
import { MessageSquare, Users, TrendingUp, Activity, Star, Store } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats('30d').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const { data: chartData } = useQuery({
    queryKey: ['dashboard-chart'],
    queryFn: () => dashboardApi.getConversationsChart('30d').then((r) => r.data.data),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['dashboard-top-products'],
    queryFn: () => dashboardApi.getTopProducts().then((r) => r.data.data),
  });

  const { data: funnel } = useQuery({
    queryKey: ['dashboard-funnel'],
    queryFn: () => dashboardApi.getLeadsFunnel().then((r) => r.data.data),
  });

  const { data: storePerf } = useQuery({
    queryKey: ['dashboard-store-perf'],
    queryFn: () => dashboardApi.getStorePerformance().then((r) => r.data.data),
  });

  const lineChartData = {
    labels: chartData?.map((d: { date: string }) => format(new Date(d.date), 'dd/MM', { locale: ptBR })) ?? [],
    datasets: [
      {
        label: 'Conversas',
        data: chartData?.map((d: { count: number }) => d.count) ?? [],
        borderColor: '#E63946',
        backgroundColor: 'rgba(230,57,70,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
    ],
  };

  const funnelColors = ['#60a5fa','#34d399','#fbbf24','#a78bfa','#34d399','#f87171'];
  const funnelData = {
    labels: funnel?.map((f: { status: string }) => f.status) ?? [],
    datasets: [{ data: funnel?.map((f: { count: number }) => f.count) ?? [], backgroundColor: funnelColors, borderWidth: 0 }],
  };

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Conversas (30d)" value={stats?.totalConversations ?? '—'} icon={MessageSquare} color="brand" />
        <StatsCard title="Conversas Ativas" value={stats?.activeConversations ?? '—'} icon={Activity} color="blue" />
        <StatsCard title="Leads (30d)" value={stats?.totalLeads ?? '—'} icon={Users} color="yellow" />
        <StatsCard title="Taxa de Conversão" value={stats?.conversionRate ?? '—'} sub="leads → vendas" icon={TrendingUp} color="green" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line Chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Conversas por dia (últimos 30 dias)</h2>
          <Line
            data={lineChartData}
            options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
          />
        </div>

        {/* Funnel Doughnut */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Funil de Leads</h2>
          <Doughnut
            data={funnelData}
            options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }}
          />
        </div>
      </div>

      {/* Products & Stores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-gray-700">Produtos Mais Recomendados</h2>
          </div>
          <div className="space-y-3">
            {topProducts?.slice(0, 6).map((p: { productId: string; name: string; category: string; count: number }, i: number) => (
              <div key={p.productId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.category}</p>
                </div>
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  {p.count}x
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Store Performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-gray-700">Desempenho por Loja</h2>
          </div>
          <div className="space-y-3">
            {storePerf?.slice(0, 6).map((s: { id: string; name: string; code: string; conversations: number; leads: number; wonLeads: number }) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{s.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.name.replace('Toque de Cor – ', '')}</p>
                  <p className="text-xs text-gray-400">{s.conversations} conversas · {s.leads} leads</p>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {s.wonLeads} vendas
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
