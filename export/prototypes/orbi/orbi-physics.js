// orbi-physics.js — Orbi's drive mode on real physics.
//
// MuJoCo 3.17.0 (the official @mujoco/mujoco WebAssembly build, vendored in ./vendor/mujoco/) steps
// sim/orbi/model.xml at its own 1 ms timestep. The controller below is a line-for-line port of
// sim/controller.py (class Gait): it only sets the 14 panel extension targets; whether the body
// moves is up to the physics. Nothing here is fetched from the network.
//
// Units. The model is SI, +Z up. The page is feet (1 unit = 0.3048 m), +Y up, and
// (x, y, z)_page -> (x, -z, y)_model. Everything on the `state` object and every argument of the
// public API is in PAGE units and PAGE panel order, except where the name says otherwise
// (speed in m/s, touch in N).
//
// Usage in the page:
//   import { loadOrbiPhysics } from './orbi-physics.js';
//   const phys = await loadOrbiPhysics();           // rejects if the wasm or the model cannot load
//   phys.reset({ pos:[x,y,z], quat:[x,y,z,w], ext:[...14], vel:[x,y,z] });
//   phys.setTarget(x, z, stopAt, origin /* [x,z] or null */);
//   phys.step(dt);                                  // fixed 1 ms steps, accumulator
//   phys.state.pos / .quat / .ext / .touch / .speed ...

export const PINNED_MUJOCO = '3.17.0';
export const FT = 0.3048;
const R = 1.0 * FT;
const PAD_ANG = 21.0 * Math.PI / 180;
const STROKE = 1.0 * R;
const A_PAD = R * Math.sin(PAD_ANG);
const C_PAD = A_PAD * A_PAD / R;
const NA = 14;

// panel axes in the model's order (build_model.py AXES)
export const AXES = [];
for (const s of [1, -1]) AXES.push([s, 0, 0], [0, s, 0], [0, 0, s]);
for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) AXES.push([x / Math.sqrt(3), y / Math.sqrt(3), z / Math.sqrt(3)]);

// page panel order -> model panel order. The page builds its axes with the same loops but in its own
// (Y-up) frame, so panel i of the page is the model panel whose axis is (x, -z, y) of the page's.
const PAGE_AXES = AXES;       // same list, read as page vectors
export const PAGE_TO_MODEL = PAGE_AXES.map(([x, y, z]) => {
  const want = [x, -z, y];
  let best = 0, bd = -2;
  AXES.forEach((a, j) => { const d = a[0] * want[0] + a[1] * want[1] + a[2] * want[2]; if (d > bd) { bd = d; best = j; } });
  return best;
});

const sqrt = Math.sqrt, min = Math.min, max = Math.max;
const clip = (v, a, b) => max(a, min(b, v));

// Extension at which a panel (the model's ellipsoid) first touches flat ground. build_model.contact_ext
export function contactExt(down, h = R) {
  if (!(down > 0.05)) return Infinity;
  const rim = sqrt(A_PAD * A_PAD * clip(1 - down * down, 0, 1) + C_PAD * C_PAD * down * down);
  const ext = (h - rim) / max(down, 1e-6) - R + C_PAD;
  return max(ext, 0.0);
}

