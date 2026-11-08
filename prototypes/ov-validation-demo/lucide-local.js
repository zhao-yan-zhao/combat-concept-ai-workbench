// 本地离线 Lucide 图标降级实现，避免对 unpkg.com 的外部网络依赖
(function () {
  window.lucide = {
    createIcons: function () {
      // 离线无外部依赖环境下将 data-lucide 元素平稳渲染为轻量矢量图标占位
      document.querySelectorAll("[data-lucide]").forEach(function (el) {
        if (el.tagName.toLowerCase() === "i" && !el.hasAttribute("data-rendered")) {
          el.setAttribute("data-rendered", "true");
          el.style.display = "inline-block";
          el.style.width = "1em";
          el.style.height = "1em";
        }
      });
    }
  };
})();
