export async function getThemeConfig() {
  const response = await fetch("/api/theme-config", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function saveThemeConfig(theme) {
  const response = await fetch("/api/theme-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(theme)
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export function applyTheme(theme = {}) {
  const root = document.documentElement;
  const values = {
    "--bg": theme.background,
    "--panel": theme.panel,
    "--ink": theme.text,
    "--muted": theme.muted,
    "--green": theme.primary,
    "--accent": theme.primary,
    "--cyan": theme.accent
  };
  Object.entries(values).forEach(([property, value]) => {
    if (/^#[0-9a-f]{6}$/i.test(String(value || ""))) root.style.setProperty(property, value);
  });
}

async function readError(response) {
  return (await response.text()).trim() || `Theme service returned ${response.status}`;
}
