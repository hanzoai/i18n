import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { Document, props } from './document.ts'

const failures: string[] = ((window as unknown as { recoverable: string[] }).recoverable = [])
hydrateRoot(document, createElement(Document, props(location.href)), {
  onRecoverableError: (error) => failures.push(String(error)),
})
