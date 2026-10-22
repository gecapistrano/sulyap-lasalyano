/**
 * DLSU-D president rows for BrowseMode / navigation history restore.
 */

export const MOCK_PRESIDENTS = [
  { id: 1, name: 'Br. Rafael S. Donato, FSC', service: '1987 - 1994', icon: '👤' },
  { id: 2, name: 'Br. Gus Boquer, FSC', service: '1994 - 1999', icon: '👤' },
  { id: 3, name: 'Br. Andrew B. Gonzalez, FSC', service: '1999 - 2001', icon: '👤' },
  { id: 4, name: 'Br. Rolando V. Dizon, FSC', service: '2001 - 2004', icon: '👤' },
  { id: 6, name: 'Br. Armin A. Luistro, FSC', service: '2008 - 2010', icon: '👤' },
  { id: 7, name: 'Dr. Carmelita R. Quebengco', service: '2010 - 2016', icon: '👤' },
  { id: 8, name: 'Br. Geminiano M. Buenaventura, FSC', service: '2016 - 2019', icon: '👤' },
  { id: 9, name: 'Br. Francisco "Sockie" dela Rosa VI, FSC', service: '2019 - 2024', icon: '👤' },
  { id: 10, name: 'Br. Iñigo Riola, FSC', service: '2024 - present', icon: '👤' },
]

export function findPresidentById(id) {
  if (id == null || id === '') return null
  const n = Number(id)
  if (Number.isNaN(n)) return null
  return MOCK_PRESIDENTS.find((p) => p.id === n) ?? null
}
