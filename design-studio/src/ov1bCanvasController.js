const cameraByTaskGroup = new Map();
const zoomByTaskGroup = new Map();
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
const ZOOM_STEP = 0.1;

export function createOv1bCanvasController() {
  return {
    bind(root = document) {
      root.querySelectorAll(".ov1b-canvas-viewport").forEach((viewport) => {
        if (viewport.dataset.panBound === "1") return;
        viewport.dataset.panBound = "1";
        const cameraKey = viewport.dataset.taskGroupId || "default";
        const stage = viewport.querySelector(".ov1b-canvas-stage");
        const panel = viewport.closest(".ov1b-organization-canvas");
        const zoomLabel = panel?.querySelector("[data-ov1b-zoom-label]");
        let drag = null;
        let zoom = zoomByTaskGroup.get(cameraKey) || 1;
        const applyZoom = (nextZoom, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) => {
          if (!stage) return;
          zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoom * 100) / 100));
          stage.style.transformOrigin = "center top";
          stage.style.transform = `scale(${zoom})`;
          zoomByTaskGroup.set(cameraKey, zoom);
          zoomLabel && (zoomLabel.textContent = `${Math.round(zoom * 100)}%`);
          requestAnimationFrame(saveCamera);
        };
        const fitCanvas = () => {
          if (!stage) return;
          stage.style.transform = "scale(1)";
          const next = Math.min(1, (viewport.clientWidth - 32) / stage.offsetWidth, (viewport.clientHeight - 32) / stage.offsetHeight);
          zoom = 1;
          applyZoom(next);
          requestAnimationFrame(() => {
            viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
            viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
          });
        };
        requestAnimationFrame(() => {
          applyZoom(zoom);
          const saved = cameraByTaskGroup.get(cameraKey);
          viewport.scrollLeft = saved?.left ?? Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
          viewport.scrollTop = saved?.top ?? Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
        });
        const saveCamera = () => cameraByTaskGroup.set(cameraKey, { left: viewport.scrollLeft, top: viewport.scrollTop });
        viewport.addEventListener("scroll", saveCamera, { passive: true });
        viewport.addEventListener("wheel", (event) => {
          event.preventDefault();
          const rect = viewport.getBoundingClientRect();
          applyZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        panel?.querySelectorAll("[data-ov1b-zoom]").forEach((button) => {
          if (button.dataset.zoomBound === "1") return;
          button.dataset.zoomBound = "1";
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            const action = button.dataset.ov1bZoom;
            if (action === "fit") fitCanvas();
            else applyZoom(zoom + (action === "in" ? ZOOM_STEP : -ZOOM_STEP));
          });
        });
        viewport.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.target.closest("button,input,select,textarea,.ov1b-group-node,.ov1b-canvas-task-node")) return;
          drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
          viewport.setPointerCapture(event.pointerId);
          viewport.classList.add("is-panning");
          event.preventDefault();
        });
        viewport.addEventListener("pointermove", (event) => {
          if (!drag || drag.id !== event.pointerId) return;
          viewport.scrollLeft = drag.left - (event.clientX - drag.x);
          viewport.scrollTop = drag.top - (event.clientY - drag.y);
          saveCamera();
        });
        const finish = (event) => {
          if (!drag || drag.id !== event.pointerId) return;
          drag = null;
          viewport.classList.remove("is-panning");
          if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        };
        viewport.addEventListener("pointerup", finish);
        viewport.addEventListener("pointercancel", finish);
      });
    }
  };
}
