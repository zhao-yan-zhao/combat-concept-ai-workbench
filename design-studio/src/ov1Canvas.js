/** Re-export shared free-canvas geometry for design-studio modules. */
export {
  OV1_WORLD_SCALE,
  OV1_VIEWPORT_PCT,
  OV1_WORLD_MIN,
  OV1_WORLD_MAX,
  OV1_COORD_MIN,
  OV1_COORD_MAX,
  OV1_CONTENT_PAD,
  OV1_HOME_MIN,
  OV1_HOME_MAX,
  ov1WorldCssSize,
  computeOv1WorldBounds,
  logicalToWorldCss,
  viewportLayoutToWorld,
  viewportLayoutToWorldPercent,
  normalizeWorldPosition,
  repairLegacyCompressedOv1Nodes
} from "../../shared/ov1Canvas.js";
