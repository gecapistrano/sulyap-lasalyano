'use client'

/**
 * CuratorDesk — manage Sulyap Lasalyano Artifacts + DLSU Presidents (auth cookie + CSRF).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createArtifact,
  createPresident,
  deleteArtifact,
  deletePresident,
  getMe,
  isBackendConfigured,
  listArtifacts,
  listPresidentsAdmin,
  llmApply,
  llmSuggest,
  login,
  logout,
  updateArtifact,
  updatePresident,
  uploadArtifactModel,
  uploadArtifactPhoto,
} from '../lib/archiveApi'
import { env, goToStaticHome } from '../config/env'
import { t } from '../i18n'
import './CuratorDesk.css'

const EMPTY_ARTIFACT = {
  title: '',
  description: '',
  id_code: '',
  owner_name: '',
  president_id: null,
  year_acquired: '',
  country_of_origin: '',
  artifact_type: '',
  subtitle: '',
  icon: '🏺',
  remarks: '',
  published: true,
  llm_assist_enabled: false,
  tags: [],
}

const EMPTY_PRESIDENT = {
  name: '',
  service: '',
  icon: '👤',
  biography: '',
  photo_url: '',
  published: true,
}

const EDITOR_SECTIONS = [
  { id: 'record', labelKey: 'curator.section.record' },
  { id: 'catalog', labelKey: 'curator.section.catalog' },
  { id: 'media', labelKey: 'curator.section.media' },
  { id: 'assist', labelKey: 'curator.section.assist' },
]

function tagsFromRow(row) {
  if (!row || !Array.isArray(row.tags)) return []
  const seen = new Set()
  const out = []
  for (const item of row.tags) {
    const label = typeof item === 'string' ? item.trim() : String(item?.label || '').trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out
}

function resolvePresidentId(row, presidents = []) {
  const rawId = row?.president_id
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return rawId
  const name = String(row?.owner_name || '')
    .trim()
    .toLowerCase()
  if (!name || !Array.isArray(presidents)) return null
  const match = presidents.find((p) => String(p.name || '').trim().toLowerCase() === name)
  return match?.id ?? null
}

function artifactToForm(row, presidents = []) {
  if (!row) return { ...EMPTY_ARTIFACT, tags: [] }
  const presidentId = resolvePresidentId(row, presidents)
  const matched = presidents.find((p) => p.id === presidentId)
  return {
    title: row.title || '',
    description: row.description || '',
    id_code: row.id_code || row.rd_code || '',
    owner_name: matched?.name || row.owner_name || '',
    president_id: presidentId,
    year_acquired: row.year_acquired || row.year || '',
    country_of_origin: row.country_of_origin || '',
    artifact_type: row.artifact_type || '',
    subtitle: row.subtitle || '',
    icon: row.icon || '🏺',
    remarks: row.remarks || '',
    published: Boolean(row.published),
    llm_assist_enabled: Boolean(row.llm_assist_enabled),
    tags: tagsFromRow(row),
  }
}

/** Auth-gated curator photo (cookies required; plain <img> often fails cross-port). */
function CuratorPhoto({ artifactId, imageUrl, language = 'English' }) {
  const [src, setSrc] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setSrc('')
    setMissing(false)
    const url = typeof imageUrl === 'string' ? imageUrl.trim() : ''
    if (!url || !artifactId) {
      setMissing(true)
      return undefined
    }
    if (url.startsWith('http') && !url.includes('/curator-media/') && !url.includes('/artifacts/')) {
      setSrc(url)
      return undefined
    }
    const endpoint = `${env.apiBaseUrl}/artifacts/${artifactId}/photo`
    fetch(endpoint, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('photo missing')
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [artifactId, imageUrl])

  if (missing) {
    return (
      <div className="curator-photo-empty" aria-hidden>
        <span>{t(language, 'curator.noPhoto')}</span>
      </div>
    )
  }
  if (!src) {
    return (
      <div className="curator-photo-empty">
        <span>{t(language, 'curator.loading')}</span>
      </div>
    )
  }
  return <img className="curator-photo-preview" src={src} alt={t(language, 'curator.photoAlt')} />
}

