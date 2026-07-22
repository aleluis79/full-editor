/**
 * i18n initialization for Full Editor.
 *
 * Bundles all translation JSON files at build time — no runtime HTTP fetching.
 * Language detection chain: localStorage → navigator.language → 'en' fallback.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enToolbar from './locales/en/toolbar.json';
import enDocument from './locales/en/document.json';
import enShare from './locales/en/share.json';
import enComments from './locales/en/comments.json';
import enErrors from './locales/en/errors.json';
import enLogin from './locales/en/login.json';
import enPage from './locales/en/page.json';

import esCommon from './locales/es/common.json';
import esToolbar from './locales/es/toolbar.json';
import esDocument from './locales/es/document.json';
import esShare from './locales/es/share.json';
import esComments from './locales/es/comments.json';
import esErrors from './locales/es/errors.json';
import esLogin from './locales/es/login.json';
import esPage from './locales/es/page.json';

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    resources: {
      en: {
        common: enCommon,
        toolbar: enToolbar,
        document: enDocument,
        share: enShare,
        comments: enComments,
        errors: enErrors,
        login: enLogin,
        page: enPage,
      },
      es: {
        common: esCommon,
        toolbar: esToolbar,
        document: esDocument,
        share: esShare,
        comments: esComments,
        errors: esErrors,
        login: esLogin,
        page: esPage,
      },
    },
    interpolation: {
      escapeValue: false, // React already escapes output
    },
  });

export default i18n;
