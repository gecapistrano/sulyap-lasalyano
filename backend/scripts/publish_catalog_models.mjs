/**
 * Publish compressed GLBs to a cheap-egress host. Never uploads to Supabase Storage.
 *
 *   node backend/scripts/publish_catalog_models.mjs --dest "D:\\tmp\\sulyap-models"
 *   node backend/scripts/publish_catalog_models.mjs --r2-bucket sulyap-models
 *   node backend/scripts/publish_catalog_models.mjs --pages-project sulyap-models
 *
 * Then on Render set:
 *   PUBLIC_MODEL_BASE_URL=https://<your-host>
 * Keep CATALOG_OMIT_STORAGE_MODELS=true (production already forces this).
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..')
const MODELS_DIR = resolve(SCRIPT_DIR, '..', 'data', 'models-public')
const SRC = join(MODELS_DIR, 'models')
const NPM_CACHE = resolve(REPO_ROOT, '.npm-cache')

function run(cmd, args, opts = {}) {
  const env = {
    ...process.env,
    npm_config_cache: NPM_CACHE,
    NPM_CONFIG_CACHE: NPM_CACHE,
  }
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env,
    cwd: REPO_ROOT,
    ...opts,
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${result.status})`)
  }
}

function wranglerBin() {
  const local = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')
  if (existsSync(local)) return JSON.stringify(local)
  return 'npx --yes wrangler'
}

function ensureWrangler() {
  mkdirSync(NPM_CACHE, { recursive: true })
  if (existsSync(join(REPO_ROOT, 'node_modules', 'wrangler'))) return
  console.log('Installing wrangler once into this repo (D: drive), not via npx on C:...')
  run('npm', ['install', '--no-save', '--no-fund', '--no-audit', 'wrangler@4.151.3'])
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag)
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]
  return ''
}

if (!existsSync(SRC) || !readdirSync(SRC).some((name) => name.toLowerCase().endsWith('.glb'))) {
  console.error(`No compressed GLBs in ${SRC}`)
  console.error('Run: node backend/scripts/compress_catalog_models.mjs')
  process.exit(1)
}

const dest = argValue('--dest')
const r2 = argValue('--r2-bucket')
const pages = argValue('--pages-project')

if (!dest && !r2 && !pages) {
  console.error('Pass --dest DIR, --r2-bucket NAME, or --pages-project NAME')
  process.exit(1)
}

writeFileSync(
  join(MODELS_DIR, '_headers'),
  `/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=31536000, immutable
`,
)

if (dest) {
  const out = resolve(dest)
  mkdirSync(join(out, 'models'), { recursive: true })
  cpSync(SRC, join(out, 'models'), { recursive: true })
  console.log(`copied models → ${join(out, 'models')}`)
  console.log(`Set PUBLIC_MODEL_BASE_URL to that host origin (files at /models/{CODE}.glb).`)
}

if (r2 || pages) ensureWrangler()
const wrangler = wranglerBin()

if (r2) {
  const files = readdirSync(SRC).filter((name) => name.toLowerCase().endsWith('.glb'))
  for (const name of files) {
    console.log(`upload ${name}`)
    run(wrangler, [
      'r2',
      'object',
      'put',
      `${r2}/models/${name}`,
      '--file',
      JSON.stringify(join(SRC, name)),
      '--content-type',
      'model/gltf-binary',
      '--remote',
    ])
  }
  console.log(`uploaded ${files.length} objects to r2://${r2}/models/`)
  console.log('Enable a public R2 custom domain, add CORS * for GET, then set PUBLIC_MODEL_BASE_URL.')
}

if (pages) {
  run(wrangler, ['pages', 'deploy', JSON.stringify(MODELS_DIR), '--project-name', pages])
  console.log(`Cloudflare Pages project ${pages}: set PUBLIC_MODEL_BASE_URL to the *.pages.dev origin.`)
}

const n = readdirSync(SRC).filter((name) => name.toLowerCase().endsWith('.glb')).length
const bytes = readdirSync(SRC).reduce((sum, name) => {
  const path = join(SRC, name)
  return sum + (statSync(path).isFile() ? statSync(path).size : 0)
}, 0)
console.log(`published ${n} files, ${(bytes / (1024 * 1024)).toFixed(1)} MB (not Supabase)`)
