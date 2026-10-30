import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

// Usage: node scripts/build-intel-assets.mjs /path/to/1_Intel
// Source GIFs stay untouched. Only derived web assets are written to export/.
if (!process.argv[2]) throw Error('Provide the folder containing the four Intel GIFs and geintel3.jpg');
const source = resolve(process.argv[2]);
const output = fileURLToPath(new URL('../export/assets/intel/', import.meta.url));
await mkdir(output, { recursive: true });
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(stdout) : reject(Error(stderr)));
  });
}
const assets = [];
for (const number of ['01', '02', '03', '05']) {
  const original = join(source, `Animation${number}.gif`);
  const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,nb_frames,r_frame_rate', '-of', 'json', original]));
  const duration = Number(probe.format.duration);
  const video = `animation-${number}.mp4`, poster = `animation-${number}-poster.jpg`;
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ignore_loop', '1', '-i', original,
    '-vf', `fps=${probe.streams[0].r_frame_rate},scale=800:-2:flags=lanczos`, '-t', String(duration),
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '25', '-pix_fmt', 'yuv420p',
    '-video_track_timescale', '1000', '-movflags', '+faststart', join(output, video)]);
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', String(duration * .5),
    '-i', join(output, video), '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '6', join(output, poster)]);
  const sourceBytes = (await stat(original)).size, videoBytes = (await stat(join(output, video))).size;
  assets.push({ source: `Animation${number}.gif`, video, poster, width: 800,
    height: Math.round(800 * probe.streams[0].height / probe.streams[0].width), duration, sourceBytes, videoBytes });
  console.log(`${video}: ${(videoBytes / 1024).toFixed(0)} KB, ${duration}s (source ${(sourceBytes / 1048576).toFixed(1)} MB)`);
}
await copyFile(join(source, 'geintel3.jpg'), join(output, 'campaign-social.jpg'));
await writeFile(join(output, 'media.json'), JSON.stringify(assets, null, 2) + '\n');
console.log('Intel web assets generated; original artwork and animation timing preserved.');
