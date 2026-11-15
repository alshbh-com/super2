export type AppTheme = 'light' | 'high-contrast' | 'dark';

export const THEME_STORAGE_KEY = 'super-shipping-theme';

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent('app-theme-change', { detail: theme }));
}

export function getSavedAppTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'dark' || value === 'high-contrast' ? value : 'light';
}