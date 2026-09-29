const CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="dialog"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(', ')

/** Window-level gameplay shortcuts must yield to controls, dialogs and browser shortcuts. */
export function isGameShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return false
  const target = event.target
  if (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest(CONTROL_SELECTOR)
  )
    return false
  return !globalThis.document?.querySelector?.('dialog[open], [role="dialog"][aria-modal="true"]')
}
