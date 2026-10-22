/**
 * Wrapper so `npm run models:compress` uses the Python + gltf-transform pipeline.
 * Never downloads GLBs from Supabase Storage.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'compress_catalog_models.py')
const result = spawnSync('python', [script, ...process.argv.slice(2)], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
