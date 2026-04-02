/**
 * Browse / artifact-detail mock rows — replace with API responses when backend is integrated.
 * Shape matches what BrowseMode and ArtifactDetail expect.
 */

export const MOCK_ARTIFACTS_BROWSE = [
  {
    id: 1,
    name: 'Founding Plaque',
    subtitle: 'From the first expansion era',
    year: '1975',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '🏺',
    description:
      'Commemorative plaque marking a foundational period in the institution’s growth. Displayed as part of the AEA-IRC Presidents’ Memorabilia collection; provenance and acquisition records will attach here from the database.',
  },
  {
    id: 2,
    name: 'Excellence Trophy',
    subtitle: 'Institutional achievement marker',
    year: '1988',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '🏆',
    description:
      'Trophy recognizing sustained excellence in academic and community programs. The full curatorial narrative and media assets will load from the API in production.',
  },
  {
    id: 3,
    name: 'Presidential Portrait',
    subtitle: 'Official museum collection',
    year: '1995',
    owner: 'Br. Narciso S. Erguiza, FSC',
    icon: '🖼️',
    description:
      'Formal portrait representing presidential leadership during the mid-1990s. Metadata such as artist, medium, and exhibition history will be supplied by the knowledge graph integration.',
  },
  {
    id: 4,
    name: 'Accreditation Medallion',
    subtitle: 'Quality standards milestone',
    year: '2003',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '🎖️',
    description:
      'Medallion issued in connection with accreditation milestones. Description text is placeholder UI until artifact records are synced from PostgreSQL.',
  },
  {
    id: 5,
    name: 'Charter Document',
    subtitle: 'Historic governance record',
    year: '2010',
    owner: 'Br. Armin A. Luistro, FSC',
    icon: '📜',
    description:
      'Governance charter document preserved in the memorabilia gallery. High-resolution scans and linked entities (people, dates, events) will appear here after backend wiring.',
  },
  {
    id: 6,
    name: 'Campus Expansion Blueprint',
    subtitle: 'Planning archive',
    year: '1978',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '📐',
    description:
      'Historical planning document from the expansion era. Placeholder copy for UI review until collections are linked in the database.',
  },
  {
    id: 7,
    name: 'Leadership Citation',
    subtitle: 'Recognition program',
    year: '1992',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '📋',
    description:
      'Citation recognizing institutional leadership initiatives. Metadata will be enriched from the knowledge graph.',
  },
  {
    id: 8,
    name: 'Library Dedication Plaque',
    subtitle: 'IRC milestone',
    year: '2001',
    owner: 'Br. Narciso S. Erguiza, FSC',
    icon: '🏛️',
    description:
      'Dedication plaque associated with Information Resource Center history. Mock entry for layout testing.',
  },
  {
    id: 9,
    name: 'Strategic Plan Binder',
    subtitle: 'Governance records',
    year: '2006',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '📚',
    description:
      'Binder representing strategic planning during the mid-2000s. Replace with catalogued media when available.',
  },
  {
    id: 10,
    name: 'Lasallian Mission Statement',
    subtitle: 'Printed institutional text',
    year: '2009',
    owner: 'Br. Armin A. Luistro, FSC',
    icon: '📄',
    description:
      'Printed statement of Lasallian mission used in gallery displays. Placeholder description for UX iteration.',
  },
]

/** Fallback body when API returns rows without a description field. */
export const PLACEHOLDER_ARTIFACT_DESCRIPTION =
  'Curatorial description will appear here once this artifact is loaded from the database. Connections to presidents, dates, and related memorabilia will be available through the knowledge graph.'

/** Mock: artifacts whose `owner` string matches the president’s display name. */
export function getMockArtifactsForPresident(presidentName) {
  if (typeof presidentName !== 'string' || !presidentName.trim()) return []
  return MOCK_ARTIFACTS_BROWSE.filter((a) => a.owner === presidentName)
}