// Top of the static terrain under a point, read from the compiled model. controller.Terrain
export class Terrain {
  constructor(model) {
    this.boxes = []; this.caps = [];
    const body = model.geom_bodyid, type = model.geom_type, pos = model.geom_pos, size = model.geom_size, quat = model.geom_quat;
    for (let g = 0; g < model.ngeom; g++) {
      if (body[g] !== 0) continue;
      const px = pos[3 * g], py = pos[3 * g + 1], pz = pos[3 * g + 2], s0 = size[3 * g], s1 = size[3 * g + 1], s2 = size[3 * g + 2];
      if (type[g] === 6) this.boxes.push([px - s0, px + s0, py - s1, py + s1, pz + s2]);
      else if (type[g] === 3) {
        const w = quat[4 * g], x = quat[4 * g + 1], y = quat[4 * g + 2], z = quat[4 * g + 3];
        const ax = 2 * (x * z + w * y), ay = 2 * (y * z - w * x);
        this.caps.push([px - ax * s1, py - ay * s1, px + ax * s1, py + ay * s1, s0]);
      }
    }
  }
  height(x, y) {
    let h = 0.0;
    for (const b of this.boxes) if (b[0] <= x && x <= b[1] && b[2] <= y && y <= b[3] && b[4] > h) h = b[4];
    for (const c of this.caps) {
      const vx = c[2] - c[0], vy = c[3] - c[1];
      const t = min(1.0, max(0.0, ((x - c[0]) * vx + (y - c[1]) * vy) / (vx * vx + vy * vy)));
      const ex = x - c[0] - vx * t, ey = y - c[1] - vy * t, dd = ex * ex + ey * ey, r = c[4];
      if (dd < r * r) h = max(h, r + sqrt(r * r - dd));
    }
    return h;
  }
  // lowest height the sphere's centre can sit at over (x, y) without cutting into the terrain
  // (used only to place the body when physics takes over from the scripted modes)
  centreRest(x, y) {
    let H = R;
    for (const b of this.boxes) {
      const dx = max(b[0] - x, 0, x - b[1]), dy = max(b[2] - y, 0, y - b[3]), d2 = dx * dx + dy * dy;
      if (d2 < R * R) H = max(H, b[4] + sqrt(R * R - d2));
    }
    for (const c of this.caps) {
      const vx = c[2] - c[0], vy = c[3] - c[1];
      const t = min(1.0, max(0.0, ((x - c[0]) * vx + (y - c[1]) * vy) / (vx * vx + vy * vy)));
      const ex = x - c[0] - vx * t, ey = y - c[1] - vy * t, d2 = ex * ex + ey * ey, rr = R + c[4];
      if (d2 < rr * rr) H = max(H, c[4] + sqrt(rr * rr - d2));
    }
    return H;
  }
}

