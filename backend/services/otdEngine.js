/**
 * OTD Engine — Advanced OEM On-Time Delivery calculation
 * 
 * Schedule cycle: 25th → 25th
 * Week splits: W1=1-7, W2=8-14, W3=15-21, W4=22-26
 * 
 * Cases:
 *   A — Full on-time/early → 100
 *   B — Advance material covering future weeks → min(110, ratio×100)
 *   C — Partial → (received/scheduled)×100
 *   D — No material → 0
 *   E — Late → score − (delayDays×2), min 0
 */

const moment = require('moment');

// ---- WEEK DETERMINATION ----

function getWeekOfMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getDate();
  if (day >= 1 && day <= 7) return 1;
  if (day >= 8 && day <= 14) return 2;
  if (day >= 15 && day <= 21) return 3;
  if (day >= 22 && day <= 26) return 4;
  // Days 27-31 roll into next cycle, assign to W4
  return 4;
}

function getScheduleCycleMonth(dateStr) {
  // Schedule cycle runs 25th → 25th
  // If date is after 25th, it belongs to next month's cycle
  if (!dateStr) return null;
  const d = moment(dateStr);
  if (d.date() > 25) {
    return d.add(1, 'month').format('MMM');
  }
  return d.format('MMM');
}

// ---- DELAY CALCULATION ----

function calculateDelayDays(receiptDate, dueDate) {
  if (!receiptDate || !dueDate) return 0;
  const rd = new Date(receiptDate);
  const dd = new Date(dueDate);
  const diff = Math.ceil((rd - dd) / 86400000);
  return Math.max(0, diff);
}

// ---- WEEKLY SCORE ----

function calculateWeeklyScore(row) {
  const scheduleQty = Number(row.scheduleQty) || 0;
  const receivedQty = Number(row.receivedQty) || 0;
  const dueDate = row.dueDate ? new Date(row.dueDate) : null;
  const receiptDate = row.receiptDate ? new Date(row.receiptDate) : null;
  const now = new Date();

  // No schedule — perfect score
  if (scheduleQty === 0) {
    return { score: 100, caseType: 'NO_SCHEDULE', delayDays: 0 };
  }

  // CASE D: No material supplied at all
  if (receivedQty === 0) {
    if (dueDate && now > dueDate) {
      return { score: 0, caseType: 'D', delayDays: Math.ceil((now - dueDate) / 86400000) };
    }
    // Due date hasn't passed yet — still pending
    return { score: 0, caseType: 'D_PENDING', delayDays: 0 };
  }

  const delayDays = calculateDelayDays(receiptDate, dueDate);
  let score = 0;
  let caseType = '';

  if (receivedQty >= scheduleQty && receiptDate && dueDate && receiptDate <= dueDate) {
    // CASE A: Full quantity supplied on-time or early
    score = 100;
    caseType = 'A';
  } else if (receivedQty > scheduleQty && receiptDate && dueDate && receiptDate <= dueDate) {
    // CASE B: Advance material supplied covering future weeks (capped at 110)
    score = Math.min(110, (receivedQty / scheduleQty) * 100);
    caseType = 'B';
  } else if (receivedQty >= scheduleQty && (!receiptDate || !dueDate || receiptDate <= dueDate)) {
    // CASE A variant: full qty, dates may be missing
    score = 100;
    caseType = 'A';
  } else if (receivedQty > 0 && receivedQty < scheduleQty) {
    // CASE C: Partial supply
    score = (receivedQty / scheduleQty) * 100;
    caseType = 'C';
  } else if (receivedQty >= scheduleQty) {
    // Full qty but late
    score = 100;
    caseType = 'A_LATE';
  }

  // CASE E: Apply late penalty
  if (delayDays > 0 && score > 0) {
    const penalty = delayDays * 2;
    score = Math.max(0, score - penalty);
    caseType = caseType === 'C' ? 'C_LATE' : 'E';
  }

  return {
    score: Math.round(score * 100) / 100,
    caseType,
    delayDays,
  };
}

// ---- MONTHLY OTD (group rows by supplier+item) ----

