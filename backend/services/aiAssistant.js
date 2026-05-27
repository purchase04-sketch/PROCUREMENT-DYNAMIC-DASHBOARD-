/**
 * AI Assistant — Enhanced AI service with full procurement context
 * Integrates with OpenAI GPT-4o, with offline fallback
 */

let OpenAI;
try {
  OpenAI = require('openai');
} catch (e) {
  console.warn('OpenAI package not available, AI will run in offline mode');
}

// ---- CONTEXT BUILDER ----

function buildContext(buyerContext, filters, tabContext, latestData, formulas) {
  const ctx = {
    currentBuyer: buyerContext?.buyerName || filters?.buyer || 'All',
    currentBuyerId: buyerContext?.buyerId || '',
    currentDepartment: buyerContext?.department || filters?.department || 'All',
    currentUnit: buyerContext?.unit || filters?.unit || 'All',
    currentMonth: filters?.month || 'All',
    currentYear: filters?.year || new Date().getFullYear(),
    currentFinancialYear: filters?.financialYear || '',
    activeFilters: filters || {},
    activeTab: tabContext || 'Dashboard',
    activeFormulas: formulas || [],
    dataSnapshot: null,
  };

  // Build data snapshot (limited to avoid token overflow)
  if (latestData) {
    const MAX_ROWS = 50;
    ctx.dataSnapshot = {};
    for (const [key, data] of Object.entries(latestData)) {
      if (Array.isArray(data)) {
        ctx.dataSnapshot[key] = {
          totalRows: data.length,
          sample: data.slice(0, MAX_ROWS),
        };
      }
    }
  }

  return ctx;
}

// ---- SYSTEM PROMPT ----

function buildSystemPrompt(context) {
  return `You are a world-class AI Procurement Analyst embedded in a Procurement Performance Dashboard. Act exactly like ChatGPT but specialized in procurement, supply chain, and vendor management.

== CURRENT USER CONTEXT ==
Buyer: ${context.currentBuyer}
Department: ${context.currentDepartment}
Unit: ${context.currentUnit}
Month: ${context.currentMonth} ${context.currentYear}
Financial Year: ${context.currentFinancialYear}
Active Tab: ${context.activeTab}
Active Filters: ${JSON.stringify(context.activeFilters)}

== ACTIVE FORMULAS ==
${JSON.stringify(context.activeFormulas).substring(0, 1000)}

== DATA SNAPSHOT ==
${context.dataSnapshot ? JSON.stringify(context.dataSnapshot).substring(0, 4000) : 'No data loaded'}

== YOUR CAPABILITIES ==
1. Analyze uploaded and edited procurement data
2. Explain formulas — what they calculate and why
3. Generate new formulas using JavaScript math expressions
4. Modify existing formulas
5. Detect anomalies in KPIs (OTD drops, cost spikes, inventory imbalances)
6. Generate professional procurement emails (reminders, escalations, urgency)
7. Suggest procurement actions based on data trends
8. Explain KPI changes with root causes
9. Answer any procurement, supply chain, or dashboard question
10. Generate schedule adherence reports and supplier scorecards

== RULES ==
- ALWAYS use the current buyer, department, unit, month, and financial year context
- NEVER use or hallucinate data not present in the snapshot
- When discussing numbers, be precise and reference specific items/suppliers
- When generating formulas, output valid JavaScript math expressions
- When drafting emails, be professional and include relevant KPI data
- If asked about data not in your context, say so clearly
- Respond dynamically and conversationally`;
}

// ---- CHAT ----