// The panel-push gait. Port of sim/controller.py Gait; same names, same order of operations.
export class Gait {
  constructor(mj, model, data) {
    this.m = model; this.d = data;
    this.bid = mj.mj_name2id(model, mj.mjtObj.mjOBJ_BODY.value, 'shell');
    this.dt = model.opt.timestep;
    this.pad_speed = 1.0;            // ASSUMED max panel extension speed, m/s
    this.cruise = 0.9; this.approach = 0.9; this.deadband = 0.22;
    this.push_time = 0.30; this.cool_time = 0.06; this.score_min = 0.5; this.arrive = 0.12;
    this.lead = 0.06; this.depth_gain = 0.12; this.depth_min = 0.02; this.depth_max = 0.14;
    this.stand_lift = 0.03;
    this.climb = true; this.climb_speed = 0.35; this.zone_kh = 0.8; this.zone_kd = 0.6; this.zone_min = 0.5; this.lever_len = 1.2;
    this.carrot = 0.5; this.climb_steer = 1.5;
    this.jam_max = 1.4; this.jam_gain = 0.5; this.jam_decay = 2.0;
    this.prop_time = 2.5; this.rest_time = 0.7;
    this.hover = -0.003; this.latch_tol = 0.006; this.latch_speed = 0.1;
    this.terrain = null; this.look = [0.5, 0.8, 1.1, 1.4]; this.rise_min = 0.03; this.rise_max = 0.2;
    this.stall_time = 0.35;
    this.cmd = new Float64Array(NA); this.stance = new Float64Array(NA);
    this._aw = new Float64Array(NA * 3); this._ap = new Float64Array(NA * 3);
    this._down = new Float64Array(NA); this._extc = new Float64Array(NA); this._want = new Float64Array(NA);
    this.target = null; this.origin = null; this.stop_at = true;
    this.clear();
  }
  clear() {
    this.depth = 0.0; this.cmd.fill(0); this.stance.fill(0);
    this.push = -1; this.push_t = 0.0; this.cool = 0.0; this.push_dir = [0, 0];
    this.holding = false; this.latched = false; this.pushes = 0;
    this.jam = 0.0; this.prop = 0.0; this.rest = 0.0;
    this.stall = 0.0; this.lever_t = 0.0; this.push_lever = false; this.levers = 0;
    this.climbing = false;
  }
  step(ground_z = 0.0) {
    const d = this.d, dt = this.dt;
    const qpos = d.qpos, qvel = d.qvel, xmat = d.xmat;
    const px = qpos[0], py = qpos[1], pz = qpos[2], vx = qvel[0], vy = qvel[1], vz = qvel[2];
    if (this.terrain !== null) ground_z = this.terrain.height(px, py);
    const o9 = 9 * this.bid;
    const r00 = xmat[o9], r01 = xmat[o9 + 1], r02 = xmat[o9 + 2], r10 = xmat[o9 + 3], r11 = xmat[o9 + 4], r12 = xmat[o9 + 5],
      r20 = xmat[o9 + 6], r21 = xmat[o9 + 7], r22 = xmat[o9 + 8];
    // free-joint angular velocity is body-local: world = Rm @ w
    const wl0 = qvel[3], wl1 = qvel[4], wl2 = qvel[5];
    const wx = r00 * wl0 + r01 * wl1 + r02 * wl2, wy = r10 * wl0 + r11 * wl1 + r12 * wl2, wz = r20 * wl0 + r21 * wl1 + r22 * wl2;
    const aw = this._aw, ap = this._ap, down = this._down, ext_c = this._extc, want = this._want;
    const grounded = pz - ground_z < R + 0.02;
    const h = pz - ground_z;
    for (let i = 0; i < NA; i++) {
      const a = AXES[i];
      const ax = a[0] * r00 + a[1] * r01 + a[2] * r02, ay = a[0] * r10 + a[1] * r11 + a[2] * r12, az = a[0] * r20 + a[1] * r21 + a[2] * r22;
      aw[3 * i] = ax; aw[3 * i + 1] = ay; aw[3 * i + 2] = az;
      ap[3 * i] = ax + this.lead * (wy * az - wz * ay);
      ap[3 * i + 1] = ay + this.lead * (wz * ax - wx * az);
      ap[3 * i + 2] = az + this.lead * (wx * ay - wy * ax);
      down[i] = -az;
      ext_c[i] = contactExt(down[i], h);
      want[i] = 0.0;
    }
    let rate = this.pad_speed;
    this.climbing = false;
    if (this.target !== null) {
      const tx = this.target[0], ty = this.target[1];
      let dvx = tx - px, dvy = ty - py;
      const dist = sqrt(dvx * dvx + dvy * dvy);
      if (this.origin !== null && dist > this.carrot) {
        const ox = this.origin[0], oy = this.origin[1];
        let sx = tx - ox, sy = ty - oy;
        const L = sqrt(sx * sx + sy * sy);
        if (L > 1e-6) {
          sx /= L; sy /= L;
          const s = clip((px - ox) * sx + (py - oy) * sy + this.carrot, 0.0, L);
          dvx = ox + sx * s - px; dvy = oy + sy * s - py;
        }
      }
      const dn = sqrt(dvx * dvx + dvy * dvy);
      const dhx = dn > 1e-6 ? dvx / dn : 0, dhy = dn > 1e-6 ? dvy / dn : 0;
      const sp = sqrt(vx * vx + vy * vy);
      const vd = this.stop_at ? min(this.cruise, this.approach * dist) : this.cruise;
      const ex = dhx * vd - vx, ey = dhy * vd - vy;
      const en = sqrt(ex * ex + ey * ey);
      const near = this.stop_at && dist < 0.6;
      if (this.stop_at && (this.holding ? dist < 0.3 : (dist < this.arrive && sp < 0.3))) {
        // stand, in two beats: hover (feet come down, drag lightly, follow the orientation), then plant
        if (!this.holding) this.latched = false;
        this.holding = true; this.push = -1;
        if (!this.latched) {
          let nfeet = 0, worst = 0;
          for (let i = 0; i < NA; i++) {
            const foot = down[i] > 0.35 && ext_c[i] < 0.9 * STROKE;
            want[i] = foot ? max(contactExt(down[i], R) - this.hover, 0.0) : 0.0;
            if (foot) { nfeet++; worst = max(worst, Math.abs(qpos[7 + i] - want[i])); }
          }
          if (nfeet >= 3 && worst < this.latch_tol && sp < this.latch_speed) {
            for (let i = 0; i < NA; i++) {
              const foot = down[i] > 0.35 && ext_c[i] < 0.9 * STROKE;
              this.stance[i] = foot ? contactExt(down[i], R + this.stand_lift) : 0.0;
            }
            this.latched = true;
          }
        }
        if (this.latched) for (let i = 0; i < NA; i++) want[i] = this.stance[i];
      } else {
        this.holding = false;
        this.cool -= dt;
        const along = vx * dhx + vy * dhy;
        this.stall = (sp < 0.15 && along < 0.15 && dist > 0.4) ? this.stall + dt : max(0.0, this.stall - 2 * dt);
        if (this.stall > this.stall_time) {
          if (this.lever_t <= 0) this.levers += 1;
          this.lever_t = this.lever_len;
        }
        this.lever_t -= dt;
        let lever = this.lever_t > 0;
        // a climbable rise just ahead (what the range sensors would see): climb it on purpose
        if (this.terrain !== null && dist > 1e-6) {
          let top = -Infinity;
          for (const k of this.look) top = max(top, this.terrain.height(px + dhx * k * R, py + dhy * k * R));
          const rise = top - ground_z;
          if (this.rise_min < rise && rise < this.rise_max) lever = true;
        }
        // propped up and going nowhere for a while: let go, drop, and start the climb again
        this.rest -= dt;
        if (lever && this.climb && this.rest <= 0) {
          this.prop = sp < 0.05 ? this.prop + dt : 0.0;
          if (this.prop > this.prop_time) { this.prop = 0.0; this.jam = 0.0; this.rest = this.rest_time; }
        }
        if (this.rest > 0) lever = false;
        if (lever && this.climb) {
          // handled below
        } else if (this.push < 0 && this.cool <= 0 && en > (near ? 0.10 : this.deadband) && (grounded || lever)) {
          let ehx = ex / en, ehy = ey / en;
          if (lever) { ehx = dhx; ehy = dhy; }
          const kh = lever ? 0.80 : 0.62, kd = lever ? 0.60 : 0.78;
          let best = 0, bs = -Infinity;
          for (let i = 0; i < NA; i++) {
            let sc = -(ap[3 * i] * ehx + ap[3 * i + 1] * ehy) * kh - ap[3 * i + 2] * kd;
            if (ext_c[i] > 0.9 * STROKE) sc = -1;
            if (sc > bs) { bs = sc; best = i; }
          }
          if (bs > this.score_min) {
            this.push = best; this.push_t = this.push_time; this.push_dir = [ehx, ehy];
            this.depth = clip(this.depth_gain * en, near ? 0.006 : this.depth_min, this.depth_max);
            this.push_lever = lever;
            if (lever) { this.depth = STROKE; this.push_t = 0.6; }
            this.pushes += 1;
          }
        }
        if (this.push >= 0) {
          const k = this.push;
          want[k] = min(STROKE, ext_c[k] + this.depth);
          this.push_t -= dt;
          const closed = ex * this.push_dir[0] + ey * this.push_dir[1] < 0.03;
          const turned = aw[3 * k] * this.push_dir[0] + aw[3 * k + 1] * this.push_dir[1] > -0.08;
          const soft_end = !this.push_lever && (closed || turned || vz > 0.5);
          if (this.push_t <= 0 || soft_end || qpos[7 + k] > 0.97 * STROKE) { this.push = -1; this.cool = this.cool_time; }
        }
        // climb: every panel pointing down-and-back extends, slowly, as far as it goes
        if (lever && this.climb) {
          const lx = vx - dhx * along, ly = vy - dhy * along;
          let stx = dhx - this.climb_steer * lx, sty = dhy - this.climb_steer * ly;
          const sn = max(sqrt(stx * stx + sty * sty), 1e-6);
          stx /= sn; sty /= sn;
          this.jam = sp < 0.05 ? min(this.jam + dt, this.jam_max) : max(0.0, this.jam - this.jam_decay * dt);
          const zmin = this.zone_min - this.jam_gain * max(0.0, this.jam - 0.4);
          for (let i = 0; i < NA; i++) {
            const zone = (-(aw[3 * i] * stx + aw[3 * i + 1] * sty) * this.zone_kh - aw[3 * i + 2] * this.zone_kd) > zmin;
            want[i] = zone ? STROKE : 0.0;
          }
          rate = this.climb_speed;
          this.push = -1;
          this.climbing = true;
        }
      }
    }
    // panels move no faster than pad_speed
    const ctrl = d.ctrl, cmd = this.cmd, lo = -this.pad_speed * dt, hi = rate * dt;
    for (let i = 0; i < NA; i++) { cmd[i] += clip(want[i] - cmd[i], lo, hi); ctrl[i] = cmd[i]; }
  }
}