function calculateWeeklyOTD(scheduleRows) {
  // Group schedule rows by supplier + item + month
  const groups = {};

  for (const row of scheduleRows) {
    const key = `${row.supplier || 'unknown'}_${row.itemCode || 'unknown'}_${row.month || ''}_${row.year || ''}`;
    if (!groups[key]) {
      groups[key] = {
        supplier: row.supplier,
        itemCode: row.itemCode,
        month: row.month,
        year: row.year,
        buyerId: row.buyerId,
        buyer: row.buyer,
        weeks: { 1: [], 2: [], 3: [], 4: [] },
      };
    }

    const week = getWeekOfMonth(row.dueDate);
    if (week && groups[key].weeks[week]) {
      const result = calculateWeeklyScore(row);
      groups[key].weeks[week].push(result);
    }
  }

  // Calculate per-week aggregate scores
  const results = [];
  for (const [key, group] of Object.entries(groups)) {
    const weekScores = {};
    let totalScore = 0;
    let activeWeeks = 0;

    for (let w = 1; w <= 4; w++) {
      const weekData = group.weeks[w];
      if (weekData.length > 0) {
        const avg = weekData.reduce((sum, r) => sum + r.score, 0) / weekData.length;
        weekScores[`week${w}Score`] = Math.round(avg * 100) / 100;
        totalScore += weekScores[`week${w}Score`];
        activeWeeks++;
      }
    }

    const monthlyOTD = activeWeeks > 0 ? Math.round((totalScore / activeWeeks) * 100) / 100 : 0;

    results.push({
      ...group,
      ...weekScores,
      monthlyOTD,
      rating: getSupplierRating(monthlyOTD),
      activeWeeks,
    });
  }

  return results;
}

function calculateMonthlyOTD(weekScores) {
  const scores = [];
  if (weekScores.week1Score !== undefined) scores.push(weekScores.week1Score);
  if (weekScores.week2Score !== undefined) scores.push(weekScores.week2Score);
  if (weekScores.week3Score !== undefined) scores.push(weekScores.week3Score);
  if (weekScores.week4Score !== undefined) scores.push(weekScores.week4Score);

  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

// ---- SUPPLIER RATING ----

function getSupplierRating(monthlyOTD) {
  if (monthlyOTD >= 90) return 'Excellent';
  if (monthlyOTD >= 60) return 'Average';
  return 'Poor';
}

function getSupplierStatus(monthlyOTD) {
  if (monthlyOTD >= 90) return 'Green';
  if (monthlyOTD >= 60) return 'Yellow';
  return 'Red';
}

// ---- APPLY TO SINGLE ROW (used by calculationEngine) ----

function calculateRowOTD(row) {
  const sq = Number(row.scheduleQty) || 0;
  const rq = Number(row.receivedQty) || 0;
  const dd = row.dueDate ? new Date(row.dueDate) : null;
  const rd = row.receiptDate ? new Date(row.receiptDate) : null;

  // Pending qty
  const pendingQty = Math.max(0, sq - rq);

  // Delay days
  const delayDays = calculateDelayDays(rd, dd);

  // Schedule adherence
  const scheduleAdherence = sq > 0 ? Math.round((rq / sq) * 10000) / 100 : 0;

  // Weekly score
  const weekResult = calculateWeeklyScore(row);
  const week = getWeekOfMonth(row.dueDate);

  // Build week scores object
  const weekScores = {};
  if (week) weekScores[`week${week}Score`] = weekResult.score;

  // Copy over any existing week scores from the row
  for (let w = 1; w <= 4; w++) {
    const key = `week${w}Score`;
    if (row[key] !== undefined && !weekScores[key]) {
      weekScores[key] = row[key];
    }
  }

  // Calculate monthly OTD from all available week scores
  const monthlyOTD = calculateMonthlyOTD(weekScores);

  return {
    ...row,
    pendingQty,
    delayDays,
    scheduleAdherence,
    otd: monthlyOTD,
    ...weekScores,
    supplierStatus: getSupplierStatus(monthlyOTD),
    supplierRating: getSupplierRating(monthlyOTD),
    otdCaseType: weekResult.caseType,
  };
}

// ---- SCHEDULE VS SUPPLY CALCULATIONS ----

function calculateScheduleVsSupply(row) {
  const sq = Number(row.scheduleQty) || 0;
  const rq = Number(row.receivedQty) || 0;
  const dd = row.dueDate ? new Date(row.dueDate) : null;
  const rd = row.receiptDate ? new Date(row.receiptDate) : null;

  return {
    pendingQty: Math.max(0, sq - rq),
    scheduleAdherence: sq > 0 ? Math.round((rq / sq) * 10000) / 100 : 0,
    delayDays: calculateDelayDays(rd, dd),
  };
}

module.exports = {
  getWeekOfMonth,
  getScheduleCycleMonth,
  calculateDelayDays,
  calculateWeeklyScore,
  calculateWeeklyOTD,
  calculateMonthlyOTD,
  getSupplierRating,
  getSupplierStatus,
  calculateRowOTD,
  calculateScheduleVsSupply,
};