export default function CuratorDesk({ language = 'English' }) {
  const handleBack = useCallback(() => {
    /* Always leave Next for the static sulyap-lasalyano home (not in-app home). */
    goToStaticHome()
  }, [])

  const [tab, setTab] = useState('artifacts')
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('admin')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)
  const [booting, setBooting] = useState(true)

  const [rows, setRows] = useState([])
  const [presidents, setPresidents] = useState([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedPresidentId, setSelectedPresidentId] = useState(null)
  const [form, setForm] = useState(EMPTY_ARTIFACT)
  const [presidentForm, setPresidentForm] = useState(EMPTY_PRESIDENT)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [tagDraft, setTagDraft] = useState('')
  /** Accordion: which president group is open (null = all collapsed). */
  const [openPresident, setOpenPresident] = useState(null)
  const [focusPresident, setFocusPresident] = useState('')
  const [editorSection, setEditorSection] = useState('record')
  const [mobilePane, setMobilePane] = useState('list')

  const backendReady = isBackendConfigured()

  const addTag = useCallback((raw) => {
    const label = String(raw ?? '').trim()
    if (!label) return
    setForm((prev) => {
      const exists = prev.tags.some((tag) => tag.toLowerCase() === label.toLowerCase())
      if (exists) return prev
      return { ...prev, tags: [...prev.tags, label] }
    })
    setTagDraft('')
  }, [])

  const removeTag = useCallback((label) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag.toLowerCase() !== String(label).toLowerCase()),
    }))
  }, [])

  const refreshList = useCallback(async () => {
    const [arts, prez] = await Promise.all([listArtifacts({ search: '' }), listPresidentsAdmin()])
    setRows(Array.isArray(arts) ? arts : [])
    setPresidents(Array.isArray(prez) ? prez : [])
  }, [])

  useEffect(() => {
    if (!backendReady) {
      setBooting(false)
      return undefined
    }
    let cancelled = false
    getMe()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setBooting(false)
        return refreshList()
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
          setBooting(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [backendReady, refreshList])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows
    if (focusPresident) {
      list = list.filter((row) => {
        const name = String(row.owner_name || '').trim() || 'Unassigned'
        return name === focusPresident
      })
    }
    if (!q) return list
    return list.filter((row) =>
      [row.title, row.id_code, row.rd_code, row.owner_name, row.year_acquired, row.year, row.subtitle, row.artifact_type]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [query, rows, focusPresident])

  const artifactsByPresident = useMemo(() => {
    const order = presidents.map((p) => p.name)
    const serviceByName = Object.fromEntries(presidents.map((p) => [p.name, p.service || '']))
    const buckets = new Map()
    for (const row of filtered) {
      const name = String(row.owner_name || '').trim() || 'Unassigned'
      if (!buckets.has(name)) buckets.set(name, [])
      buckets.get(name).push(row)
    }
    for (const list of buckets.values()) {
      list.sort((a, b) =>
        String(a.id_code || a.rd_code || '').localeCompare(String(b.id_code || b.rd_code || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      )
    }
    const names = [...buckets.keys()].sort((a, b) => {
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    return names.map((name) => ({
      name,
      service: serviceByName[name] || '',
      items: buckets.get(name) || [],
    }))
  }, [filtered, presidents])

  const presidentFilterOptions = useMemo(() => {
    const order = presidents.map((p) => p.name)
    const names = new Set(rows.map((row) => String(row.owner_name || '').trim() || 'Unassigned'))
    return [...names].sort((a, b) => {
      if (a === 'Unassigned') return 1
      if (b === 'Unassigned') return -1
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [rows, presidents])

  const togglePresidentGroup = useCallback((name) => {
    setOpenPresident((prev) => (prev === name ? null : name))
  }, [])

  const selectArtifact = useCallback((id) => {
    setSelectedId(id)
    setEditorSection('record')
    setMobilePane('editor')
    const row = rows.find((r) => r.id === id)
    if (row) {
      const name = String(row.owner_name || '').trim() || 'Unassigned'
      setOpenPresident(name)
    }
  }, [rows])

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? null, [rows, selectedId])
  const selectedPresident = useMemo(
    () => presidents.find((p) => p.id === selectedPresidentId) ?? null,
    [presidents, selectedPresidentId],
  )

  useEffect(() => {
    setForm(artifactToForm(selected, presidents))
    setAiSuggestion(null)
    setSaveMsg('')
    setSaveError('')
    setUploadMsg('')
    setUploadError('')
  }, [selected, presidents])

  useEffect(() => {
    if (!selectedPresident) {
      setPresidentForm(EMPTY_PRESIDENT)
      return
    }
    setPresidentForm({
      name: selectedPresident.name || '',
      service: selectedPresident.service || '',
      icon: selectedPresident.icon || '👤',
      biography: selectedPresident.biography || '',
      photo_url: selectedPresident.photo_url || '',
      published: Boolean(selectedPresident.published),
    })
  }, [selectedPresident])

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
      setBusy(false)
      await refreshList()
    } catch {
      setAuthError(t(language, 'curator.loginFail'))
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    try {
      await logout()
    } catch {
      /* ignore */
    } finally {
      setUser(null)
      setRows([])
      setPresidents([])
      setSelectedId(null)
      setBusy(false)
    }
  }

  const onField = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveArtifact = async (event) => {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setSaveMsg('')
    setSaveError('')
    try {
      const updated = await updateArtifact(selectedId, {
        title: form.title.trim(),
        description: form.description,
        id_code: form.id_code.trim(),
        owner_name: form.owner_name.trim(),
        president_id: form.president_id,
        year_acquired: form.year_acquired.trim(),
        country_of_origin: form.country_of_origin.trim(),
        artifact_type: form.artifact_type.trim(),
        subtitle: form.subtitle.trim(),
        icon: form.icon.trim() || '🏺',
        remarks: form.remarks,
        published: Boolean(form.published),
        llm_assist_enabled: Boolean(form.llm_assist_enabled),
        tags: form.tags,
      })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setForm(artifactToForm(updated, presidents))
      setSaveMsg(t(language, 'curator.saved'))
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : ''
      setSaveError(msg || t(language, 'curator.saveFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleCreateArtifact = async () => {
    setBusy(true)
    setSaveError('')
    try {
      const created = await createArtifact({
        title: '',
        description: '',
        id_code: '',
        owner_name: focusPresident && focusPresident !== 'Unassigned' ? focusPresident : '',
        published: false,
        image_url: 'https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png',
      })
      await refreshList()
      selectArtifact(created.id)
      setSaveMsg(t(language, 'curator.createdDraft'))
    } catch {
      setSaveError(t(language, 'curator.createFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteArtifact = async () => {
    if (!selectedId || !window.confirm(t(language, 'curator.deleteConfirm'))) return
    setBusy(true)
    try {
      await deleteArtifact(selectedId)
      setSelectedId(null)
      setMobilePane('list')
      await refreshList()
    } catch {
      setSaveError(t(language, 'curator.deleteFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleModelUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedId) return
    const name = String(file.name || '').toLowerCase()
    if (!name.endsWith('.glb') && !name.endsWith('.obj')) {
      setUploadError(t(language, 'curator.modelTypeObj'))
      return
    }
    setBusy(true)
    try {
      const updated = await uploadArtifactModel(selectedId, file)
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setUploadMsg(t(language, 'curator.modelSaved'))
    } catch {
      setUploadError(t(language, 'curator.modelFail'))
    } finally {
      setBusy(false)
    }
  }

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedId) return
    setBusy(true)
    try {
      const updated = await uploadArtifactPhoto(selectedId, file)
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setUploadMsg(t(language, 'curator.photoSaved'))
    } catch {
      setUploadError(t(language, 'curator.photoFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveModel = async () => {
    if (!selectedId || !selected?.model_url) return
    if (!window.confirm(t(language, 'curator.modelRemoveConfirm'))) return
    setBusy(true)
    setUploadMsg('')
    setUploadError('')
    try {
      const updated = await updateArtifact(selectedId, { model_url: '' })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setUploadMsg(t(language, 'curator.modelCleared'))
    } catch {
      setUploadError(t(language, 'curator.modelFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleAiSuggest = async () => {
    if (!selectedId) return
    setBusy(true)
    setSaveError('')
    try {
      if (!form.llm_assist_enabled) {
        await updateArtifact(selectedId, { llm_assist_enabled: true })
        setForm((f) => ({ ...f, llm_assist_enabled: true }))
      }
      const suggestion = await llmSuggest(selectedId)
      setAiSuggestion(suggestion)
    } catch {
      setSaveError(t(language, 'curator.aiUnavailable'))
    } finally {
      setBusy(false)
    }
  }

  const handleAiAccept = async () => {
    if (!selectedId || !aiSuggestion) return
    setBusy(true)
    try {
      const updated = await llmApply(selectedId, { ...aiSuggestion, replace_existing: false })
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
      setForm(artifactToForm(updated, presidents))
      setAiSuggestion(null)
      setSaveMsg(t(language, 'curator.aiApplied'))
    } catch {
      setSaveError(t(language, 'curator.aiFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleSavePresident = async (event) => {
    event.preventDefault()
    if (!selectedPresidentId) return
    setBusy(true)
    try {
      const updated = await updatePresident(selectedPresidentId, {
        name: presidentForm.name.trim(),
        service: presidentForm.service.trim(),
        icon: presidentForm.icon.trim() || '👤',
        biography: presidentForm.biography,
        photo_url: presidentForm.photo_url.trim(),
        published: Boolean(presidentForm.published),
      })
      setPresidents((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setSaveMsg(t(language, 'curator.saved'))
    } catch {
      setSaveError(t(language, 'curator.saveFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleCreatePresident = async () => {
    setBusy(true)
    try {
      const created = await createPresident({
        name: t(language, 'curator.newPresident', { n: presidents.length + 1 }),
        service: '',
        published: false,
      })
      await refreshList()
      setSelectedPresidentId(created.id)
      setTab('presidents')
      setMobilePane('editor')
    } catch {
      setSaveError(t(language, 'curator.presidentCreateFail'))
    } finally {
      setBusy(false)
    }
  }

  const handleDeletePresident = async () => {
    if (!selectedPresidentId || !window.confirm(t(language, 'curator.deletePresidentConfirm'))) return
    setBusy(true)
    setSaveError('')
    try {
      await deletePresident(selectedPresidentId)
      setSelectedPresidentId(null)
      setMobilePane('list')
      await refreshList()
    } catch {
      setSaveError(t(language, 'curator.presidentDeleteFail'))
    } finally {
      setBusy(false)
    }
  }

  const selectPresident = (id) => {
    setSelectedPresidentId(id)
    setMobilePane('editor')
  }

  return (
    <div className={`curator-root curator-dark${user ? ' is-authed' : ''}`}>
      <header className="curator-header">
        <button type="button" className="curator-back" onClick={handleBack} aria-label={t(language, 'nav.back')}>
          ← Back
        </button>
        <div className="curator-header-main">
          <h1 className="curator-title">{t(language, 'curator.title')}</h1>
          {user ? (
            <nav className="curator-tabs" aria-label={t(language, 'curator.sectionsAria')}>
              <button
                type="button"
                className={`curator-tab${tab === 'artifacts' ? ' is-active' : ''}`}
                onClick={() => {
                  setTab('artifacts')
                  setMobilePane('list')
                }}
              >
                {t(language, 'curator.tabArtifacts')}
              </button>
              <button
                type="button"
                className={`curator-tab${tab === 'presidents' ? ' is-active' : ''}`}
                onClick={() => {
                  setTab('presidents')
                  setMobilePane('list')
                }}
              >
                {t(language, 'curator.tabPresidents')}
              </button>
            </nav>
          ) : null}
        </div>
        {user ? (
          <div className="curator-header-actions">
            <span className="curator-user-chip" title={user.email || ''}>
              {user.email || t(language, 'curator.role')}
            </span>
            <button type="button" className="curator-text-btn" onClick={handleLogout} disabled={busy}>
              {t(language, 'curator.logout')}
            </button>
          </div>
        ) : (
          <span className="curator-header-spacer" />
        )}
      </header>

      {!backendReady ? <p className="curator-banner">{t(language, 'curator.noApi')}</p> : null}

      {booting ? (
        <p className="curator-muted curator-boot">{t(language, 'curator.checking')}</p>
      ) : !user ? (
        <form className="curator-login" onSubmit={handleLogin}>
          <p className="curator-lead">{t(language, 'curator.lead')}</p>
          <p className="curator-muted">{t(language, 'curator.hint')}</p>
          <label className="curator-label">
            {t(language, 'curator.email')}
            <input className="curator-input" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" inputMode="email" />
          </label>
          <label className="curator-label">
            {t(language, 'curator.password')}
            <input
              className="curator-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={1}
              required
              autoComplete="current-password"
            />
          </label>
          {authError ? <p className="curator-error">{authError}</p> : null}
          <button type="submit" className="curator-primary" disabled={busy}>
            {t(language, 'curator.login')}
          </button>
        </form>
      ) : tab === 'artifacts' ? (
        <div className={`curator-shell curator-pane-${mobilePane}`}>
          <aside className="curator-nav">
            <div className="curator-nav-toolbar">
              <button type="button" className="curator-primary curator-nav-add" onClick={handleCreateArtifact} disabled={busy}>
                {t(language, 'curator.addArtifact')}
              </button>
              <label className="curator-nav-search">
                <span className="curator-sr-only">{t(language, 'curator.searchArtifacts')}</span>
                <input
                  className="curator-input"
                  placeholder={t(language, 'curator.searchPlaceholder')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="curator-label curator-nav-filter">
                {t(language, 'curator.presidentFilter')}
                <select
                  className="curator-input"
                  value={focusPresident}
                  onChange={(e) => {
                    const next = e.target.value
                    setFocusPresident(next)
                    setOpenPresident(next || null)
                  }}
                >
                  <option value="">{t(language, 'curator.allPresidents')}</option>
                  {presidentFilterOptions.map((name) => (
                    <option key={name} value={name}>
                      {name === 'Unassigned' ? t(language, 'curator.unassigned') : name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="curator-list-meta">
                {filtered.length === 1
                  ? t(language, 'curator.itemCount', { count: filtered.length })
                  : t(language, 'curator.itemsCount', { count: filtered.length })}
                {focusPresident
                  ? ` · ${focusPresident === 'Unassigned' ? t(language, 'curator.unassigned') : focusPresident}`
                  : ` · ${t(language, 'curator.groupsCount', { count: artifactsByPresident.length })}`}
              </p>
            </div>

            <div className="curator-list curator-list-grouped">
              {artifactsByPresident.length === 0 ? (
                <p className="curator-empty">{t(language, 'curator.emptyArtifacts')}</p>
              ) : (
                artifactsByPresident.map((group) => {
                  const expanded = focusPresident
                    ? focusPresident === group.name
                    : openPresident === group.name
                  return (
                    <section
                      key={group.name}
                      className={`curator-president-group${expanded ? ' is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="curator-president-heading"
                        onClick={() => togglePresidentGroup(group.name)}
                        aria-expanded={expanded}
                      >
                        <span className="curator-president-chevron" aria-hidden>
                          {expanded ? '▾' : '▸'}
                        </span>
                        <span className="curator-president-heading-text">
                          <strong>{group.name === 'Unassigned' ? t(language, 'curator.unassigned') : group.name}</strong>
                          {group.service ? <em>{group.service}</em> : null}
                        </span>
                        <span className="curator-president-count">{group.items.length}</span>
                      </button>
                      {expanded ? (
                        <ul className="curator-president-items">
                          {group.items.map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                className={row.id === selectedId ? 'curator-list-item is-active' : 'curator-list-item'}
                                onClick={() => selectArtifact(row.id)}
                              >
                                <span className="curator-list-code">{row.id_code || row.rd_code || `#${row.id}`}</span>
                                <span className="curator-list-name">{row.title || '(no title)'}</span>
                                {!row.published ? <span className="curator-pill">{t(language, 'curator.draft')}</span> : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  )
                })
              )}
            </div>
          </aside>

          <section className="curator-editor">
            {!selected ? (
              <div className="curator-editor-empty">
                <p className="curator-empty-title">{t(language, 'curator.selectArtifact')}</p>
                <p className="curator-muted">
                  {t(language, 'curator.selectArtifactHint')}
                </p>
              </div>
            ) : (
              <form className="curator-editor-form" onSubmit={handleSaveArtifact}>
                <div className="curator-editor-top">
                  <button
                    type="button"
                    className="curator-text-btn curator-mobile-back"
                    onClick={() => setMobilePane('list')}
                  >
                    {t(language, 'curator.backToList')}
                  </button>
                  <div className="curator-editor-identity">
                    <span className="curator-editor-code">{form.id_code || t(language, 'curator.noAccessionId')}</span>
                    <h2 className="curator-editor-title">{form.title || t(language, 'curator.untitledArtifact')}</h2>
                    <p className="curator-editor-owner">{form.owner_name || t(language, 'curator.unassigned')}</p>
                  </div>
                  <div className="curator-editor-actions">
                    <label className="curator-check curator-check-inline">
                      <input type="checkbox" checked={form.published} onChange={onField('published')} />
                      {t(language, 'curator.field.publishedShort')}
                    </label>
                    <button type="button" className="curator-text-btn curator-danger" onClick={handleDeleteArtifact} disabled={busy}>
                      {t(language, 'curator.delete')}
                    </button>
                    <button type="submit" className="curator-primary" disabled={busy}>
                      {t(language, 'curator.save')}
                    </button>
                  </div>
                </div>

                {(saveMsg || saveError) && (
                  <div className="curator-status-bar">
                    {saveMsg ? <p className="curator-ok">{saveMsg}</p> : null}
                    {saveError ? <p className="curator-error">{saveError}</p> : null}
                  </div>
                )}

                <div className="curator-section-tabs" role="tablist" aria-label={t(language, 'curator.editSectionsAria')}>
                  {EDITOR_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      role="tab"
                      aria-selected={editorSection === section.id}
                      className={`curator-section-tab${editorSection === section.id ? ' is-active' : ''}`}
                      onClick={() => setEditorSection(section.id)}
                    >
                      {t(language, section.labelKey)}
                    </button>
                  ))}
                </div>

                <div className="curator-section-body">
                  {editorSection === 'record' ? (
                    <div className="curator-section-grid">
                      <label className="curator-label">
                        {t(language, 'curator.field.accessionId')}
                        <input className="curator-input" value={form.id_code} onChange={onField('id_code')} />
                      </label>
                      <label className="curator-label">
                        {t(language, 'curator.field.owner')}
                        <select
                          className="curator-input"
                          value={form.president_id == null ? '' : String(form.president_id)}
                          onChange={(event) => {
                            const raw = event.target.value
                            if (!raw) {
                              setForm((prev) => ({ ...prev, president_id: null, owner_name: '' }))
                              return
                            }
                            const id = Number(raw)
                            const match = presidents.find((p) => p.id === id)
                            setForm((prev) => ({
                              ...prev,
                              president_id: Number.isFinite(id) ? id : null,
                              owner_name: match?.name || '',
                            }))
                          }}
                        >
                          <option value="">{t(language, 'curator.unassigned')}</option>
                          {presidents.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.name}
                              {p.service ? ` · ${p.service}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="curator-label curator-span-2">
                        {t(language, 'curator.field.title')}
                        <input className="curator-input" value={form.title} onChange={onField('title')} />
                      </label>
                      <label className="curator-label curator-span-2">
                        {t(language, 'curator.field.subtitle')}
                        <input className="curator-input" value={form.subtitle} onChange={onField('subtitle')} />
                      </label>
                      <label className="curator-label curator-span-2">
                        {t(language, 'curator.field.description')}
                        <textarea
                          className="curator-input curator-textarea"
                          rows={8}
                          value={form.description}
                          onChange={onField('description')}
                        />
                      </label>
                      <label className="curator-label curator-span-2">
                        {t(language, 'curator.field.remarks')}
                        <textarea
                          className="curator-input"
                          rows={3}
                          value={form.remarks}
                          onChange={onField('remarks')}
                        />
                      </label>
                    </div>
                  ) : null}

                  {editorSection === 'catalog' ? (
                    <div className="curator-section-grid">
                      <label className="curator-label">
                        {t(language, 'curator.field.yearAcquired')}
                        <input className="curator-input" value={form.year_acquired} onChange={onField('year_acquired')} />
                      </label>
                      <label className="curator-label">
                        {t(language, 'curator.field.country')}
                        <input
                          className="curator-input"
                          value={form.country_of_origin}
                          onChange={onField('country_of_origin')}
                        />
                      </label>
                      <label className="curator-label">
                        {t(language, 'curator.field.type')}
                        <input className="curator-input" value={form.artifact_type} onChange={onField('artifact_type')} />
                      </label>
                      <label className="curator-label">
                        {t(language, 'curator.field.icon')}
                        <input className="curator-input" value={form.icon} onChange={onField('icon')} />
                      </label>
                      <div className="curator-label curator-span-2">
                        {t(language, 'curator.field.tags')}
                        <div className="curator-tag-list" aria-label={t(language, 'curator.tagsAria')}>
                          {form.tags.length === 0 ? (
                            <p className="curator-muted curator-inline-muted">{t(language, 'curator.noTags')}</p>
                          ) : (
                            form.tags.map((tag) => (
                              <span key={tag} className="curator-tag-chip">
                                {tag}
                                <button
                                  type="button"
                                  className="curator-tag-remove"
                                  aria-label={t(language, 'curator.removeTag', { tag })}
                                  onClick={() => removeTag(tag)}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                        <div className="curator-tag-add">
                          <input
                            className="curator-input"
                            value={tagDraft}
                            placeholder={t(language, 'curator.addTag')}
                            onChange={(e) => setTagDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addTag(tagDraft)
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="curator-text-btn"
                            onClick={() => addTag(tagDraft)}
                            disabled={!tagDraft.trim()}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {editorSection === 'media' ? (
                    <div className="curator-media-layout">
                      <div className="curator-media-preview">
                        <p className="curator-media-label">{t(language, 'curator.photoLabel')}</p>
                        <CuratorPhoto language={language} artifactId={selected.id} imageUrl={selected.image_url} />
                        <label className="curator-file-btn">
                          {t(language, 'curator.uploadPhoto')}
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={busy} />
                        </label>
                      </div>
                      <div className="curator-media-model">
                        <p className="curator-media-label">{t(language, 'curator.modelLabel')}</p>
                        <label className="curator-file-btn">
                          {t(language, 'curator.uploadModel')}
                          <input type="file" accept=".glb,.obj" onChange={handleModelUpload} disabled={busy} />
                        </label>
                        {selected.model_url ? (
                          <>
                            <p className="curator-model-current">
                              {t(language, 'curator.modelCurrent')} <span>{selected.model_url}</span>
                            </p>
                            <button
                              type="button"
                              className="curator-text-btn curator-danger"
                              onClick={handleRemoveModel}
                              disabled={busy}
                            >
                              {t(language, 'curator.modelRemove')}
                            </button>
                          </>
                        ) : (
                          <p className="curator-muted curator-inline-muted">{t(language, 'curator.noModel')}</p>
                        )}
                        {uploadMsg ? <p className="curator-ok">{uploadMsg}</p> : null}
                        {uploadError ? <p className="curator-error">{uploadError}</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {editorSection === 'assist' ? (
                    <div className="curator-assist">
                      <label className="curator-check">
                        <input
                          type="checkbox"
                          checked={form.llm_assist_enabled}
                          onChange={onField('llm_assist_enabled')}
                        />
                        {t(language, 'curator.aiAllow')}
                      </label>
                      <div className="curator-assist-actions">
                        <button type="button" className="curator-text-btn" onClick={handleAiSuggest} disabled={busy}>
                          {t(language, 'curator.aiSuggest')}
                        </button>
                        {aiSuggestion ? (
                          <button type="button" className="curator-primary" onClick={handleAiAccept} disabled={busy}>
                            {t(language, 'curator.aiAccept')}
                          </button>
                        ) : null}
                      </div>
                      {aiSuggestion ? (
                        <pre className="curator-ai-preview">{JSON.stringify(aiSuggestion, null, 2)}</pre>
                      ) : (
                        <p className="curator-muted curator-inline-muted">
                          {t(language, 'curator.aiHint')}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </form>
            )}
          </section>
        </div>
      ) : (
        <div className={`curator-shell curator-pane-${mobilePane}`}>
          <aside className="curator-nav">
            <div className="curator-nav-toolbar">
              <button type="button" className="curator-primary curator-nav-add" onClick={handleCreatePresident} disabled={busy}>
                {t(language, 'curator.addPresident')}
              </button>
              <p className="curator-list-meta">
                {presidents.length === 1
                  ? t(language, 'curator.presidentCount', { count: presidents.length })
                  : t(language, 'curator.presidentsCount', { count: presidents.length })}
              </p>
            </div>
            <ul className="curator-list">
              {presidents.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p.id === selectedPresidentId ? 'curator-list-item is-active' : 'curator-list-item'}
                    onClick={() => selectPresident(p.id)}
                  >
                    <span className="curator-list-name">{p.name}</span>
                    <span className="curator-list-code">{p.service || t(language, 'curator.noServiceYears')}</span>
                    {!p.published ? <span className="curator-pill">{t(language, 'curator.draft')}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className="curator-editor">
            {!selectedPresident ? (
              <div className="curator-editor-empty">
                <p className="curator-empty-title">{t(language, 'curator.selectPresident')}</p>
                <p className="curator-muted">{t(language, 'curator.selectPresidentHint')}</p>
              </div>
            ) : (
              <form className="curator-editor-form" onSubmit={handleSavePresident}>
                <div className="curator-editor-top">
                  <button
                    type="button"
                    className="curator-text-btn curator-mobile-back"
                    onClick={() => setMobilePane('list')}
                  >
                    {t(language, 'curator.backToList')}
                  </button>
                  <div className="curator-editor-identity">
                    <span className="curator-editor-code">{presidentForm.service || t(language, 'curator.serviceYears')}</span>
                    <h2 className="curator-editor-title">{presidentForm.name || t(language, 'curator.untitled')}</h2>
                  </div>
                  <div className="curator-editor-actions">
                    <label className="curator-check curator-check-inline">
                      <input
                        type="checkbox"
                        checked={presidentForm.published}
                        onChange={(e) => setPresidentForm((f) => ({ ...f, published: e.target.checked }))}
                      />
                      {t(language, 'curator.field.publishedShort')}
                    </label>
                    <button type="button" className="curator-text-btn curator-danger" onClick={handleDeletePresident} disabled={busy}>
                      {t(language, 'curator.delete')}
                    </button>
                    <button type="submit" className="curator-primary" disabled={busy}>
                      {t(language, 'curator.save')}
                    </button>
                  </div>
                </div>

                {(saveMsg || saveError) && (
                  <div className="curator-status-bar">
                    {saveMsg ? <p className="curator-ok">{saveMsg}</p> : null}
                    {saveError ? <p className="curator-error">{saveError}</p> : null}
                  </div>
                )}

                <div className="curator-section-body">
                  <div className="curator-section-grid">
                    <label className="curator-label">
                      {t(language, 'curator.field.name')}
                      <input
                        className="curator-input"
                        value={presidentForm.name}
                        onChange={(e) => setPresidentForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </label>
                    <label className="curator-label">
                      {t(language, 'curator.field.service')}
                      <input
                        className="curator-input"
                        value={presidentForm.service}
                        onChange={(e) => setPresidentForm((f) => ({ ...f, service: e.target.value }))}
                      />
                    </label>
                    <label className="curator-label curator-span-2">
                      {t(language, 'curator.field.biography')}
                      <textarea
                        className="curator-input curator-textarea"
                        rows={10}
                        value={presidentForm.biography}
                        onChange={(e) => setPresidentForm((f) => ({ ...f, biography: e.target.value }))}
                      />
                    </label>
                    <label className="curator-label curator-span-2">
                      {t(language, 'curator.field.portraitUrl')}
                      <input
                        className="curator-input"
                        value={presidentForm.photo_url}
                        onChange={(e) => setPresidentForm((f) => ({ ...f, photo_url: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
