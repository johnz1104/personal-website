// The painted water: a WebGL2 layer under the dots that paints the whole flow at once
// as brushwork, so every swirl shows as a shape even in a still frame (a still picture
// of turbulence, like Starry Night), and the motion itself can stay slow.
//
// How it paints (idea-painted-river, an experiment):
// - A noise texture holds the "paint": R decides where strokes are, G which pigment
//   (coarse, so neighbouring strokes share a colour, in bands), B sparse highlights, A
//   large soft blotches for the wash.
// - The noise is carried by the water: a displacement texture is advected with the flow
//   every frame (semi-Lagrangian), in two phases half a period apart that reset in turn
//   and cross-fade, so it never stretches without limit and never pops (Lagrangian-
//   Eulerian advection, Jobard et al. 2002; the "flow map" trick of game water).
// - Each pixel is a line integral convolution (Cabral and Leedom 1993): the carried
//   noise averaged along the streamline through it, which turns blobs into streaks that
//   follow the current: shorter dabs in slow water, longer strokes in fast.
// - The result is posterized onto a few pigments over a soft wash whose tone follows the
//   speed, with pigment pooling at the bank and a static paper grain.
//
// Everything is in page units over the river's whole area, the same frame as the dots;
// only the final pass knows about the window. Sim time drives everything, so slow
// motion (look.timeScale) slows the paint with the dots.

const NOISE_SIZE = 256;
const MAX_COLORS = 6;

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// Shared: the flow's velocity texture (page units/s in rg, water 0..1 in b), placed on
// the page by the solver's grid (river_grid).
const FIELD = `
uniform sampler2D u_vel;
uniform vec4 u_grid;       // x0, y0, h, unused
uniform vec2 u_gridSize;   // nx, ny
vec3 field(vec2 p) {
  return texture(u_vel, (p - u_grid.xy) / (u_grid.z * u_gridSize)).rgb;
}`;

const ADVECT = `#version 300 es
precision highp float;
${FIELD}
uniform sampler2D u_disp;   // phase 0 in xy, phase 1 in zw: page units
uniform vec2 u_dispSize;
uniform vec2 u_river;
uniform float u_dt;
uniform vec2 u_reset;
out vec4 o;
void main() {
  vec2 p = gl_FragCoord.xy / u_dispSize * u_river;
  vec2 v = field(p).xy;
  vec2 mid = field(p - 0.5 * u_dt * v).xy;
  vec2 back = p - u_dt * mid;
  vec4 d = texture(u_disp, back / u_river) - u_dt * vec4(mid, mid);
  if (u_reset.x > 0.5) d.xy = vec2(0.0);
  if (u_reset.y > 0.5) d.zw = vec2(0.0);
  o = d;
}`;

