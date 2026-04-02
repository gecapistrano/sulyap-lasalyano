export const mockArtifacts = [
  {
    id: 1,
    name: 'Item #1',
    president: 'Pres. Mateo Villanueva de Leon',
    year: '1978',
    description:
      'Mock artifact for gesture-demo preview: a compact museum-style blurb that fits a single paragraph for the overlay.',
    historical_context: '',
    modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
    modelScale: 1.2,
    accentColor: '#4CC9F0',
  },
  {
    id: 2,
    name: 'Item #2',
    president: 'Pres. Andresito M. Fuentebella',
    year: '1911',
    description:
      'Mock artifact for gesture-demo preview: placeholder copy only; replace with real catalog text when wiring the API.',
    historical_context: '',
    modelUrl:
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb',
    modelScale: 1.45,
    accentColor: '#F4A261',
  },
  {
    id: 3,
    name: 'Item #3',
    president: 'Pres. Luciano B. Marasigan',
    year: '1936',
    description:
      'Mock artifact for gesture-demo preview: one short paragraph keeps the info sheet readable during hand tracking.',
    historical_context: '',
    modelUrl:
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb',
    modelScale: 1.05,
    accentColor: '#E63946',
  },
  {
    id: 4,
    name: 'Item #4',
    president: 'Pres. Ramonito S. Alcantara',
    year: '1952',
    description:
      'Mock artifact for gesture-demo preview: final sample item with minimal description text for layout testing.',
    historical_context: '',
    modelUrl:
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
    modelScale: 1.35,
    accentColor: '#90BE6D',
  },
]

/** Four distinct GLB/scales/accents for knowledge-graph gesture view (same set as above). */
export const GESTURE_MODEL_PRESETS = mockArtifacts.map(({ modelUrl, modelScale, accentColor }) => ({
  modelUrl,
  modelScale,
  accentColor,
}))
