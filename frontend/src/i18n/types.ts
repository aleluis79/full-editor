/**
 * Type augmentation for react-i18next.
 *
 * This enables compile-time type checking for all translation keys
 * used via t('ns:key') — the TypeScript compiler will error on
 * missing keys or incorrect namespaces.
 */
import 'react-i18next';

import enCommon from './locales/en/common.json';
import enToolbar from './locales/en/toolbar.json';
import enDocument from './locales/en/document.json';
import enShare from './locales/en/share.json';
import enComments from './locales/en/comments.json';
import enErrors from './locales/en/errors.json';
import enLogin from './locales/en/login.json';
import enPage from './locales/en/page.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      toolbar: typeof enToolbar;
      document: typeof enDocument;
      share: typeof enShare;
      comments: typeof enComments;
      errors: typeof enErrors;
      login: typeof enLogin;
      page: typeof enPage;
    };
  }
}