const PAINT = `#version 300 es
precision highp float;
${FIELD}
uniform sampler2D u_disp;
uniform sampler2D u_noise;
uniform sampler2D u_mask;
uniform vec2 u_river;
uniform float u_pxPerUnit;
uniform float u_canvasH;
uniform vec2 u_phase;        // weights of the two phases (sum 1)
uniform vec4 u_offset;       // each phase's offset into the noise, page units
uniform float u_noiseScale;  // page units per noise texel
uniform float u_step;        // streamline step, page units
uniform float u_vRef;        // speed at which strokes reach full length (page units/s)
uniform float u_contrast;
uniform float u_soft;        // softness of the strokes' edges
uniform float u_coverage;    // 0..1: how much of the fast water strokes cover
uniform float u_calm;        // strokes in slow water, relative to fast (0..1)
uniform float u_depth;       // how much the speed darkens the pigments (0..1)
uniform float u_strokeAlpha;
uniform vec3 u_colors[${MAX_COLORS}];
uniform int u_colorCount;
uniform vec3 u_washSlow;
uniform vec3 u_washFast;
uniform vec3 u_shallow;
uniform float u_shore;       // how far the shallow colour reaches from the bank (0..1)
uniform float u_shoreLod;    // log2 of the page units over which the bank counts as near
uniform float u_nearLod;     // the same for the strokes' fade at the bank
uniform vec3 u_highlight;
uniform float u_highlights;
uniform float u_grain;
uniform float u_edge;
uniform float u_opacity;
uniform float u_washAlpha;
uniform float u_lumaMatch;   // 0..1: strokes take the wash's lightness, keeping their hue
out vec4 o;

#define STEPS 12

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

// The two phases' noise at q, carried by the water.
void carried(vec2 q, float w, inout vec3 s0, inout vec3 s1) {
  vec4 d = texture(u_disp, q / u_river);
  float scale = 1.0 / (u_noiseScale * ${NOISE_SIZE}.0);
  s0 += w * texture(u_noise, (q + d.xy + u_offset.xy) * scale).rgb;
  s1 += w * texture(u_noise, (q + d.zw + u_offset.zw) * scale).rgb;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_canvasH - gl_FragCoord.y) / u_pxPerUnit;
  float water = texture(u_mask, p / u_river).r;
  if (water <= 0.004) { o = vec4(0.0); return; }
  vec3 f0 = field(p);
  float speed = length(f0.xy);

  // Line integral convolution along the streamline through p, both ways.
  vec3 s0 = vec3(0.0), s1 = vec3(0.0);
  float wsum = 1.0;
  carried(p, 1.0, s0, s1);
  for (int side = 0; side < 2; side++) {
    float dir = side == 0 ? 1.0 : -1.0;
    vec2 q = p;
    vec2 heading = speed > 1e-3 ? f0.xy / speed : vec2(0.0, -1.0);
    for (int k = 1; k <= STEPS; k++) {
      vec3 f = field(q);
      float len = length(f.xy);
      if (len > 1e-3) heading = f.xy / len;
      if (f.z < 0.5) break;
      float st = u_step * clamp(len / u_vRef, 0.3, 1.0);
      vec3 fm = field(q + 0.5 * dir * st * heading);
      float lm = length(fm.xy);
      if (lm > 1e-3) heading = fm.xy / lm;
      q += dir * st * heading;
      float w = 0.5 + 0.5 * cos(3.14159265 * float(k) / float(STEPS + 1));
      carried(q, w, s0, s1);
      wsum += w;
    }
  }
  vec3 s = (u_phase.x * s0 + u_phase.y * s1) / wsum;
  // Two independent noises cross-fading lose contrast mid-way; this keeps it level.
  float level = inversesqrt(max(dot(u_phase, u_phase), 0.25));
  vec3 n = 0.5 + (s - 0.5) * level * u_contrast;

  // The wash: lighter where the water is slow, deeper where it runs, with soft blotches.
  float fast = smoothstep(0.15 * u_vRef, 1.2 * u_vRef, speed);
  float blotch = texture(u_noise, p / (u_noiseScale * ${NOISE_SIZE}.0) * 0.25).a;
  vec3 wash = mix(u_washSlow, u_washFast, fast) * (0.96 + 0.08 * blotch);
  // Shallow water along the bank: lighter, like the shore in a Ghibli background.
  float open = textureLod(u_mask, p / u_river, u_shoreLod).r;
  float shallow = (1.0 - smoothstep(0.55, 0.98, open)) * u_shore;
  wash = mix(wash, u_shallow, shallow);

  // Strokes: where the streaked R noise is high, mostly in the currents (slow water
  // stays a quiet wash), and none right at the bank where the flow is too slow to
  // streak. Pigment from the coarse G noise, deeper in fast water, posterized onto the
  // palette with soft band edges.
  float near = textureLod(u_mask, p / u_river, u_nearLod).r;
  float cover = u_coverage * mix(u_calm, 1.0, fast) * smoothstep(0.6, 0.95, near);
  float edge0 = 1.0 - cover;
  float stroke = smoothstep(edge0 - u_soft, edge0 + u_soft, n.r) * u_strokeAlpha * step(0.02, cover);
  float shade = mix(n.g, 1.0 - fast, u_depth);
  float g = clamp(shade, 0.0, 0.9999) * float(u_colorCount);
  int band = int(floor(g));
  float t = smoothstep(0.75, 1.0, fract(g));
  vec3 pigment = u_colors[0];
  vec3 nextPigment = u_colors[0];
  for (int i = 0; i < ${MAX_COLORS}; i++) {
    if (i == band) pigment = u_colors[i];
    if (i == min(band + 1, u_colorCount - 1)) nextPigment = u_colors[i];
  }
  pigment = mix(pigment, nextPigment, t);
  // Colour rather than lightness: the eye follows moving lightness far more than moving
  // hue, so strokes nearer the wash's lightness read as calmer, however vivid.
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  pigment = clamp(pigment + (dot(wash, LUMA) - dot(pigment, LUMA)) * u_lumaMatch, 0.0, 1.0);
  vec3 rgb = mix(wash, pigment, stroke);

  // Highlights: rare short light strokes, brighter in fast water.
  float glint = smoothstep(0.05, 0.11, s.b * level) * u_highlights * (0.4 + 0.6 * fast);
  rgb = mix(rgb, u_highlight, glint);

  // Pigment pools where the water meets the bank, as in watercolour.
  rgb *= 1.0 - u_edge * clamp(1.0 - near, 0.0, 1.0);

  // Paper grain, fixed to the page.
  rgb *= 1.0 + u_grain * (hash(floor(p * 1.5)) - 0.5);

  float alpha = u_opacity * water * mix(u_washAlpha, 1.0, max(stroke, glint));
  o = vec4(rgb * alpha, alpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`paint shader: ${log}`);
  }
  return shader;
}

function program(gl, fragment) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(prog, 0, "a_pos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`paint program: ${gl.getProgramInfoLog(prog)}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(prog, i);
    uniforms[name.replace(/\[0\]$/, "")] = gl.getUniformLocation(prog, name);
  }
  return { prog, uniforms };
}

