import { createRoot } from 'react-dom/client'

import { I18nProvider, LanguagePicker, useI18n } from '../../src/react.ts'

function App({ review }: { review: boolean }) {
  const { t, dir } = useI18n()
  return (
    <main>
      <LanguagePicker review={review} />
      <h1>{t('Welcome')}</h1>
      <aside data-side={dir === 'rtl' ? 'right' : 'left'}>{t('Settings')}</aside>
      <code>hanzo status</code>
      <span id="plain" data-i18n-mirror>→</span>
      <section dir="rtl">
        <code id="inner">hanzo status</code>
        <span id="mirrored" data-i18n-mirror>→</span>
      </section>
    </main>
  )
}

const params = new URL(location.href).searchParams
const user = params.get('user')

createRoot(document.getElementById('root')!).render(
  <I18nProvider
    userId={user === 'guest' ? null : user ?? 'alice'}
    loadCatalog={async (code) => {
      if (code === 'fr-FR') {
        throw new Error('test network error')
      }
      if (code === 'ar' || code.startsWith('ar-')) {
        return { Welcome: 'مرحبًا', Settings: 'الإعدادات', Language: 'اللغة' }
      }
      return { Welcome: `Welcome:${code}` }
    }}
  >
    <App review={params.has('review')} />
  </I18nProvider>,
)
