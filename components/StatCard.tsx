import React from 'react';
import { MetricCardProps } from '../types';

export const StatCard: React.FC<MetricCardProps> = ({ title, value, trend, trendUp, icon, color }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={trendUp ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
            {trend}
          </span>
          <span className="text-slate-400 ml-2">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
};