function texture(gl, { width, height, internal, format, type, data = null, filter, wrap }) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}

// A small seeded generator, so the paint's noise is the same on every visit.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise at `cells` x `cells`, smoothly upsampled to NOISE_SIZE and tiling.
function smoothNoise(rand, cells) {
  const grid = Array.from({ length: cells * cells }, rand);
  const out = new Float32Array(NOISE_SIZE * NOISE_SIZE);
  const at = (i, j) => grid[((j + cells) % cells) * cells + ((i + cells) % cells)];
  for (let y = 0; y < NOISE_SIZE; y++) {
    const gy = (y / NOISE_SIZE) * cells;
    const j = Math.floor(gy);
    const fy = gy - j;
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < NOISE_SIZE; x++) {
      const gx = (x / NOISE_SIZE) * cells;
      const i = Math.floor(gx);
      const fx = gx - i;
      const sx = fx * fx * (3 - 2 * fx);
      const top = at(i, j) + sx * (at(i + 1, j) - at(i, j));
      const bottom = at(i, j + 1) + sx * (at(i + 1, j + 1) - at(i, j + 1));
      out[y * NOISE_SIZE + x] = top + sy * (bottom - top);
    }
  }
  return out;
}

function makeNoise() {
  const rand = random(20261005);
  const pigment = smoothNoise(rand, 48);
  const blotch = smoothNoise(rand, 12);
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE * 4);
  for (let i = 0; i < NOISE_SIZE * NOISE_SIZE; i++) {
    data[4 * i] = Math.floor(rand() * 256);
    data[4 * i + 1] = Math.floor(pigment[i] * 255);
    data[4 * i + 2] = rand() < 0.012 ? 255 : 0;
    data[4 * i + 3] = Math.floor(blotch[i] * 255);
  }
  return data;
}