async function chat(prompt, context) {
  const systemPrompt = buildSystemPrompt(context);

  try {
    if (!OpenAI || !process.env.OPENAI_API_KEY) {
      return offlineFallback(prompt, context);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return {
      response: completion.choices[0].message.content,
      model: 'gpt-4o',
      tokensUsed: completion.usage?.total_tokens || 0,
    };
  } catch (e) {
    console.error('AI Error:', e.message);
    return offlineFallback(prompt, context);
  }
}

// ---- MULTI-TURN CHAT ----

async function chatWithHistory(messages, context) {
  const systemPrompt = buildSystemPrompt(context);

  try {
    if (!OpenAI || !process.env.OPENAI_API_KEY) {
      const lastMessage = messages[messages.length - 1];
      return offlineFallback(lastMessage?.content || '', context);
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return {
      response: completion.choices[0].message.content,
      model: 'gpt-4o',
      tokensUsed: completion.usage?.total_tokens || 0,
    };
  } catch (e) {
    console.error('AI Error:', e.message);
    const lastMessage = messages[messages.length - 1];
    return offlineFallback(lastMessage?.content || '', context);
  }
}

// ---- ANOMALY DETECTION ----

function analyzeAnomalies(data) {
  const anomalies = [];

  if (data.schedules) {
    // Check for suppliers with OTD < 60%
    const supplierOTD = {};
    for (const row of data.schedules) {
      if (!row.supplier) continue;
      if (!supplierOTD[row.supplier]) supplierOTD[row.supplier] = [];
      if (row.otd !== undefined) supplierOTD[row.supplier].push(row.otd);
    }
    for (const [supplier, scores] of Object.entries(supplierOTD)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg < 60) {
        anomalies.push({
          type: 'OTD_CRITICAL',
          severity: 'high',
          message: `Supplier "${supplier}" has critical OTD: ${Math.round(avg)}% (${scores.length} schedules)`,
          supplier,
          value: Math.round(avg),
        });
      }
    }

    // Check for high delay items
    for (const row of data.schedules) {
      if ((row.delayDays || 0) > 14) {
        anomalies.push({
          type: 'EXCESSIVE_DELAY',
          severity: 'medium',
          message: `Item "${row.itemCode}" from "${row.supplier}" delayed by ${row.delayDays} days`,
          itemCode: row.itemCode,
          supplier: row.supplier,
          value: row.delayDays,
        });
      }
    }
  }

  if (data.inventory) {
    // Check for stockouts
    for (const row of data.inventory) {
      if ((row.currentStock || 0) === 0 && (row.consumption || 0) > 0) {
        anomalies.push({
          type: 'STOCKOUT',
          severity: 'critical',
          message: `Item "${row.itemCode}" has zero stock with active consumption`,
          itemCode: row.itemCode,
          value: 0,
        });
      }
      // Check for excess inventory
      if ((row.excessQty || 0) > 0 && (row.inventoryValue || 0) > 100000) {
        anomalies.push({
          type: 'EXCESS_INVENTORY',
          severity: 'low',
          message: `Item "${row.itemCode}" has excess stock worth ₹${Math.round(row.inventoryValue).toLocaleString()}`,
          itemCode: row.itemCode,
          value: row.inventoryValue,
        });
      }
    }
  }

  return anomalies;
}

// ---- FORMULA GENERATION ----

function generateFormulaPrompt(description) {
  return `Generate a JavaScript mathematical expression for: "${description}"

Available variables: scheduleQty, receivedQty, pendingQty, delayDays, oldRate, newRate, l1Rate, qty, currentStock, consumption, leadTime, moq, safetyStock, rate, sob, lastYearConsumption, currentSchedule, vmiDays, seasonalityFactor

Return ONLY the mathematical expression, no explanation. Use standard math operators (+, -, *, /) and functions like Math.max(), Math.min(), Math.round().`;
}

// ---- EMAIL GENERATION ----

function generateEmailPrompt(type, supplierData) {
  const templates = {
    Reminder: `Draft a professional procurement reminder email to supplier "${supplierData.supplier}" regarding pending deliveries. Include: pending qty (${supplierData.pendingQty}), due date, item details.`,
    Escalation: `Draft a procurement escalation email for supplier "${supplierData.supplier}" with OTD score of ${supplierData.otd}%. Include: performance data, specific delayed items, required action.`,
    Urgency: `Draft an urgent procurement email to supplier "${supplierData.supplier}" about critical delivery delays of ${supplierData.delayDays} days. Emphasize production impact.`,
    VMI: `Draft a VMI compliance email to supplier "${supplierData.supplier}" with VMI compliance at ${supplierData.vmiCompliance}%. Include gap analysis and required correction.`,
  };
  return templates[type] || templates.Reminder;
}

// ---- KPI CHANGE EXPLANATION ----

function explainKPIChange(before, after) {
  const changes = [];
  for (const key of Object.keys(after)) {
    if (before[key] !== undefined && after[key] !== undefined) {
      const diff = Number(after[key]) - Number(before[key]);
      if (Math.abs(diff) > 0.01) {
        const direction = diff > 0 ? 'increased' : 'decreased';
        const pct = before[key] !== 0 ? Math.round((diff / before[key]) * 10000) / 100 : 0;
        changes.push({
          kpi: key,
          before: before[key],
          after: after[key],
          change: Math.round(diff * 100) / 100,
          percentChange: pct,
          direction,
          summary: `${key} ${direction} by ${Math.abs(Math.round(diff * 100) / 100)} (${Math.abs(pct)}%)`,
        });
      }
    }
  }
  return changes;
}

// ---- OFFLINE FALLBACK ----

function offlineFallback(prompt, context) {
  const lowerPrompt = prompt.toLowerCase();

  let response = `📊 **AI Analysis (Offline Mode)**\n\n`;

  if (lowerPrompt.includes('anomal') || lowerPrompt.includes('issue') || lowerPrompt.includes('problem')) {
    response += `Based on your current filters (${context.currentBuyer}, ${context.currentMonth} ${context.currentYear}):\n\n`;
    response += `• Review supplier OTD scores below 60% — these need escalation\n`;
    response += `• Check inventory items with zero stock and active consumption\n`;
    response += `• Monitor cost saving items where new rate > old rate (negative savings)\n\n`;
  } else if (lowerPrompt.includes('formula')) {
    response += `Active formulas: ${context.activeFormulas.length}\n\n`;
    response += `You can:\n`;
    response += `• Create new formulas using math expressions\n`;
    response += `• Edit existing formulas\n`;
    response += `• Apply formulas globally or per buyer/supplier\n\n`;
  } else if (lowerPrompt.includes('email') || lowerPrompt.includes('mail')) {
    response += `I can help draft procurement emails:\n\n`;
    response += `• Reminder — for pending deliveries\n`;
    response += `• Escalation — for poor OTD performance\n`;
    response += `• Urgency — for critical delays\n`;
    response += `• VMI — for VMI compliance issues\n\n`;
  } else {
    response += `Context: ${context.currentBuyer} | ${context.currentDepartment} | ${context.currentMonth} ${context.currentYear}\n\n`;
    response += `I can help with:\n`;
    response += `• 📈 Data analysis & anomaly detection\n`;
    response += `• 📐 Formula creation & modification\n`;
    response += `• 📧 Email drafting\n`;
    response += `• 📊 KPI explanations\n`;
    response += `• 🔍 Procurement insights\n\n`;
  }

  response += `_💡 Connect OpenAI API key for full natural language chat capabilities._`;

  return {
    response,
    model: 'offline',
    tokensUsed: 0,
  };
}

module.exports = {
  buildContext,
  chat,
  chatWithHistory,
  analyzeAnomalies,
  generateFormulaPrompt,
  generateEmailPrompt,
  explainKPIChange,
  offlineFallback,
};
