import { saveConceptBrief } from "./briefStore.js";
import { saveSelectedDirection } from "./directionProposalStore.js";
import { saveInspirationSession } from "./inspirationStore.js";
import { persistOodaModel } from "./oodaStore.js";
import { saveOv1Model } from "./ov1Store.js";
import { persistOv5Model } from "./ov5Store.js";
import { clearScenario, persistScenario } from "./scenarioStore.js";
import { clearValidation, persistValidation } from "./validationStore.js";
import { saveLocalDodafProduct } from "./dodafProductStore.js";

const DODAF_OPTIONAL = ["ov2", "ov3", "ov4", "ov5a", "ov6a", "ov6b", "ov6c", "architecture"];

export function restoreModelSnapshot(snapshot, { briefSeed, projectId = "default" } = {}) {
  if (!snapshot?.model) throw new Error("Model snapshot is unavailable");

  const model = clone(snapshot.model);
  const brief = saveConceptBrief(model.brief || {}, briefSeed);
  const inspiration = model.inspiration ? saveInspirationSession(model.inspiration) : null;
  const ov1 = saveOv1Model(model.ov1 || {});
  const ov5 = model.ov5 || { version: 1, activities: [], edges: [] };
  const ooda = model.ooda || { version: 1, sourceActivityIds: [], lanes: [] };

  persistOv5Model(ov5);
  persistOodaModel(ooda);

  if (model.scenario) persistScenario(model.scenario);
  else clearScenario();

  if (model.validation) persistValidation(model.validation);
  else clearValidation();

  const dodaf = {};
  for (const key of DODAF_OPTIONAL) {
    if (model[key] && typeof model[key] === "object") {
      try {
        dodaf[key] = key === "architecture"
          ? clone(model[key])
          : saveLocalDodafProduct(key, model[key], projectId);
      } catch {
        dodaf[key] = clone(model[key]);
      }
    } else {
      dodaf[key] = null;
    }
  }

  return {
    direction: saveSelectedDirection(snapshot.direction),
    brief,
    inspiration,
    ov1,
    ov5,
    ooda,
    scenario: model.scenario || null,
    validationResult: model.validation || null,
    ...dodaf
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
