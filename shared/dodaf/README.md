# DoDAF 2.02 / DM2 operational subset

Shared schema and exchange helpers for OV-1 through OV-6c.

| Item | Value |
|---|---|
| Standard | DoDAF 2.02 Meta Model (DM2) operational subset |
| Profile | `operational-views` |
| Schema id | `dodaf-2.02-dm2-ov` |
| Schema version | `1` |
| JSON Schema | `schemas/architecture-exchange.schema.json` |
| XSD | `schemas/architecture-exchange.xsd` |
| XML namespace | `urn:combat-concept:dodaf-2.02-dm2-ov:1` |

## Product resources

| Product | Project resource key |
|---|---|
| OV-1 | `ov1` |
| OV-2 | `ov2` |
| OV-3 | `ov3` |
| OV-4 | `ov4` |
| OV-5a | `ov5a` |
| OV-5b | `ov5` |
| OV-6a | `ov6a` |
| OV-6b | `ov6b` |
| OV-6c | `ov6c` |
| ArchitectureDescription | `architecture` |

Each product payload includes DM2 `entities` / `relations` plus product-specific editable projections (`nodes`, `activities`, `exchanges`, …) for the workbench UI.

## Drafting component library

`drafting.js` defines industrial legend tokens (entity type → color/icon/shape; edge type → stroke/dash/marker). UI helpers live in `design-studio/src/dodafDraftingView.js`. Product legend sets cover OV-1～OV-6c.
