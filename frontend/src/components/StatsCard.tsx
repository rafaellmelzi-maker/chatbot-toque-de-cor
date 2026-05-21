import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  trend?: number; // percentual de variação
  color?: 'brand' | 'green' | 'yellow' | 'blue';
}

const colorMap = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-green-50 text-green-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  blue: 'bg-blue-50 text-blue-600',
};

export default function StatsCard({ title, value, sub, icon: Icon, trend, color = 'brand' }: StatsCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorMap[color])}>
          <Icon size={20} />
        </div>
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={clsx('font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
          <span className="text-gray-400">vs. período anterior</span>
        </div>
      )}
    </div>
  );
}
