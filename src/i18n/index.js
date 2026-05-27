import en from './en.js';
import zhCN from './zh-CN.js';

const locales = { en, 'zh-CN': zhCN };
let current = localStorage.getItem('cube-lang') || 'zh-CN';

export function t(key) {
  return locales[current]?.[key] ?? locales.en[key] ?? key;
}

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (locales[lang]) {
    current = lang;
    localStorage.setItem('cube-lang', lang);
  }
}

export function toggleLang() {
  setLang(current === 'zh-CN' ? 'en' : 'zh-CN');
  return current;
}
