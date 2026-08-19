export function createOv1bCanvasController() {
  return {
    bind(root = document) {
      root.querySelectorAll(".ov1b-decomposition-scroll").forEach((viewport) => {
        if (viewport.dataset.panBound === "1") return;
        viewport.dataset.panBound = "1";
        let drag = null;
        viewport.addEventListener("pointerdown", (event) => {
          if (event.button !== 0 || event.target.closest("button,input,select,textarea,.ov1b-parent-node,.ov1b-child-node")) return;
          drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
          viewport.setPointerCapture(event.pointerId);
          viewport.classList.add("is-panning");
          event.preventDefault();
        });
        viewport.addEventListener("pointermove", (event) => {
          if (!drag || drag.id !== event.pointerId) return;
          viewport.scrollLeft = drag.left - (event.clientX - drag.x);
          viewport.scrollTop = drag.top - (event.clientY - drag.y);
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
