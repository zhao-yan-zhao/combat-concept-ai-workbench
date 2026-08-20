const listPreferences = new Map();

export function mountGroupedLists(root = document) {
  root.querySelectorAll("[data-grouped-list-panel]").forEach((panel) => mountGroupedList(panel));
}

function mountGroupedList(panel) {
  if (!(panel instanceof HTMLElement) || panel.dataset.groupedListMounted === "true") return;
  const list = panel.querySelector("[data-grouped-list-items]");
  if (!(list instanceof HTMLElement)) return;
  const items = [...list.querySelectorAll(":scope > [data-grouped-list-item]")];
  if (!items.length) return;

  const scope = panel.dataset.groupedListPanel || "default";
  const dimensions = parseDimensions(panel.dataset.groupedListDimensions);
  if (!dimensions.length) return;
  const defaults = {
    query: "",
    groupBy: panel.dataset.groupedListDefaultGroup || dimensions[0].key,
    filterField: "",
    filterValue: "",
    collapsedGroups: new Set()
  };
  const saved = listPreferences.get(scope);
  const state = {
    ...defaults,
    ...saved,
    collapsedGroups: new Set(saved?.collapsedGroups || [])
  };

  const controls = document.createElement("div");
  controls.className = "grouped-list-tools";
  controls.innerHTML = renderControls(dimensions);
  panel.insertBefore(controls, list);
  panel.dataset.groupedListMounted = "true";

  const searchInput = controls.querySelector("[data-grouped-list-search]");
  const groupSelect = controls.querySelector("[data-grouped-list-group]");
  const filterMenu = controls.querySelector("[data-grouped-list-filter-menu]");
  const filterField = controls.querySelector("[data-grouped-list-filter-field]");
  const filterValue = controls.querySelector("[data-grouped-list-filter-value]");
  const filterBadge = controls.querySelector("[data-grouped-list-filter-badge]");
  const activeSummary = controls.querySelector("[data-grouped-list-active-summary]");
  const activeText = controls.querySelector("[data-grouped-list-active-text]");
  const clearButtons = controls.querySelectorAll("[data-grouped-list-clear]");
  const resultCount = controls.querySelector("[data-grouped-list-count]");

  searchInput.value = state.query;
  groupSelect.value = dimensions.some((entry) => entry.key === state.groupBy) ? state.groupBy : "";
  filterField.value = dimensions.some((entry) => entry.key === state.filterField) ? state.filterField : "";

  const save = () => listPreferences.set(scope, {
    ...state,
    collapsedGroups: [...state.collapsedGroups]
  });

  const updateFilterValues = () => {
    const values = state.filterField
      ? unique(items.map((item) => fieldValue(item, state.filterField)))
      : [];
    filterValue.innerHTML = [
      '<option value="">全部</option>',
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    ].join("");
    if (!values.includes(state.filterValue)) state.filterValue = "";
    filterValue.value = state.filterValue;
    filterValue.disabled = !state.filterField;
  };

  const render = () => {
    updateFilterValues();
    const query = state.query.trim().toLocaleLowerCase();
    const visible = items.filter((item) => {
      if (state.filterField && state.filterValue && fieldValue(item, state.filterField) !== state.filterValue) return false;
      const haystack = item.dataset.search || item.textContent || "";
      return !query || haystack.toLocaleLowerCase().includes(query);
    });
    const groups = new Map();
    for (const item of visible) {
      const group = state.groupBy ? fieldValue(item, state.groupBy) : "全部数据";
      const label = group || "未分类";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(item);
    }

    list.querySelectorAll(":scope > .grouped-list-group-header, :scope > .grouped-list-empty").forEach((node) => node.remove());
    items.forEach((item) => { item.hidden = true; });
    if (!visible.length) {
      const empty = document.createElement(list.tagName === "UL" || list.tagName === "OL" ? "li" : "div");
      empty.className = "grouped-list-empty";
      empty.textContent = "当前条件下没有数据";
      list.appendChild(empty);
    } else {
      for (const [label, groupItems] of groups) {
        if (state.groupBy) {
          const header = document.createElement(list.tagName === "UL" || list.tagName === "OL" ? "li" : "div");
          const collapsed = state.collapsedGroups.has(label);
          header.className = "grouped-list-group-header";
          header.setAttribute("role", "presentation");
          header.innerHTML = `<button type="button" data-grouped-list-toggle="${escapeHtml(label)}" aria-expanded="${collapsed ? "false" : "true"}"><span>${escapeHtml(label)}</span><small>${groupItems.length}</small><i aria-hidden="true"></i></button>`;
          list.appendChild(header);
        }
        const collapsed = state.groupBy && state.collapsedGroups.has(label);
        groupItems.forEach((item) => {
          item.hidden = collapsed;
          list.appendChild(item);
        });
      }
    }

    const dimension = dimensions.find((entry) => entry.key === state.filterField);
    const hasFilter = Boolean(state.filterField);
    filterMenu.classList.toggle("is-active", hasFilter);
    filterBadge.textContent = state.filterValue ? "1" : "";
    activeSummary.hidden = !hasFilter;
    activeText.textContent = hasFilter ? `${dimension?.label || state.filterField}：${state.filterValue || "全部"}` : "";
    resultCount.textContent = `${visible.length}/${items.length}`;
    save();
  };

  searchInput.addEventListener("input", () => { state.query = searchInput.value; render(); });
  groupSelect.addEventListener("change", () => {
    state.groupBy = groupSelect.value;
    state.collapsedGroups.clear();
    render();
  });
  filterField.addEventListener("change", () => {
    state.filterField = filterField.value;
    state.filterValue = "";
    render();
  });
  filterValue.addEventListener("change", () => {
    state.filterValue = filterValue.value;
    filterMenu.open = false;
    render();
  });
  clearButtons.forEach((clearButton) => clearButton.addEventListener("click", () => {
    state.filterField = "";
    state.filterValue = "";
    filterField.value = "";
    filterMenu.open = false;
    render();
  }));
  list.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-grouped-list-toggle]");
    if (!toggle) return;
    const label = toggle.dataset.groupedListToggle;
    if (state.collapsedGroups.has(label)) state.collapsedGroups.delete(label);
    else state.collapsedGroups.add(label);
    render();
  });

  render();
}

