import { createQuantitativeSettings } from "./schemeScoring.js";

const STORAGE_KEY = "concept-studio-quantitative-comparison-v1";

export function loadQuantitativeComparisonSettings() {
  try {
    return createQuantitativeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch {
    return createQuantitativeSettings();
  }
}

export function saveQuantitativeComparisonSettings(value) {
  const settings = createQuantitativeSettings(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  return settings;
}

export function updateComparisonWeights(settings, values) {
  return saveQuantitativeComparisonSettings({ ...settings, weights: values });
}

export function updateManualScores(settings, snapshotId, values) {
  return updateManualReview(settings, snapshotId, values);
}

export function updateManualReview(settings, snapshotId, values, rationales = {}) {
  const current = settings?.manualScores || {};
  const currentRationales = settings?.manualRationales || {};
  return saveQuantitativeComparisonSettings({
    ...settings,
    manualScores: { ...current, [snapshotId]: values },
    manualRationales: { ...currentRationales, [snapshotId]: rationales }
  });
}
