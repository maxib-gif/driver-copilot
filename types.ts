export interface AnalysisResult {
  valid: boolean;
  totalPrice: number;
  totalKm: number;
  totalTimeMinutes: number;
  pickupKm: number;
  tripKm: number;
  pickupMinutes: number;
  tripMinutes: number;
  currency: string;
}

export interface UserSettings {
  minRatePerKm: number;
  maxTotalKm: number;
}

export interface CalculatedMetrics {
  ratePerKm: number;
  ratePerHour: number;
  isRateGood: boolean;
  isDistanceGood: boolean;
  isOverallGood: boolean;
}