/**
 * Dependency Engine — Resolves cascading calculations between collections
 */

const { getIsFallbackMode, getLocalCollection, saveLocalCollection } = require('../config/db');
const models = require('../models/schemas');
const { calculateRow } = require('./calculationEngine');

// Database access helpers (aligned with api.js)
async function getCollectionData(collectionName) {
  if (getIsFallbackMode()) {
    return [...getLocalCollection(collectionName)];
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return [];
  return await Model.find({}).lean();
}

async function saveCollectionData(collectionName, data) {
  if (getIsFallbackMode()) {
    const col = getLocalCollection(collectionName);
    col.length = 0;
    col.push(...data);
    saveLocalCollection(collectionName);
    return;
  }
  const modelMap = {
    schedules: models.Schedule,
    costsavings: models.CostSaving,
    inventory: models.Inventory,
    vmiplanning: models.VmiPlanning,
    vmitracking: models.VmiTracking,
    buyers: models.Buyer,
    suppliers: models.Supplier,
    items: models.Item,
  };
  const Model = modelMap[collectionName.toLowerCase()];
  if (!Model) return;
  await Model.deleteMany({});
  if (data.length > 0) {
    await Model.insertMany(data);
  }
}

/**
 * Determines which collections need recalculation when a field in a collection changes
 */
function resolveDependencies(changedCollection, changedField) {
  const dependencies = [];
  const col = changedCollection.toLowerCase();

  // If inventory currentStock changes, it triggers vmiplanning stock updates
  if (col === 'inventory' && (changedField === 'currentStock' || !changedField)) {
    dependencies.push({
      targetCollection: 'vmiplanning',
      mapFunction: (invRow, vmiRow) => {
        if (invRow.itemCode && invRow.itemCode === vmiRow.itemCode) {
          vmiRow.stock = Number(invRow.currentStock) || 0;
          vmiRow.currentStock = Number(invRow.currentStock) || 0;
          return true;
        }
        return false;
      }
    });
  }

  // If vmiplanning vmiQty changes, it could cascade to vmitracking plannedVmi
  if (col === 'vmiplanning' && (changedField === 'vmiQty' || !changedField)) {
    dependencies.push({
      targetCollection: 'vmitracking',
      mapFunction: (vmiPlanRow, vmiTrackRow) => {
        if (vmiPlanRow.itemCode && vmiPlanRow.itemCode === vmiTrackRow.itemCode) {
          vmiTrackRow.plannedVmi = Number(vmiPlanRow.vmiQty) || 0;
          return true;
        }
        return false;
      }
    });
  }

  return dependencies;
}

/**
 * Cascades changes through the dependency graph
 * @param {string} triggerCollection - Collection that triggered the cascade
 * @param {Array} triggerData - Recalculated rows of the triggering collection
 * @param {object} io - Socket.IO instance to emit updates
 * @param {string} buyerId - Buyer filter context if any
 */
async function cascadeRecalculation(triggerCollection, triggerData, io, buyerId) {
  console.log(`🔗 Cascade recalculation triggered by [${triggerCollection}]`);
  
  // Save triggering collection data first
  await saveCollectionData(triggerCollection, triggerData);
  if (io) {
    io.emit('dataUpdate', { collection: triggerCollection, buyerId });
  }

  // Get dependencies
  const dependencies = resolveDependencies(triggerCollection);

  for (const dep of dependencies) {
    const targetCol = dep.targetCollection;
    console.log(`   └─ Cascading changes to target collection: [${targetCol}]`);

    // Load target collection data
    const targetData = await getCollectionData(targetCol);
    let updatedCount = 0;

    // Map changes
    const updatedTargetData = targetData.map(targetRow => {
      let isUpdated = false;
      for (const triggerRow of triggerData) {
        if (dep.mapFunction(triggerRow, targetRow)) {
          isUpdated = true;
        }
      }

      if (isUpdated) {
        updatedCount++;
        // Recalculate row in target collection after mapping changes
        return calculateRow(targetCol, targetRow);
      }
      return targetRow;
    });

    if (updatedCount > 0) {
      console.log(`   └─ Recalculated ${updatedCount} rows in [${targetCol}] due to dependency`);
      // Recursively save and cascade
      await cascadeRecalculation(targetCol, updatedTargetData, io, buyerId);
    }
  }
}

module.exports = {
  resolveDependencies,
  cascadeRecalculation,
};
