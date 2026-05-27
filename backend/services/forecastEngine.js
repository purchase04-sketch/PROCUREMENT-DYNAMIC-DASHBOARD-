/**
 * Forecast Engine — Demand forecasting and predictive quantity calculations
 */

// ---- MOVING AVERAGE ----

function calculateMovingAverage(lastYearConsumption, currentSchedule) {
  const lyc = Number(lastYearConsumption) || 0;
  const cs = Number(currentSchedule) || 0;
  // Average of monthly consumption from last year + current schedule
  return Math.round(((lyc / 12) + cs) / 2 * 100) / 100;
}

// ---- FORECAST ----

function calculateForecast(movingAverage, seasonalityFactor) {
  const ma = Number(movingAverage) || 0;
  const sf = Number(seasonalityFactor) || 1;
  // ForecastQty = MovingAverage × SeasonalityFactor
  return Math.round(ma * sf * 100) / 100;
}

// ---- PREDICTIVE QTY ----

function calculatePredictiveQty(forecastQty, safetyStock, currentStock) {
  const fq = Number(forecastQty) || 0;
  const ss = Number(safetyStock) || 0;
  const cs = Number(currentStock) || 0;
  // PredictiveQty = ForecastQty + SafetyStock − CurrentStock
  return Math.round((fq + ss - cs) * 100) / 100;
}

// ---- FULL ROW CALCULATION ----

function calculateForecastRow(row) {
  const lyc = Number(row.lastYearConsumption) || 0;
  const cs = Number(row.currentSchedule) || 0;
  const sf = Number(row.seasonalityFactor) || 1;
  const ss = Number(row.safetyStock) || 0;
  const stock = Number(row.stock) || Number(row.currentStock) || 0;
  const sob = Number(row.sob) || 0;

  const movingAverage = calculateMovingAverage(lyc, cs);
  const forecastQty = calculateForecast(movingAverage, sf);
  const predictiveQty = calculatePredictiveQty(forecastQty, ss, stock);
  const supplierPlannedQty = Math.round(forecastQty * (sob / 100) * 100) / 100;

  return {
    ...row,
    movingAverage,
    forecastQty,
    predictiveQty,
    supplierPlannedQty,
  };
}

// ---- SEASONALITY DETECTION ----

function detectSeasonality(monthlyData) {
  // Simple seasonality detection based on historical monthly data
  // monthlyData: array of { month, qty } objects
  if (!monthlyData || monthlyData.length < 12) return 1;

  const total = monthlyData.reduce((sum, d) => sum + (Number(d.qty) || 0), 0);
  const avg = total / monthlyData.length;
  if (avg === 0) return 1;

  // Return map of seasonality factors per month
  const factors = {};
  monthlyData.forEach(d => {
    factors[d.month] = Math.round((Number(d.qty) / avg) * 100) / 100;
  });
  return factors;
}

// ---- FORECAST ACCURACY ----

function calculateForecastAccuracy(forecastQty, actualQty) {
  const fq = Number(forecastQty) || 0;
  const aq = Number(actualQty) || 0;
  if (fq === 0) return aq === 0 ? 100 : 0;
  const error = Math.abs(fq - aq) / fq;
  return Math.round((1 - error) * 10000) / 100;
}

module.exports = {
  calculateMovingAverage,
  calculateForecast,
  calculatePredictiveQty,
  calculateForecastRow,
  detectSeasonality,
  calculateForecastAccuracy,
};
