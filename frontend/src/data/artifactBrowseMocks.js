/**
 * Browse / artifact-detail mock rows — replace with API responses when backend is integrated.
 * Shape matches what PresidentArtifacts and ArtifactDetail expect.
 */

export const MOCK_ARTIFACTS_BROWSE = [
  {
    id: 1,
    rdCode: 'RD204',
    name: 'Founding Plaque',
    subtitle: 'From the first expansion era',
    year: '1987',
    owner: 'Br. Rafael S. Donato, FSC',
    icon: '🏺',
    description:
      "Commemorative plaque marking a foundational period in the institution\u2019s growth. Displayed as part of the AEA-IRC Presidents\u2019 Memorabilia collection.",
  },
  {
    id: 2,
    rdCode: 'RD246',
    name: 'Excellence Trophy',
    subtitle: 'Institutional achievement marker',
    year: '1996',
    owner: 'Br. Gus Boquer, FSC',
    icon: '🏆',
    description:
      'Trophy recognizing sustained excellence in academic and community programs. Full curatorial narrative will load from the API in production.',
  },
  {
    id: 3,
    rdCode: 'RD301',
    name: 'Presidential Portrait',
    subtitle: 'Official museum collection',
    year: '2000',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '🖼️',
    description:
      'Formal portrait representing presidential leadership. Metadata such as artist, medium, and exhibition history will be supplied by the knowledge graph integration.',
  },
  {
    id: 4,
    rdCode: 'RD302',
    name: 'Accreditation Medallion',
    subtitle: 'Quality standards milestone',
    year: '2003',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '🎖️',
    description:
      'Medallion issued in connection with accreditation milestones. Description text is placeholder until artifact records are synced from the database.',
  },
  {
    id: 5,
    rdCode: 'RD303',
    name: 'Charter Document',
    subtitle: 'Historic governance record',
    year: '2006',
    owner: 'Br. Narciso S. Erguiza, FSC',
    icon: '📜',
    description:
      'Governance charter document preserved in the memorabilia gallery. High-resolution scans and linked entities will appear here after backend wiring.',
  },
  {
    id: 6,
    rdCode: 'RD304',
    name: 'Campus Expansion Blueprint',
    subtitle: 'Planning archive',
    year: '2009',
    owner: 'Br. Armin A. Luistro, FSC',
    icon: '📐',
    description:
      'Historical planning document from the expansion era. Placeholder copy for UI review until collections are linked in the database.',
  },
  {
    id: 7,
    rdCode: 'RD305',
    name: 'Leadership Citation',
    subtitle: 'Recognition program',
    year: '2012',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '📋',
    description:
      'Citation recognizing institutional leadership initiatives. Metadata will be enriched from the knowledge graph.',
  },
  {
    id: 8,
    rdCode: 'RD306',
    name: 'Library Dedication Plaque',
    subtitle: 'IRC milestone',
    year: '2017',
    owner: 'Br. Geminiano M. Buenaventura, FSC',
    icon: '🏛️',
    description:
      'Dedication plaque associated with Information Resource Center history. Mock entry for layout testing.',
  },
  {
    id: 9,
    rdCode: 'RD307',
    name: 'Strategic Plan Binder',
    subtitle: 'Governance records',
    year: '2021',
    owner: 'Br. Francisco "Sockie" dela Rosa VI, FSC',
    icon: '📚',
    description:
      'Binder representing strategic planning during the early 2020s. Replace with catalogued media when available.',
  },
  {
    id: 10,
    rdCode: 'RD322',
    name: 'Lasallian Mission Statement',
    subtitle: 'Printed institutional text',
    year: '2024',
    owner: 'Br. Iñigo Riola, FSC',
    icon: '📄',
    description:
      'Printed statement of Lasallian mission used in gallery displays. Placeholder description for UX iteration.',
  },
]

/**
 * Extra mock rows so “Related by tag” lists can show many peers (overlapping years, owners, RD codes).
 * Shapes match `MOCK_ARTIFACTS_BROWSE` rows.
 */