function rgb(color) {
  const hex = color.trim().replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

// The look's paint settings, with defaults. Colors are hex strings.
// Calm by default: wide, soft, low-contrast strokes renewed slowly. The first, denser
// version is the `starry` look in config.js.
export const PAINT_DEFAULTS = Object.freeze({
  opacity: 0.8,        // the whole layer
  washAlpha: 0.6,      // the wash between strokes, relative to the strokes
  strokeAlpha: 0.5,
  // The author (2026-10-05): the slow pocket in the upper curve looked empty next to
  // the rest of the river, natural for the flow but not to the eye. So slow water is
  // painted almost like the current (calm 0.15 -> 0.6, depth 0.45 -> 0.25, vRef 30 ->
  // 15) and the pale band at the bank is narrower (shoreWidth 90 -> 30, nearWidth 23
  // -> 12): in the enclosed pocket the old widths made all of it "near the bank".
  coverage: 0.4,       // how much of the fast water strokes cover
  calm: 0.6,           // strokes in slow water, relative to fast
  depth: 0.25,         // how much the speed deepens the pigments
  contrast: 1.4,
  soft: 0.05,          // softness of the strokes' edges
  noiseScale: 7,       // page units per noise texel: about the strokes' width
  step: 4,             // page units per streamline step (12 each way): their length
  vRef: 15,            // page units/s at which strokes reach full length
  period: 6,           // sim seconds for the noise to be carried before it is renewed
  highlights: 0.8,
  grain: 0.05,
  edge: 0.1,
  lumaMatch: 0,        // 0..1: strokes take the wash's lightness and keep their hue
  // Real seconds for the water to fade in, from the first frame painted. It was 2 sim
  // seconds, which slow motion stretched with the playback rate. The author tried 6
  // (2026-10-05), then went back to the earlier feel, fully in by about 7.5 s after the
  // page loads: 8 s, the old fade at quarter speed (the eased curve is all but full at
  // 90%, and the river starts about 0.5 s in).
  fade: 8,
  colors: ["#3f6fb3", "#5d90c8", "#86b2d8", "#b5d2e6"],
  washSlow: "#e2ebe6",
  washFast: "#bcd4e4",
  shallow: "#eef3ea",
  shore: 0.7,
  shoreWidth: 30,      // page units over which the shallow colour judges the bank near
  nearWidth: 12,       // page units from the bank over which the strokes fade out
  highlight: "#fffbf0",
  resolution: 1,       // canvas pixels per CSS pixel (at most devicePixelRatio)
});

// Creates the painter on `canvas`, or returns null where WebGL2 or float render targets
// are missing (the page then shows the dots alone).
export function createPainter(canvas, river) {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const advect = program(gl, ADVECT);
  const paint = program(gl, PAINT);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const noise = texture(gl, {
    width: NOISE_SIZE, height: NOISE_SIZE, internal: gl.RGBA8, format: gl.RGBA,
    type: gl.UNSIGNED_BYTE, data: makeNoise(), filter: gl.LINEAR, wrap: gl.REPEAT,
  });

  // The water: the river's area between its banks, at one texel per page unit, with
  // mipmaps for the pooling at the bank.
  const mask = (() => {
    const W = Math.ceil(river.width);
    const H = Math.ceil(river.height);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    // Opaque black land under white water: the red channel is the water.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    const bankX = (bank, y) => {
      const s = bank.segments.find((seg) => y >= seg.y0 && y <= seg.y1) ?? bank.segments.at(-1);
      const u = Math.min(Math.max(y, s.y0), s.y1) - s.y0;
      return s.a + u * (s.b + u * (s.c + u * s.d));
    };
    for (let y = 0; y <= H; y += 2) ctx.lineTo(bankX(river.left, y), y);
    for (let y = H; y >= 0; y -= 2) ctx.lineTo(river.right ? bankX(river.right, y) : W, y);
    ctx.closePath();
    ctx.fill();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  })();

  // Displacements at one texel per 3 page units, ping-ponged.
  const dispSize = [Math.ceil(river.width / 3), Math.ceil(river.height / 3)];
  const disp = [0, 1].map(() => {
    const tex = texture(gl, {
      width: dispSize[0], height: dispSize[1], internal: gl.RGBA16F, format: gl.RGBA,
      type: gl.HALF_FLOAT, filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE,
    });
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fbo };
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let current = 0;

  let vel = null;
  let grid = null;
  let packed = null;
  let phase = 0;   // in periods
  let firstFrame = null;   // performance.now() of the first frame painted: the fade-in starts
  // Each phase reads the noise at a new random offset after it resets (while its weight
  // is zero), so the pattern never repeats.
  const offset = new Float32Array(4);
  const rand = random(7);
  const jump = (i) => {
    offset[2 * i] = rand() * NOISE_SIZE * 8;
    offset[2 * i + 1] = rand() * NOISE_SIZE * 8;
  };
  jump(0);
  jump(1);

  const bind = (unit, tex) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  };
  const setField = (u, { x0, y0, h, nx, ny }) => {
    gl.uniform4f(u.u_grid, x0, y0, h, 0);
    gl.uniform2f(u.u_gridSize, nx, ny);
  };

  return {
    // A frame's flow (worker.js, `field`): velocity in page units/s, water where the
    // density is a number.
    setField(field) {
      const { nx, ny, velocityScale, flow } = field;
      const cells = nx * ny;
      if (!packed || packed.length !== 3 * cells) packed = new Float32Array(3 * cells);
      for (let i = 0; i < cells; i++) {
        const wet = Number.isNaN(flow[i]) ? 0 : 1;
        packed[3 * i] = wet * flow[cells + i] * velocityScale;
        packed[3 * i + 1] = wet * flow[2 * cells + i] * velocityScale;
        packed[3 * i + 2] = wet;
      }
      if (!vel || grid.nx !== nx || grid.ny !== ny) {
        if (vel) gl.deleteTexture(vel);
        vel = texture(gl, {
          width: nx, height: ny, internal: gl.RGB16F, format: gl.RGB, type: gl.FLOAT,
          data: packed, filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE,
        });
      } else {
        gl.bindTexture(gl.TEXTURE_2D, vel);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nx, ny, gl.RGB, gl.FLOAT, packed);
      }
      grid = field;
    },

    // Carry the paint with the water for `dt` sim seconds.
    advect(dt, look) {
      if (!vel || !(dt > 0)) return;
      const period = look.period ?? PAINT_DEFAULTS.period;
      const before = [phase % 1, (phase + 0.5) % 1];
      phase += dt / period;
      const after = [phase % 1, (phase + 0.5) % 1];
      const next = 1 - current;
      gl.bindFramebuffer(gl.FRAMEBUFFER, disp[next].fbo);
      gl.viewport(0, 0, dispSize[0], dispSize[1]);
      gl.disable(gl.BLEND);
      gl.useProgram(advect.prog);
      const u = advect.uniforms;
      bind(0, vel);
      bind(1, disp[current].tex);
      gl.uniform1i(u.u_vel, 0);
      gl.uniform1i(u.u_disp, 1);
      setField(u, grid);
      gl.uniform2f(u.u_dispSize, dispSize[0], dispSize[1]);
      gl.uniform2f(u.u_river, river.width, river.height);
      gl.uniform1f(u.u_dt, dt);
      const reset = [after[0] < before[0], after[1] < before[1]];
      reset.forEach((r, i) => r && jump(i));
      gl.uniform2f(u.u_reset, reset[0] ? 1 : 0, reset[1] ? 1 : 0);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      current = next;
    },

    // Draw the water for the window: `scale` CSS px per page unit, `dpr` the
    // canvas's device pixel ratio. Sizes the canvas's backing store to match.
    render({ scale, dpr, look, visible = true }) {
      const res = Math.min(dpr, look.resolution ?? PAINT_DEFAULTS.resolution);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * res));
      const height = Math.max(1, Math.round(rect.height * res));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!vel || !visible) return;
      firstFrame ??= performance.now();
      const value = (key) => look[key] ?? PAINT_DEFAULTS[key];
      gl.useProgram(paint.prog);
      const u = paint.uniforms;
      bind(0, vel);
      bind(1, disp[current].tex);
      bind(2, noise);
      bind(3, mask);
      gl.uniform1i(u.u_vel, 0);
      gl.uniform1i(u.u_disp, 1);
      gl.uniform1i(u.u_noise, 2);
      gl.uniform1i(u.u_mask, 3);
      setField(u, grid);
      gl.uniform2f(u.u_river, river.width, river.height);
      gl.uniform1f(u.u_pxPerUnit, scale * res);
      gl.uniform1f(u.u_canvasH, height);
      const t = phase % 1;
      const w0 = 1 - Math.abs(2 * t - 1);
      gl.uniform2f(u.u_phase, w0, 1 - w0);
      gl.uniform4fv(u.u_offset, offset);
      gl.uniform1f(u.u_noiseScale, value("noiseScale"));
      gl.uniform1f(u.u_step, value("step"));
      gl.uniform1f(u.u_vRef, value("vRef"));
      gl.uniform1f(u.u_contrast, value("contrast"));
      gl.uniform1f(u.u_soft, value("soft"));
      gl.uniform1f(u.u_coverage, value("coverage"));
      gl.uniform1f(u.u_calm, value("calm"));
      gl.uniform1f(u.u_depth, value("depth"));
      gl.uniform1f(u.u_strokeAlpha, value("strokeAlpha"));
      const colors = value("colors").slice(0, MAX_COLORS);
      const flat = new Float32Array(3 * MAX_COLORS);
      colors.forEach((c, i) => flat.set(rgb(c), 3 * i));
      gl.uniform3fv(u.u_colors, flat);
      gl.uniform1i(u.u_colorCount, colors.length);
      gl.uniform3fv(u.u_washSlow, rgb(value("washSlow")));
      gl.uniform3fv(u.u_washFast, rgb(value("washFast")));
      gl.uniform3fv(u.u_highlight, rgb(value("highlight")));
      gl.uniform3fv(u.u_shallow, rgb(value("shallow")));
      gl.uniform1f(u.u_shore, value("shore"));
      gl.uniform1f(u.u_shoreLod, Math.log2(Math.max(1, value("shoreWidth"))));
      gl.uniform1f(u.u_nearLod, Math.log2(Math.max(1, value("nearWidth"))));
      gl.uniform1f(u.u_highlights, value("highlights"));
      gl.uniform1f(u.u_grain, value("grain"));
      gl.uniform1f(u.u_edge, value("edge"));
      const fade = Math.min(1, (performance.now() - firstFrame) / 1000 / Math.max(0.01, value("fade")));
      // Eased out: the water shows from the first frames and settles gently (the author,
      // 2026-10-05: "the gradual speed is fine, but i feel like it starts it too slow";
      // it was eased in and out, half-way only at the midpoint).
      gl.uniform1f(u.u_opacity, value("opacity") * (1 - (1 - fade) * (1 - fade)));
      gl.uniform1f(u.u_washAlpha, value("washAlpha"));
      gl.uniform1f(u.u_lumaMatch, value("lumaMatch"));
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
