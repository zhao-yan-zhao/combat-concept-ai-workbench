/** DoDAF 2.02 / DM2 operational-view subset used by this workbench. */

export const DODAF_STANDARD = "DoDAF-2.02-DM2";
export const DODAF_PROFILE = "operational-views";
export const DODAF_SCHEMA = "dodaf-2.02-dm2-ov";
export const DODAF_SCHEMA_VERSION = 1;
export const DODAF_XML_NS = "urn:combat-concept:dodaf-2.02-dm2-ov:1";

/** DM2 entity types in the operational subset. */
export const DM2_ENTITY_TYPES = Object.freeze([
  "Activity",
  "Performer",
  "Organization",
  "PersonType",
  "System",
  "ResourceFlow",
  "Information",
  "Materiel",
  "Rule",
  "State",
  "Event",
  "Location",
  "Measure",
  "Condition",
  "Capability"
]);

/** DM2 / product relation types used across OV products. */
export const DM2_RELATION_TYPES = Object.freeze([
  "activityPartOfActivity",
  "activityPerformableByPerformer",
  "activityResourceOverlap",
  "beforeAfter",
  "resourceFlow",
  "needline",
  "responsibleFor",
  "superSubtype",
  "wholePart",
  "stateTransition",
  "eventTriggeredBy",
  "eventResultsIn",
  "ruleConstrains",
  "measures",
  "locatedAt",
  "relationship"
]);

export const OV_PRODUCTS = Object.freeze([
  "OV-1",
  "OV-2",
  "OV-3",
  "OV-4",
  "OV-5a",
  "OV-5b",
  "OV-6a",
  "OV-6b",
  "OV-6c"
]);

/** Resource keys stored on the project record. */
export const OV_RESOURCE_KEYS = Object.freeze([
  "ov1",
  "ov2",
  "ov3",
  "ov4",
  "ov5a",
  "ov5",
  "ov6a",
  "ov6b",
  "ov6c",
  "architecture"
]);

export const PRODUCT_BY_RESOURCE = Object.freeze({
  ov1: "OV-1",
  ov2: "OV-2",
  ov3: "OV-3",
  ov4: "OV-4",
  ov5a: "OV-5a",
  ov5: "OV-5b",
  ov6a: "OV-6a",
  ov6b: "OV-6b",
  ov6c: "OV-6c",
  architecture: "ArchitectureDescription"
});

export const RESOURCE_BY_PRODUCT = Object.freeze({
  "OV-1": "ov1",
  "OV-2": "ov2",
  "OV-3": "ov3",
  "OV-4": "ov4",
  "OV-5a": "ov5a",
  "OV-5b": "ov5",
  "OV-6a": "ov6a",
  "OV-6b": "ov6b",
  "OV-6c": "ov6c"
});

/** Map legacy OV-1 node kinds onto DM2 entity types. */
export const OV1_KIND_TO_DM2 = Object.freeze({
  equipment: "System",
  command: "Organization",
  action: "Activity",
  external: "Performer",
  environment: "Location",
  effect: "Measure",
  participant: "Performer"
});

export const DM2_TO_OV1_KIND = Object.freeze({
  System: "equipment",
  Organization: "command",
  Activity: "action",
  Performer: "participant",
  PersonType: "participant",
  Location: "environment",
  Measure: "effect",
  Capability: "effect"
});
