'use client';

import { useEffect, useState } from 'react';

function applyTheme(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export default function DarkModeToggle(): JSX.Element {
  const [dark, setDark] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const isDark = saved ? saved === 'dark' : true;
    setDark(isDark);
    applyTheme(isDark);
  }, []);

  const toggle = (): void => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      type="button"
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      onClick={toggle}
      className="px-3 py-2 rounded-md hover:bg-slate-800/60"
      title={dark ? 'Dark mode aktif' : 'Light mode aktif'}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  );
}