import { createRoot } from 'react-dom/client'

import { I18nProvider, LanguagePicker, useI18n } from '../../src/react.ts'

function App({ review }: { review: boolean }) {
  const { t, dir, format } = useI18n()
  return (
    <main>
      <LanguagePicker review={review} />
      <h1>{t('Welcome')}</h1>
      <p id="range">{t('Prefill at {range} tokens a second', { range: '1,150–1,400' })}</p>
      <p id="terms">{t('Read the {terms}.', { terms: <a href="/terms">{t('Terms')}</a> })}</p>
      <p id="count">{format.number(1234567)}</p>
      <p id="total">{t('Total: {amount}', { amount: format.money(1234.5, 'USD') })}</p>
      <p id="names">{t('Built with {names}', { names: format.list(['Chat', 'Dev', 'Kai']) })}</p>
      <p id="when">{format.relative(Date.now() - 3 * 60000)}</p>
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
        return {
          Welcome: 'مرحبًا',
          Settings: 'الإعدادات',
          Language: 'اللغة',
          'Prefill at {range} tokens a second': 'ملء مسبق بسرعة {range} رمز في الثانية',
          'Read the {terms}.': 'اقرأ {terms}.',
          Terms: 'الشروط',
          'Total: {amount}': 'المجموع: {amount}',
          'Built with {names}': 'مبني باستخدام {names}',
        }
      }
      return { Welcome: `Welcome:${code}` }
    }}
  >
    <App review={params.has('review')} />
  </I18nProvider>,
)