// Model + data + gait, with the page-unit API. `mj` is the loaded MuJoCo module, `xmlBytes` model.xml.
export function createEngine(mj, xmlBytes) {
  const version = mj.mj_versionString();
  if (version !== PINNED_MUJOCO) throw new Error(`mujoco ${version}; this page pins ${PINNED_MUJOCO}`);
  const vfs = new mj.MjVFS();
  let model;
  try {
    vfs.addBuffer('model.xml', xmlBytes);
    model = mj.MjModel.mj_loadXML('model.xml', vfs);
  } finally { vfs.delete(); }
  if (!model) throw new Error('model.xml did not compile');
  const data = new mj.MjData(model);
  const gait = new Gait(mj, model, data);
  const terrain = new Terrain(model);
  gait.terrain = terrain;
  const touchAdr = [];
  for (let j = 0; j < NA; j++) {
    const id = mj.mj_name2id(model, mj.mjtObj.mjOBJ_SENSOR.value, `touch${String(j + 1).padStart(2, '0')}`);
    touchAdr.push(model.sensor_adr[id]);
  }
  const h = model.opt.timestep;
  const state = {
    pos: [0, 1, 0],                 // sphere centre, page feet, Y up
    quat: [0, 0, 0, 1],             // three.js order (x, y, z, w), page frame
    vel: [0, 0, 0],                 // page feet / s
    ext: new Float64Array(NA),      // panel extension, page feet, page panel order
    cmd: new Float64Array(NA),      // commanded extension, same units and order
    touch: new Float64Array(NA),    // contact force on each panel, N, page panel order
    speed: 0,                       // horizontal speed of the centre, m/s
    grounded: true, holding: false, standing: false, climbing: false,
    time: 0, steps: 0, pushes: 0,
  };
  let acc = 0, disposed = false;
  const rt = { wp: -1, from: null, legT: 0, back: false, reached: 0, retries: 0 };
  const touchHold = new Float64Array(NA);

  function read() {
    const q = data.qpos, v = data.qvel, sd = data.sensordata;
    state.pos[0] = q[0] / FT; state.pos[1] = q[2] / FT; state.pos[2] = -q[1] / FT;
    // model quaternion (w, x, y, z); vector part maps (x, y, z)_model -> (x, z, -y)_page
    state.quat[0] = q[4]; state.quat[1] = q[6]; state.quat[2] = -q[5]; state.quat[3] = q[3];
    state.vel[0] = v[0] / FT; state.vel[1] = v[2] / FT; state.vel[2] = -v[1] / FT;
    for (let i = 0; i < NA; i++) {
      const j = PAGE_TO_MODEL[i];
      state.ext[i] = q[7 + j] / FT;
      state.cmd[i] = gait.cmd[j] / FT;
      state.touch[i] = touchHold[j];
    }
    state.speed = sqrt(v[0] * v[0] + v[1] * v[1]);
    state.grounded = q[2] - terrain.height(q[0], q[1]) < R + 0.02;
    state.holding = gait.holding; state.standing = gait.holding && gait.latched; state.climbing = gait.climbing;
    state.time = data.time; state.pushes = gait.pushes;
  }

  const api = {
    version, timestep: h, state, model, data, gait, terrain, mj,
    // Put the body where the page has drawn it. pos/vel in page feet, quat (x,y,z,w) page frame,
    // ext in page feet and page panel order. A pose that would cut into the terrain is lifted to
    // rest on it, and panels are shortened to just clear the ground; the caller can read `state`
    // afterwards and ease its drawing across the difference.
    reset({ pos = [0, 1, 0], quat = [0, 0, 0, 1], ext = null, vel = [0, 0, 0] } = {}) {
      mj.mj_resetData(model, data);
      gait.clear(); gait.target = null; gait.origin = null;
      const q = data.qpos, v = data.qvel;
      const x = pos[0] * FT, y = -pos[2] * FT;
      const z = max(pos[1] * FT, terrain.centreRest(x, y));
      const n = sqrt(quat[0] * quat[0] + quat[1] * quat[1] + quat[2] * quat[2] + quat[3] * quat[3]) || 1;
      const qw = quat[3] / n, qx = quat[0] / n, qy = -quat[2] / n, qz = quat[1] / n;
      q[0] = x; q[1] = y; q[2] = z; q[3] = qw; q[4] = qx; q[5] = qy; q[6] = qz;
      const lvx = vel[0] * FT, lvy = -vel[2] * FT, lvz = vel[1] * FT;
      v[0] = lvx; v[1] = lvy; v[2] = lvz;
      // rolling without slipping: w = z^ x v / R (world); the free joint wants it body-local
      const wwx = -lvy / R, wwy = lvx / R;
      const r00 = 1 - 2 * (qy * qy + qz * qz), r01 = 2 * (qx * qy - qw * qz), r10 = 2 * (qx * qy + qw * qz),
        r11 = 1 - 2 * (qx * qx + qz * qz), r20 = 2 * (qx * qz - qw * qy), r21 = 2 * (qy * qz + qw * qx);
      const r02 = 2 * (qx * qz + qw * qy), r12 = 2 * (qy * qz - qw * qx);
      v[3] = r00 * wwx + r10 * wwy; v[4] = r01 * wwx + r11 * wwy; v[5] = r02 * wwx + r12 * wwy;
      const hgt = z - terrain.height(x, y);
      for (let j = 0; j < NA; j++) {
        const a = AXES[j], az = a[0] * r20 + a[1] * r21 + a[2] * (1 - 2 * (qx * qx + qy * qy));
        let e = 0;
        if (ext) e = ext[PAGE_TO_MODEL.indexOf(j)] * FT;
        e = clip(min(e, contactExt(-az, hgt) - 0.004), 0, STROKE);
        q[7 + j] = e; data.ctrl[j] = e; gait.cmd[j] = e;
      }
      touchHold.fill(0);
      mj.mj_forward(model, data);
      acc = 0; state.steps = 0;
      rt.wp = -1; rt.from = null; rt.legT = 0; rt.back = false; rt.reached = 0; rt.retries = 0;
      read();
    },
    // Where to go: page (x, z). stopAt: stand on the panels on arrival. origin: page (x, z) where
    // this leg began (the rover then follows the line from there), or null to head straight for it.
    setTarget(x, z, stopAt = true, origin = null) {
      if (gait.target === null) gait.target = [0, 0];
      gait.target[0] = x * FT; gait.target[1] = -z * FT; gait.stop_at = !!stopAt;
      if (origin) { if (gait.origin === null) gait.origin = [0, 0]; gait.origin[0] = origin[0] * FT; gait.origin[1] = -origin[1] * FT; }
      else gait.origin = null;
    },
    clearTarget() { gait.target = null; gait.origin = null; },
    // Autopilot along `way` ([[x, z], ...] page feet, looped). Call once per frame before step();
    // pass the index you are heading for and use the one returned. A waypoint counts as reached
    // within `near` feet, or once the rover has crossed its finish line (so a fast pass does not
    // turn into circling back). No arrival within `patience` seconds (fell off the stairs, wedged
    // against something): go back one waypoint and take the leg again.
    route(way, wp, dt, near = 0.9, patience = 25) {
      const N = way.length, px = state.pos[0], pz = state.pos[2];
      wp = ((wp % N) + N) % N;
      let w = way[wp], arrived = Math.hypot(w[0] - px, w[1] - pz) < near;
      if (!arrived && rt.wp === wp && rt.from) {
        const sx = w[0] - rt.from[0], sz = w[1] - rt.from[1], L = Math.hypot(sx, sz);
        if (L > 1e-6) {
          const along = ((px - rt.from[0]) * sx + (pz - rt.from[1]) * sz) / L;
          const across = Math.abs((px - rt.from[0]) * sz - (pz - rt.from[1]) * sx) / L;
          arrived = along >= L && across < 2.5;
        }
      }
      if (arrived) { rt.from = [w[0], w[1]]; wp = (wp + 1) % N; rt.wp = wp; rt.legT = 0; if (!rt.back) rt.reached++; rt.back = false; }
      if (rt.wp !== wp) { rt.wp = wp; rt.from = [px, pz]; rt.legT = 0; }
      rt.legT += dt;
      if (rt.legT > patience) {
        wp = (wp + (rt.back ? 1 : N - 1)) % N; rt.back = !rt.back; rt.wp = wp; rt.from = [px, pz]; rt.legT = 0; rt.retries++;
      }
      w = way[wp];
      api.setTarget(w[0], w[1], false, rt.from);
      return wp;
    },
    routeInfo: null,
    // Advance by dt seconds of wall time in whole 1 ms steps (the remainder carries over).
    step(dt, maxSteps = 80) {
      if (disposed) return 0;
      acc += dt;
      let n = Math.floor(acc / h + 1e-9);
      acc -= n * h;
      if (n > maxSteps) { n = maxSteps; acc = 0; }       // a long frame: drop the backlog, never fast-forward
      touchHold.fill(0);
      for (let i = 0; i < n; i++) {
        gait.step();
        mj.mj_step(model, data);
        const sd = data.sensordata;
        for (let j = 0; j < NA; j++) { const f = sd[touchAdr[j]]; if (f > touchHold[j]) touchHold[j] = f; }
      }
      state.steps += n;
      if (n) read();
      const q = data.qpos;
      if (!(Number.isFinite(q[0]) && Number.isFinite(q[1]) && Number.isFinite(q[2]))) throw new Error('orbi physics diverged');
      return n;
    },
    dispose() { if (!disposed) { disposed = true; data.delete(); model.delete(); } },
  };
  api.routeInfo = rt;
  api.reset();
  return api;
}

// Browser loader: the vendored wasm build and the model, both from files next to this module.
export async function loadOrbiPhysics({ base = new URL('.', import.meta.url) } = {}) {
  const [{ default: loadMujoco }, res] = await Promise.all([
    import(new URL('vendor/mujoco/mujoco.js', base).href),
    fetch(new URL('sim/orbi/model.xml', base)),
  ]);
  if (!res.ok) throw new Error(`sim/orbi/model.xml: HTTP ${res.status}`);
  const xml = new Uint8Array(await res.arrayBuffer());
  const mj = await loadMujoco();
  return createEngine(mj, xml);
}
