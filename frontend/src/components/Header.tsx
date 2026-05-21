import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/conversations': 'Conversas',
  '/leads': 'Leads',
  '/products': 'Produtos',
  '/stores': 'Lojas',
  '/settings': 'Configurações',
};

export default function Header() {
  const { user } = useAuthStore();
  const location = useLocation();
  const title = TITLES[location.pathname] ?? 'Toque de Cor';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Buscar..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 w-56 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