function renderControls(dimensions) {
  const options = dimensions.map((entry) => `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.label)}</option>`).join("");
  return `<label class="grouped-list-search"><span>搜索列表</span><input type="search" data-grouped-list-search placeholder="搜索名称、编号或说明" autocomplete="off"></label>
    <div class="grouped-list-tool-row">
      <label class="grouped-list-group-control"><span>分组</span><select data-grouped-list-group><option value="">不分组</option>${options}</select></label>
      <details class="grouped-list-filter-menu" data-grouped-list-filter-menu>
        <summary>筛选 <span data-grouped-list-filter-badge></span></summary>
        <div class="grouped-list-filter-popover">
          <label><span>字段</span><select data-grouped-list-filter-field><option value="">不筛选</option>${options}</select></label>
          <label><span>条件</span><select data-grouped-list-filter-value disabled><option value="">全部</option></select></label>
          <button type="button" class="quiet-button" data-grouped-list-clear>清除筛选</button>
        </div>
      </details>
    </div>
    <div class="grouped-list-active-summary" data-grouped-list-active-summary hidden><span data-grouped-list-active-text></span><button type="button" data-grouped-list-clear title="清除筛选" aria-label="清除筛选">×</button></div>
    <div class="grouped-list-result"><span>可见数据</span><strong data-grouped-list-count>0/0</strong></div>`;
}

function parseDimensions(value = "") {
  return String(value).split("|").map((entry) => {
    const [label, key] = entry.split(":");
    return { label: String(label || "").trim(), key: String(key || "").trim() };
  }).filter((entry) => entry.label && entry.key);
}

function fieldValue(item, key) {
  return String(item.getAttribute(`data-group-${key}`) || "").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
