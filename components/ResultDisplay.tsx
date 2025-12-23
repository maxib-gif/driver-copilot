import React from 'react';
import { AnalysisResult, CalculatedMetrics, UserSettings } from '../types';

interface ResultDisplayProps {
  result: AnalysisResult;
  metrics: CalculatedMetrics;
  settings: UserSettings;
}

const MetricCard: React.FC<{
  label: string;
  value: string;
  subValue?: string;
  isGood?: boolean;
  neutral?: boolean;
}> = ({ label, value, subValue, isGood, neutral }) => {
  let bgColor = "bg-slate-800";
  let textColor = "text-white";
  let borderColor = "border-slate-700";

  if (!neutral) {
    if (isGood) {
      bgColor = "bg-emerald-900/30";
      borderColor = "border-emerald-600/50";
      textColor = "text-emerald-400";
    } else {
      bgColor = "bg-red-900/30";
      borderColor = "border-red-600/50";
      textColor = "text-red-400";
    }
  }

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-md transition-all`}>
      <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">{label}</span>
      <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
      {subValue && <span className="text-slate-500 text-xs mt-1">{subValue}</span>}
    </div>
  );
};

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, metrics, settings }) => {
  const currency = result.currency;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Main Verdict Header */}
      <div className={`p-4 rounded-xl text-center border-2 ${metrics.isOverallGood ? 'bg-emerald-600 border-emerald-400' : 'bg-red-600 border-red-400'} shadow-xl`}>
        <h2 className="text-3xl font-black text-white uppercase tracking-tight">
          {metrics.isOverallGood ? '¡VIAJE RENTABLE!' : 'NO RECOMENDADO'}
        </h2>
        <p className="text-white/90 text-sm mt-1">
          {metrics.isOverallGood 
            ? 'Cumple con tus parámetros de ganancia y distancia.' 
            : 'Fuera de tus parámetros establecidos.'}
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard 
          label="Ganancia / KM" 
          value={`${currency}${metrics.ratePerKm.toFixed(2)}`} 
          subValue={`Meta: > ${currency}${settings.minRatePerKm}`}
          isGood={metrics.isRateGood}
        />
        <MetricCard 
          label="Ganancia / Hora" 
          value={`${currency}${metrics.ratePerHour.toFixed(0)}`} 
          subValue="Estimado"
          neutral={true} 
        />
        <MetricCard 
          label="Distancia Total" 
          value={`${result.totalKm.toFixed(1)} km`} 
          subValue={`Recogida: ${result.pickupKm} + Viaje: ${result.tripKm}`}
          isGood={metrics.isDistanceGood}
        />
        <MetricCard 
          label="Tiempo Total" 
          value={`${result.totalTimeMinutes} min`} 
          subValue={`Recogida: ${result.pickupMinutes} + Viaje: ${result.tripMinutes}`}
          neutral={true}
        />
      </div>

      {/* Raw Data Accordion (Simplified as a list here) */}
      <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400">
        <div className="flex justify-between mb-2">
          <span>Precio Ofrecido:</span>
          <span className="text-white font-mono">{currency}{result.totalPrice}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Distancia Recogida:</span>
          <span className="text-white font-mono">{result.pickupKm} km</span>
        </div>
        <div className="flex justify-between">
          <span>Distancia Destino:</span>
          <span className="text-white font-mono">{result.tripKm} km</span>
        </div>
      </div>
    </div>
  );
};
