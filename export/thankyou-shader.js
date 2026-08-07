/*
 * thankyou-shader.js
 * Self-contained WebGL "mesh gradient" background for the v2/Footer (THANK YOU) card.
 *
 * This is the static-site adaptation of the React/@react-three/fiber +
 * @paper-design/shaders-react component requested for the thank-you section.
 * Since this project is a Framer HTML export (no React/bundler), the same visual
 * effect is delivered as a dependency-free WebGL canvas + GLSL.
 *
 * Palette (monochrome, demo look): #000000 -> #1a1a1a -> #333333 -> #ffffff.
 * The card stays mostly dark so the white "THANK YOU" gradient text reads on top.
 *
 * Behaviour:
 *  - fills the card (canvas[data-thankyou-shader], absolute inset:0)
 *  - device-pixel-ratio aware (capped at 2), ResizeObserver-driven
 *  - pauses rAF when the footer is offscreen or the tab is hidden
 *  - respects prefers-reduced-motion (renders one static frame, no loop)
 *  - survives WebGL context loss/restore
 */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas[data-thankyou-shader]");
  if (!canvas) return;

  var gl =
    canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    }) || canvas.getContext("experimental-webgl");

  // No WebGL -> leave the black card background as the graceful fallback.
  if (!gl) return;

  var VERT = [
    "attribute vec2 aPos;",
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform float uTime;",
    "uniform vec2 uResolution;",
    "",
    "float hash(vec2 p){",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    "float noise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  float a = hash(i);",
    "  float b = hash(i + vec2(1.0, 0.0));",
    "  float c = hash(i + vec2(0.0, 1.0));",
    "  float d = hash(i + vec2(1.0, 1.0));",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);",
    "}",
    "float fbm(vec2 p){",
    "  float v = 0.0, a = 0.5;",
    "  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }",
    "  return v;",
    "}",
    "",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uResolution.xy;",
    "  float aspect = uResolution.x / max(uResolution.y, 1.0);",
    "  vec2 p = vec2(uv.x * aspect, uv.y);",
    // 0.25 gives a noticeable drift within a couple of seconds — the earlier
    // 0.05 was slow enough that a glance made the field look static.
    "  float t = uTime * 0.25;",
    "  vec2 q = vec2(fbm(p * 2.0 + t), fbm(p * 2.0 + vec2(5.2, 1.3) - t));",
    // Add a slow orbital pan so bright hotspots visibly drift across the
    // canvas rather than only shimmering in place.
    "  vec2 pan = vec2(cos(t * 0.7), sin(t * 0.5)) * 0.35;",
    "  float f = fbm(p * 3.0 + q * 1.6 + pan + t * 0.5);",
    "  f = clamp(f, 0.0, 1.0);",
    "  vec3 c0 = vec3(0.0);",          // #000000
    "  vec3 c1 = vec3(0.102);",        // #1a1a1a
    "  vec3 c2 = vec3(0.200);",        // #333333
    "  vec3 c3 = vec3(1.0);",          // #ffffff
    "  vec3 col = mix(c0, c1, smoothstep(0.00, 0.40, f));",
    "  col = mix(col, c2, smoothstep(0.35, 0.72, f));",
    "  col = mix(col, c3, smoothstep(0.86, 1.00, f));", // white only in sparse hotspots
    "  float vig = smoothstep(1.25, 0.25, length(uv - 0.5) * 1.4);",
    "  col *= mix(0.55, 1.0, vig);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  var program, aPosLoc, uTimeLoc, uResLoc, buffer;
  var raf = 0;
  var running = false;
  var startTime = 0;
  var reduceMotion = false;
  try {
    reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduceMotion = false;
  }

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      // eslint-disable-next-line no-console
      console.error("thankyou-shader compile error:", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function build() {
    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      // eslint-disable-next-line no-console
      console.error("thankyou-shader link error:", gl.getProgramInfoLog(program));
      return false;
    }

    aPosLoc = gl.getAttribLocation(program, "aPos");
    uTimeLoc = gl.getUniformLocation(program, "uTime");
    uResLoc = gl.getUniformLocation(program, "uResolution");

    // Full-screen triangle (covers clip space [-1,1]).
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    return true;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw(timeSeconds) {
    resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(uTimeLoc, timeSeconds);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (!running) return;
    if (!startTime) startTime = now;
    draw((now - startTime) / 1000);
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function init() {
    if (!build()) return;

    // First paint immediately (also the only paint under reduced motion).
    draw(reduceMotion ? 12.0 : 0);

    if (reduceMotion) return; // static frame, no animation loop

    // Kick the animation off eagerly if the canvas is on-screen right now,
    // rather than waiting for IntersectionObserver's first callback: some
    // contexts (backgrounded tabs, previews, iframes) throttle or gate IO on
    // document visibility, and without this the shader was drawing one frame
    // at init and never entering its rAF loop.
    if (!document.hidden && isOnScreen()) start();

    // IO still handles pause/resume as the footer scrolls in and out of view.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          if (entries[0] && entries[0].isIntersecting) start();
          else stop();
        },
        { threshold: 0 }
      );
      io.observe(canvas);
    }

    // Pause when the tab is hidden.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else if (isOnScreen()) start();
    });

    if ("ResizeObserver" in window) {
      new ResizeObserver(function () {
        // Redraw a frame on resize even if currently paused so it never shows stale pixels.
        if (!running) draw(reduceMotion ? 12.0 : (performance.now() - (startTime || performance.now())) / 1000);
      }).observe(canvas);
    } else {
      window.addEventListener("resize", function () {
        if (!running) draw(0);
      });
    }
  }

  function isOnScreen() {
    var r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 0) && r.width > 0;
  }

  // Context loss / restore handling.
  canvas.addEventListener(
    "webglcontextlost",
    function (e) {
      e.preventDefault();
      stop();
    },
    false
  );
  canvas.addEventListener(
    "webglcontextrestored",
    function () {
      startTime = 0;
      init();
    },
    false
  );

  init();
})();
