/**
 * Encodes public/splash/icon-splash-screen3.gif → WebM + MP4 for smooth splash playback.
 * Run: npm run encode:splash (requires devDependency ffmpeg-static).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPathImport from 'ffmpeg-static'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ffmpegStaticDir = join(__dirname, '..', 'node_modules', 'ffmpeg-static')
const ffmpegBinName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
let ffmpegPath = ffmpegPathImport || join(ffmpegStaticDir, ffmpegBinName)

if (!existsSync(ffmpegPath)) {
  console.log('Downloading ffmpeg binary…')
  const installScript = join(ffmpegStaticDir, 'install.js')
  if (existsSync(installScript)) {
    spawnSync(process.execPath, [installScript], { stdio: 'inherit', cwd: ffmpegStaticDir })
    ffmpegPath = join(ffmpegStaticDir, ffmpegBinName)
  }
}
const publicSplash = join(__dirname, '..', 'public', 'splash')
const gif = join(publicSplash, 'icon-splash-screen3.gif')
const webm = join(publicSplash, 'icon-splash-screen3.webm')
const mp4 = join(publicSplash, 'icon-splash-screen3.mp4')

if (!existsSync(gif)) {
  console.error('Missing source GIF:', gif)
  process.exit(1)
}

function isFresh(outputPath) {
  if (!existsSync(outputPath)) return false
  return statSync(outputPath).mtimeMs >= statSync(gif).mtimeMs
}

if (isFresh(webm) && isFresh(mp4)) {
  console.log('Splash videos up to date — skip encode.')
  process.exit(0)
}

if (!ffmpegPath) {
  console.error('ffmpeg-static binary not found')
  process.exit(1)
}

function run(args) {
  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const vf = 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos'

console.log('Encoding WebM (VP9)…')
run([
  '-y',
  '-i',
  gif,
  '-an',
  '-vf',
  vf,
  '-c:v',
  'libvpx-vp9',
  '-b:v',
  '0',
  '-crf',
  '28',
  '-row-mt',
  '1',
  '-pix_fmt',
  'yuv420p',
  webm,
])

console.log('Encoding MP4 (H.264) for Safari…')
run([
  '-y',
  '-i',
  gif,
  '-an',
  '-vf',
  vf,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '20',
  '-movflags',
  '+faststart',
  '-pix_fmt',
  'yuv420p',
  mp4,
])

console.log('Done:', webm, mp4)
