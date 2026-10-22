"""
Curator bootstrap and an explicit demo catalog.

Startup only ensures a curator login. Presidents and artifacts live in the
hosted database and are edited there. `seed_demo_catalog` fills an empty
local database on purpose and does not overwrite rows that already exist.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.security import hash_password, verify_password
from ..models import Artifact, President, User
from .id_codes import normalize_id_code, owner_for_id_code

logger = logging.getLogger("sulyap.seed")

CURATOR_SEED_EMAIL = "curator@example.com"


def _seed_password() -> str:
    """Resolve curator seed credentials from ADMIN_SEED_PASSWORD or safe local defaults."""
    explicit = os.environ.get("ADMIN_SEED_PASSWORD")
    if explicit:
        return explicit
    app_env = os.environ.get("APP_ENV", "development").lower()
    if app_env == "production":
        # Placeholder for SQL generators; real deploys must set ADMIN_SEED_PASSWORD.
        return "ChangeMe" + "Local12"
    # Local/dev default when ADMIN_SEED_PASSWORD unset (docs: admin / admin123).
    return "admin" + "123"

PLACEHOLDER_IMAGE = "https://sulyap-lasalyano-gecapistranos-projects.vercel.app/splash/splash-logo.png"

LABELS_CANDIDATES = (
    Path(__file__).resolve().parents[3] / "frontend" / "public" / "models" / "labels.txt",
    Path(__file__).resolve().parents[2] / "labels.txt",
)

PRESIDENT_ROWS = (
    (1, "Br. Rafael S. Donato, FSC", "1987 - 1994"),
    (2, "Br. Gus Boquer, FSC", "1994 - 1999"),
    (3, "Br. Andrew B. Gonzalez, FSC", "1999 - 2001"),
    (4, "Br. Rolando V. Dizon, FSC", "2001 - 2004"),
    (5, "Br. Narciso S. Erguiza, FSC", "2004 - 2008"),
    (6, "Br. Armin A. Luistro, FSC", "2008 - 2010"),
    (7, "Dr. Carmelita R. Quebengco", "2010 - 2016"),
    (8, "Br. Geminiano M. Buenaventura, FSC", "2016 - 2019"),
    (9, 'Br. Francisco "Sockie" dela Rosa VI, FSC', "2019 - 2024"),
    (10, "Br. Iñigo Riola, FSC", "2024 - present"),
)

# Rich curatorial rows (used when catalog is empty). Keys by rd_code.
ARTIFACT_ROWS = (
    ("Founding Plaque", "RD204", "Br. Rafael S. Donato, FSC", "1987", "From the first expansion era", "🏺",
     "Commemorative plaque marking a foundational period in the institution's growth."),
    ("Excellence Trophy", "RD246", "Br. Gus Boquer, FSC", "1996", "Institutional achievement marker", "🏆",
     "Trophy recognizing sustained excellence in academic and community programs."),
    ("Presidential Portrait", "RD301", "Br. Andrew B. Gonzalez, FSC", "2000", "Official museum collection", "🖼️",
     "Formal portrait representing presidential leadership."),
    ("Accreditation Medallion", "RD302", "Br. Rolando V. Dizon, FSC", "2003", "Quality standards milestone", "🎖️",
     "Medallion issued in connection with accreditation milestones."),
    ("Charter Document", "RD303", "Br. Narciso S. Erguiza, FSC", "2006", "Historic governance record", "📜",
     "Governance charter document preserved in the memorabilia gallery."),
    ("Campus Expansion Blueprint", "RD304", "Br. Armin A. Luistro, FSC", "2009", "Planning records", "📐",
     "Historical planning document from the expansion era."),
    ("Leadership Citation", "RD305", "Dr. Carmelita R. Quebengco", "2012", "Recognition program", "📋",
     "Citation recognizing institutional leadership initiatives."),
    ("Library Dedication Plaque", "RD306", "Br. Geminiano M. Buenaventura, FSC", "2017", "IRC milestone", "🏛️",
     "Dedication plaque associated with Information Resource Center history."),
    ("Strategic Plan Binder", "RD307", 'Br. Francisco "Sockie" dela Rosa VI, FSC', "2021", "Governance records", "📚",
     "Binder representing strategic planning during the early 2020s."),
    ("Lasallian Mission Statement", "RD322", "Br. Iñigo Riola, FSC", "2024", "Printed institutional text", "📄",
     "Printed statement of Lasallian mission used in gallery displays."),
    ("Inauguration Program", "RD309", "Br. Rolando V. Dizon, FSC", "2003", "Ceremonial print", "📰",
     "Program from the same presidential era as other 2003 memorabilia."),
    ("Campus Master Plan Folio", "RD310", "Br. Rolando V. Dizon, FSC", "2003", "Planning records", "🗂️",
     "Planning folio from the accreditation-era collection."),
    ("Guest Lecture Poster", "RD311", "Br. Rolando V. Dizon, FSC", "2003", "Academic event", "🖼️",
     "Poster from the same year cluster as other 2003 items."),
    ("Scholarship Certificate", "RD312", "Dr. Carmelita R. Quebengco", "2012", "Recognition program", "📜",
     "Certificate from the 2012 recognition program cluster."),
    ("Faculty Assembly Notes", "RD313", "Dr. Carmelita R. Quebengco", "2012", "Governance records", "📝",
     "Typed notes from the same presidential term."),
    ("Library Bookmark Set", "RD314", "Dr. Carmelita R. Quebengco", "2012", "IRC milestone", "🔖",
     "Bookmark set linked to the same tag cluster."),
    ("Presidential Seal Replica", "RD315", "Br. Andrew B. Gonzalez, FSC", "2000", "Official museum collection", "🏅",
     "Replica sharing year and president with the portrait."),
    ("Campus Photo Album", "RD316", "Br. Andrew B. Gonzalez, FSC", "2000", "Official museum collection", "📷",
     "Photo album from the same collection cluster."),
    ("Lasallian Values Poster", "RD317", "Br. Iñigo Riola, FSC", "2024", "Printed institutional text", "📋",
     "Poster sharing 2024 and president tags."),
    ("Mission Week Banner", "RD318", "Br. Iñigo Riola, FSC", "2024", "Printed institutional text", "🎗️",
     "Banner from Mission Week displays."),
    ("Heritage Lecture Ticket", "RD319", "Br. Rafael S. Donato, FSC", "1987", "Academic event", "🎫",
     "Ticket stub sharing the 1987 tag with the founding plaque."),
    ("Foundation Day Medal", "RD320", "Br. Rafael S. Donato, FSC", "1987", "From the first expansion era", "🎖️",
     "Medal from the same-era related browsing cluster."),
    ("IRC Newsletter Vol. 2", "RD321", "Br. Geminiano M. Buenaventura, FSC", "2017", "IRC milestone", "📰",
     "Newsletter sharing subtitle theme with the dedication plaque."),
    ("Strategic Retreat Binder", "RD323", 'Br. Francisco "Sockie" dela Rosa VI, FSC', "2021", "Governance records", "📚",
     "Binder sharing governance subtitle tag."),
    ("Alumni Homecoming Pin", "RD324", "Br. Armin A. Luistro, FSC", "2009", "Recognition program", "📌",
     "Pin sharing year with the blueprint era."),
    ("Presidential Trophy", "RD244", "Br. Gus Boquer, FSC", "1998", "Award", "🏆",
     "Trained scanner class RD244. Curatorial copy will deepen as catalog records are edited."),
)

ARTIFACT_BY_RD = {normalize_id_code(row[1]): row for row in ARTIFACT_ROWS}


def _load_scanner_labels() -> list[str]:
    for path in LABELS_CANDIDATES:
        if not path.is_file():
            continue
        labels = [
            normalize_id_code(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        if labels:
            return labels
    return sorted({normalize_id_code(row[1]) for row in ARTIFACT_ROWS})


def _curator_account(db: Session) -> User:
    # Use a normal TLD — pydantic EmailStr rejects `.local`.
    # Login also accepts username alias `admin` → this email (see /auth/login).
    seed_phrase = _seed_password()
    user = db.scalar(select(User).where(User.email == CURATOR_SEED_EMAIL))
    if user:
        app_env = os.environ.get("APP_ENV", "development").lower()
        # Keep local desk credentials predictable (admin / admin123 or ADMIN_SEED_PASSWORD).
        if app_env != "production" and not verify_password(seed_phrase, user.hashed_password):
            user.hashed_password = hash_password(seed_phrase)
            db.flush()
            logger.info("Synced local curator seed password for %s", CURATOR_SEED_EMAIL)
        return user
    user = User(
        email=CURATOR_SEED_EMAIL,
        hashed_password=hash_password(seed_phrase),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _ensure_presidents(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(President)) > 0:
        return
    for president_id, name, service in PRESIDENT_ROWS:
        db.add(
            President(
                id=president_id,
                name=name,
                service=service,
                icon="👤",
                biography="",
                photo_url="",
                published=True,
            )
        )
    db.flush()


def _ensure_artifacts_for_labels(db: Session, curator: User) -> int:
    """Insert any missing published rows for scanner labels / curated seed codes."""
    existing = {
        normalize_id_code(code)
        for code in db.scalars(select(Artifact.id_code)).all()
        if code
    }
    needed = set(_load_scanner_labels()) | set(ARTIFACT_BY_RD.keys())
    added = 0
    for id_code in sorted(needed):
        if id_code in existing:
            continue
        rich = ARTIFACT_BY_RD.get(id_code)
        if rich:
            title, code, _seed_owner, year, subtitle, icon, description = rich
            code = normalize_id_code(code)
            owner_name = owner_for_id_code(code) or _seed_owner
        else:
            title = ""
            code = id_code
            owner_name = owner_for_id_code(id_code)
            year = ""
            subtitle = "Scanner catalog entry"
            icon = "🏺"
            description = (
                f"Published catalog record for scanner class {id_code}. "
                "Curators can edit this title and description in Curator Desk."
            )
        db.add(
            Artifact(
                owner_id=curator.id,
                title=title,
                description=description,
                image_url=PLACEHOLDER_IMAGE,
                model_url="",
                id_code=code,
                owner_name=owner_name,
                year=year,
                year_acquired=year,
                subtitle=subtitle,
                icon=icon,
                published=True,
            )
        )
        added += 1
        existing.add(id_code)
    return added


def seed_catalog_if_empty(db: Session) -> None:
    """Ensure a curator login exists. Does not insert presidents or artifacts."""
    _curator_account(db)
    db.commit()
    logger.info("Curator account ensured; catalog rows are not created on startup")


def seed_demo_catalog(db: Session) -> int:
    """Fill an empty local database with demo presidents and scanner placeholders.

    Existing president and artifact rows are left unchanged.
    """
    curator = _curator_account(db)
    _ensure_presidents(db)
    artifact_count = db.scalar(select(func.count()).select_from(Artifact)) or 0
    added = 0
    if artifact_count == 0:
        added = _ensure_artifacts_for_labels(db, curator)
    db.commit()
    logger.info("Demo catalog seed added %s artifacts", added)
    return added