export const MOCK_ARTIFACTS_RELATED_EXTENDED = [
  {
    id: 11,
    rdCode: 'RD309',
    name: 'Inauguration Program',
    subtitle: 'Ceremonial print',
    year: '2003',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '📰',
    description: 'Mock program from the same presidential era as other 2003 memorabilia.',
  },
  {
    id: 12,
    rdCode: 'RD310',
    name: 'Campus Master Plan Folio',
    subtitle: 'Planning archive',
    year: '2003',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '🗂️',
    description: 'Planning folio kept for layout testing of related-by-year lists.',
  },
  {
    id: 13,
    rdCode: 'RD311',
    name: 'Guest Lecture Poster',
    subtitle: 'Academic event',
    year: '2003',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '🖼️',
    description: 'Poster mock entry sharing the year tag with other artifacts.',
  },
  {
    id: 14,
    rdCode: 'RD312',
    name: 'Scholarship Certificate',
    subtitle: 'Recognition program',
    year: '2012',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '📜',
    description: 'Certificate mock sharing the 2012 tag with the Leadership Citation.',
  },
  {
    id: 15,
    rdCode: 'RD313',
    name: 'Faculty Assembly Notes',
    subtitle: 'Governance records',
    year: '2012',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '📝',
    description: 'Typed notes mock for related-by-year and owner.',
  },
  {
    id: 16,
    rdCode: 'RD314',
    name: 'Library Bookmark Set',
    subtitle: 'IRC milestone',
    year: '2012',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '🔖',
    description: 'Bookmark set mock linked to the same tag cluster.',
  },
  {
    id: 17,
    rdCode: 'RD315',
    name: 'Presidential Seal Replica',
    subtitle: 'Official museum collection',
    year: '2000',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '🏅',
    description: 'Replica mock sharing year and president with the portrait.',
  },
  {
    id: 18,
    rdCode: 'RD316',
    name: 'Campus Photo Album',
    subtitle: 'Official museum collection',
    year: '2000',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '📷',
    description: 'Photo album mock for dense same-tag lists.',
  },
  {
    id: 19,
    rdCode: 'RD317',
    name: 'Lasallian Values Poster',
    subtitle: 'Printed institutional text',
    year: '2024',
    owner: 'Br. Iñigo Riola, FSC',
    icon: '📋',
    description: 'Poster mock sharing 2024 and president tags.',
  },
  {
    id: 20,
    rdCode: 'RD318',
    name: 'Mission Week Banner',
    subtitle: 'Printed institutional text',
    year: '2024',
    owner: 'Br. Iñigo Riola, FSC',
    icon: '🎗️',
    description: 'Banner mock for related list variety.',
  },
  {
    id: 21,
    rdCode: 'RD319',
    name: 'Heritage Lecture Ticket',
    subtitle: 'Academic event',
    year: '1987',
    owner: 'Br. Rafael S. Donato, FSC',
    icon: '🎫',
    description: 'Ticket stub mock sharing the 1987 tag with the founding plaque.',
  },
  {
    id: 22,
    rdCode: 'RD320',
    name: 'Foundation Day Medal',
    subtitle: 'From the first expansion era',
    year: '1987',
    owner: 'Br. Rafael S. Donato, FSC',
    icon: '🎖️',
    description: 'Medal mock for same-era related browsing.',
  },
  {
    id: 23,
    rdCode: 'RD321',
    name: 'IRC Newsletter Vol. 2',
    subtitle: 'IRC milestone',
    year: '2017',
    owner: 'Br. Geminiano M. Buenaventura, FSC',
    icon: '📰',
    description: 'Newsletter mock sharing subtitle theme with dedication plaque.',
  },
  {
    id: 24,
    rdCode: 'RD323',
    name: 'Strategic Retreat Binder',
    subtitle: 'Governance records',
    year: '2021',
    owner: 'Br. Francisco "Sockie" dela Rosa VI, FSC',
    icon: '📚',
    description: 'Binder mock sharing governance subtitle tag.',
  },
  {
    id: 25,
    rdCode: 'RD324',
    name: 'Alumni Homecoming Pin',
    subtitle: 'Recognition program',
    year: '2009',
    owner: 'Br. Armin A. Luistro, FSC',
    icon: '📌',
    description: 'Pin mock sharing year with blueprint era.',
  },
]

/** Fallback body when API returns rows without a description field. */
export const PLACEHOLDER_ARTIFACT_DESCRIPTION =
  'Curatorial description will appear here once this artifact is loaded from the database. Connections to presidents, dates, and related memorabilia will be available through the knowledge graph.'

/** Mock: artifacts whose `owner` string matches the president's display name. */
export function getMockArtifactsForPresident(presidentName) {
  if (typeof presidentName !== 'string' || !presidentName.trim()) return []
  const all = [...MOCK_ARTIFACTS_BROWSE, ...MOCK_ARTIFACTS_RELATED_EXTENDED]
  return all.filter((a) => a.owner === presidentName)
}
