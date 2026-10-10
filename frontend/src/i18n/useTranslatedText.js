import { useEffect, useState } from 'react'
import { normalizeLanguage, translateDynamicText } from './index'

/**
 * Translate long English catalog copy when UI language is not English.
 * UI chrome should use `t()`; this is for artifact descriptions / historical text.
 */
export function useTranslatedText(text, language) {
  const source = typeof text === 'string' ? text : ''
  const lang = normalizeLanguage(language)
  const [value, setValue] = useState(source)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!source) {
      setValue('')
      setLoading(false)
      return undefined
    }
    if (lang === 'English') {
      setValue(source)
      setLoading(false)
      return undefined
    }

    setLoading(true)
    translateDynamicText(source, lang)
      .then((out) => {
        if (!cancelled) setValue(out || source)
      })
      .catch(() => {
        if (!cancelled) setValue(source)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [source, lang])

  return { text: value, loading }
}
