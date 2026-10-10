/**
 * CuratorDesk — login + edit published memorabilia copy (auth cookie + CSRF).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMe,
  isBackendConfigured,
  listArtifacts,
  login,
  logout,
  resolveMediaUrl,
  updateArtifact,
  uploadArtifactModel,
} from '../lib/archiveApi'
import { t } from '../i18n'
import './CuratorDesk.css'

const EMPTY_FORM = {
  title: '',
  description: '',
  rd_code: '',
  owner_name: '',
  year: '',
  subtitle: '',
  icon: '',
  published: true,
}

function toForm(row) {
  if (!row) return { ...EMPTY_FORM }
  return {
    title: row.title || '',
    description: row.description || '',
    rd_code: row.rd_code || '',
    owner_name: row.owner_name || '',
    year: row.year || '',
    subtitle: row.subtitle || '',
    icon: row.icon || '',
    published: Boolean(row.published),
  }
}

export default function CuratorDesk({ language = 'English', onBack, darkMode }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('curator@example.com')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)

  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadingModel, setUploadingModel] = useState(false)

  const backendReady = isBackendConfigured()

  const refreshList = useCallback(async () => {
    const data = await listArtifacts({ search: '' })
    setRows(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    if (!backendReady) {
      setBooting(false)
      return undefined
    }
    let cancelled = false
    getMe()
      .then(async (me) => {
        if (cancelled) return
        setUser(me)
        await refreshList()
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [backendReady, refreshList])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.title, row.rd_code, row.owner_name, row.year, row.subtitle]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [query, rows])

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  )

  useEffect(() => {
    setForm(toForm(selected))
    setSaveMsg('')
    setSaveError('')
    setUploadMsg('')
    setUploadError('')
  }, [selected])

  const handleLogin = async (event) => {
    event.preventDefault()
    if (!backendReady) {
      setAuthError(t(language, 'curator.noApi'))
      return
    }
    setBusy(true)
    setAuthError('')
    try {
      const me = await login(email.trim(), password)
      setUser(me)
      setPassword('')
      try {
        await refreshList()
      } catch {
        // Session is valid; list can retry after cookie settle.
        setRows([])
      }
    } catch {
      setAuthError(t(language, 'curator.loginFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    try {
      await logout()
    } catch {
      // Clear local session even if network fails.
    } finally {
      setUser(null)
      setRows([])
      setSelectedId(null)
      setBusy(false)
    }
  }

  const onField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setSaveMsg('')
    setSaveError('')
    try {
      const updated = await updateArtifact(selectedId, {
        title: form.title.trim(),
        description: form.description,
        rd_code: form.rd_code.trim().toUpperCase(),
        owner_name: form.owner_name.trim(),
        year: form.year.trim(),
        subtitle: form.subtitle.trim(),
        icon: form.icon.trim() || '🏺',
        published: Boolean(form.published),
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setSaveMsg(t(language, 'curator.saved'))
    } catch {
      setSaveError(t(language, 'curator.saveFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleModelUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedId) return
    const name = String(file.name || '').toLowerCase()
    if (!name.endsWith('.glb')) {
      setUploadError(t(language, 'curator.modelType'))
      setUploadMsg('')
      return
    }
    if (file.size > 40 * 1024 * 1024) {
      setUploadError(t(language, 'curator.modelTooLarge'))
      setUploadMsg('')
      return
    }
    setUploadingModel(true)
    setUploadError('')
    setUploadMsg('')
    try {
      const updated = await uploadArtifactModel(selectedId, file)
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setUploadMsg(t(language, 'curator.modelSaved'))
    } catch {
      setUploadError(t(language, 'curator.modelFail'))
    } finally {
      setUploadingModel(false)
    }
  }

  const handleClearModel = async () => {
    if (!selectedId || !selected?.model_url) return
    setUploadingModel(true)
    setUploadError('')
    setUploadMsg('')
    try {
      const updated = await updateArtifact(selectedId, { model_url: '' })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setUploadMsg(t(language, 'curator.modelCleared'))
    } catch {
      setUploadError(t(language, 'curator.modelFail'))
    } finally {
      setUploadingModel(false)
    }
  }

  return (
    <div className={`curator-root${darkMode ? ' curator-dark' : ''}`}>
      <header className="curator-header">
        <button type="button" className="curator-back" onClick={onBack} aria-label={t(language, 'nav.back')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="curator-title">{t(language, 'curator.title')}</h1>
        {user ? (
          <button type="button" className="curator-text-btn" onClick={handleLogout} disabled={busy}>
            {t(language, 'curator.logout')}
          </button>
        ) : (
          <span className="curator-header-spacer" />
        )}
      </header>

      {!backendReady ? (
        <p className="curator-banner">{t(language, 'curator.noApi')}</p>
      ) : null}

      {booting ? (
        <p className="curator-muted">{t(language, 'curator.checking')}</p>
      ) : !user ? (
        <form className="curator-login" onSubmit={handleLogin}>
          <p className="curator-lead">{t(language, 'curator.lead')}</p>
          <label className="curator-label">
            {t(language, 'curator.email')}
            <input
              className="curator-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="curator-label">
            {t(language, 'curator.password')}
            <input
              className="curator-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={10}
              required
            />
          </label>
          {authError ? <p className="curator-error">{authError}</p> : null}
          <button type="submit" className="curator-primary" disabled={busy || !backendReady}>
            {busy ? t(language, 'curator.signingIn') : t(language, 'curator.signIn')}
          </button>
          <p className="curator-hint">{t(language, 'curator.hint')}</p>
        </form>
      ) : (
        <div className="curator-workspace">
          <aside className="curator-list-pane">
            <div className="curator-userline">
              {t(language, 'curator.signedIn')} <strong>{user.email}</strong> ({user.role})
            </div>
            <input
              className="curator-input"
              type="search"
              placeholder={t(language, 'curator.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="curator-list">
              {filtered.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`curator-list-item${selectedId === row.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="curator-list-code">{row.rd_code || '—'}</span>
                    <span className="curator-list-name">{row.title}</span>
                    {!row.published ? <span className="curator-pill">{t(language, 'curator.hidden')}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="curator-edit-pane">
            {!selected ? (
              <p className="curator-muted">{t(language, 'curator.select')}</p>
            ) : (
              <form className="curator-form" onSubmit={handleSave}>
                <label className="curator-label">
                  {t(language, 'curator.field.title')}
                  <input className="curator-input" value={form.title} onChange={onField('title')} required maxLength={200} />
                </label>
                <label className="curator-label">
                  {t(language, 'curator.field.rd')}
                  <input className="curator-input" value={form.rd_code} onChange={onField('rd_code')} maxLength={32} />
                </label>
                <label className="curator-label">
                  {t(language, 'curator.field.owner')}
                  <input className="curator-input" value={form.owner_name} onChange={onField('owner_name')} maxLength={200} />
                </label>
                <div className="curator-row">
                  <label className="curator-label">
                    {t(language, 'curator.field.year')}
                    <input className="curator-input" value={form.year} onChange={onField('year')} maxLength={32} />
                  </label>
                  <label className="curator-label">
                    {t(language, 'curator.field.icon')}
                    <input className="curator-input" value={form.icon} onChange={onField('icon')} maxLength={16} />
                  </label>
                </div>
                <label className="curator-label">
                  {t(language, 'curator.field.subtitle')}
                  <input className="curator-input" value={form.subtitle} onChange={onField('subtitle')} maxLength={200} />
                </label>
                <label className="curator-label">
                  {t(language, 'curator.field.description')}
                  <textarea
                    className="curator-textarea"
                    value={form.description}
                    onChange={onField('description')}
                    rows={8}
                    maxLength={5000}
                  />
                </label>

                <div className="curator-model-block">
                  <p className="curator-label">{t(language, 'curator.field.model')}</p>
                  <p className="curator-hint">{t(language, 'curator.modelHint')}</p>
                  {selected.model_url ? (
                    <p className="curator-model-current">
                      {t(language, 'curator.modelCurrent')}{' '}
                      <a
                        href={resolveMediaUrl(selected.model_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selected.model_url}
                      </a>
                    </p>
                  ) : (
                    <p className="curator-muted">{t(language, 'curator.modelNone')}</p>
                  )}
                  <div className="curator-model-actions">
                    <label className="curator-file-btn">
                      <input
                        type="file"
                        accept=".glb,model/gltf-binary"
                        onChange={handleModelUpload}
                        disabled={busy || uploadingModel}
                      />
                      {uploadingModel
                        ? t(language, 'curator.modelUploading')
                        : t(language, 'curator.modelUpload')}
                    </label>
                    {selected.model_url ? (
                      <button
                        type="button"
                        className="curator-text-btn"
                        onClick={handleClearModel}
                        disabled={busy || uploadingModel}
                      >
                        {t(language, 'curator.modelRemove')}
                      </button>
                    ) : null}
                  </div>
                  {uploadError ? <p className="curator-error">{uploadError}</p> : null}
                  {uploadMsg ? <p className="curator-ok">{uploadMsg}</p> : null}
                </div>

                <label className="curator-check">
                  <input type="checkbox" checked={form.published} onChange={onField('published')} />
                  {t(language, 'curator.published')}
                </label>
                {saveError ? <p className="curator-error">{saveError}</p> : null}
                {saveMsg ? <p className="curator-ok">{saveMsg}</p> : null}
                <button type="submit" className="curator-primary" disabled={busy || uploadingModel}>
                  {busy ? t(language, 'curator.saving') : t(language, 'curator.save')}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
