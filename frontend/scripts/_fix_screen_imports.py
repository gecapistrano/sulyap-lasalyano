from pathlib import Path

root = Path(__file__).resolve().parents[1] / "src"
pages = root / "pages"
screens = root / "screens"
if pages.exists() and not screens.exists():
    pages.rename(screens)
    print("renamed pages -> screens")
elif screens.exists():
    print("screens already exists")
else:
    print("WARNING: neither pages nor screens found")

for p in root.rglob("*"):
    if p.suffix not in {".js", ".jsx", ".css", ".ts", ".tsx"}:
        continue
    t = p.read_text(encoding="utf-8")
    nt = (
        t.replace("./pages/", "./screens/")
        .replace("../pages/", "../screens/")
        .replace("@/pages/", "@/screens/")
    )
    if nt != t:
        p.write_text(nt, encoding="utf-8")
        print("fixed", p.relative_to(root))
