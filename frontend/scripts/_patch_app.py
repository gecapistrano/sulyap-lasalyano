from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
raw = p.read_text(encoding="utf-8")
t = raw.replace("\r\n", "\n")

pat = re.compile(
    r"export default function App\(\) \{\n"
    r"  const initialScreen = resolveBootScreen\(\)\n\n"
    r"  /\*\* Last pushed / replaced navigation snapshot \(aligned with `history\.state`\)\. \*/\n"
    r"  const navRef = useRef\(emptySnapshot\(initialScreen\)\)\n\n"
    r"  const \[screen, setScreenRaw\] = useState\(initialScreen\)\n"
    r"  const isPageRefresh = screen === 'home'\n\n"
    r"  const \[showSplash, setShowSplash\] = useState\(isPageRefresh\)\n"
    r"  const \[showApp, setShowApp\] = useState\(!isPageRefresh\)",
)
new = """export default function App({
  initialScreen: routeScreen,
  initialPresidentId = null,
  initialIdCode = null,
  initialRelatedTag = '',
} = {}) {
  const bootScreen = routeScreen || resolveBootScreen()

  /** Last pushed / replaced navigation snapshot (aligned with `history.state`). */
  const navRef = useRef(emptySnapshot(bootScreen))

  const [screen, setScreenRaw] = useState(bootScreen)
  const isPageRefresh = !routeScreen && screen === 'home'

  const [showSplash, setShowSplash] = useState(isPageRefresh)
  const [showApp, setShowApp] = useState(!isPageRefresh)"""
t2, n = pat.subn(new, t, count=1)
if n != 1:
    # fallback: simple function signature only
    if "export default function App() {" in t:
        t2 = t.replace(
            "export default function App() {\n  const initialScreen = resolveBootScreen()",
            "export default function App({\n  initialScreen: routeScreen,\n  initialPresidentId = null,\n  initialIdCode = null,\n  initialRelatedTag = '',\n} = {}) {\n  const bootScreen = routeScreen || resolveBootScreen()",
            1,
        )
        t2 = t2.replace("emptySnapshot(initialScreen)", "emptySnapshot(bootScreen)")
        t2 = t2.replace("useState(initialScreen)", "useState(bootScreen)")
        t2 = t2.replace(
            "const isPageRefresh = screen === 'home'",
            "const isPageRefresh = !routeScreen && screen === 'home'",
        )
        print("fallback patch applied")
    else:
        raise SystemExit(f"pattern not found; n={n}")
else:
    print("regex patch applied")

t2 = t2.replace(
    "const [selectedPresident, setSelectedPresident] = useState(null)",
    "const [selectedPresident, setSelectedPresident] = useState(() =>\n"
    "    initialPresidentId != null ? findPresidentById(initialPresidentId) : null,\n"
    "  )",
    1,
)
t2 = t2.replace(
    "const [relatedArtifactsTag, setRelatedArtifactsTag] = useState('')",
    "const [relatedArtifactsTag, setRelatedArtifactsTag] = useState(initialRelatedTag || '')",
    1,
)
if "initialIdCode" not in t2.split("hydrateFromSnapshot")[0]:
    t2 = t2.replace(
        "  const isPopstate = useRef(false)\n\n  const hydrateFromSnapshot",
        """  const isPopstate = useRef(false)

  useEffect(() => {
    if (!initialIdCode) return undefined
    let cancelled = false
    const code = String(initialIdCode).trim()
    const mock =
      getAllMockArtifacts().find(
        (a) => String(a.rdCode || '').toUpperCase() === code.toUpperCase(),
      ) || null
    if (mock) setBrowseArtifact(mock)
    if (isBackendConfigured()) {
      getCatalogArtifactByIdCode(code)
        .then((row) => {
          if (!cancelled && row) setBrowseArtifact(row)
        })
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [initialIdCode])

  const hydrateFromSnapshot""",
        1,
    )

# preserve original newline style if CRLF
out = t2.replace("\n", "\r\n") if "\r\n" in raw else t2
p.write_text(out, encoding="utf-8")
print("ok")
