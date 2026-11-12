/**
 * Browser tab title in one place: the brand sets the base title, features like the
 * Pomodoro timer can temporarily override it (e.g. "🍅 49:12 · Fokus").
 */
let base = document.title;
let override: string | null = null;

const apply = () => {
  document.title = override ?? base;
};

export const setBaseTitle = (title: string) => {
  base = title;
  apply();
};

export const setTitleOverride = (title: string | null) => {
  override = title;
  apply();
};
