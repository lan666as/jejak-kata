// node tests/site/film.mjs <site url> <out dir> [desktop|phone] [--frames] [--seconds N]   The site presented to a jury,
// as a person would show it: at 1440x900 with a mouse, and at 390x844 by touch. In order: the arrival on the first page
// (the sea lights up, the first route sails, the notes say what a light and a route are); a word typed and sailed; the
// dive, the sea turning into the chart; a story opened from its card (the cover, several steps, the landing); the map
// (turned, tilted, a second word added, seen from above and back); a word's page and its voyage played; the share
// sheet. The pointer moves on the site's curve and pauses where a person would. Meant for a machine with a GPU (the
// GPU switches gpu.mjs uses); on a machine without one it runs, slowly, to check it. Nothing here is part of a deploy.
//
// Two ways to record the same choreography:
// - as it plays (the default): Playwright's video, <out>/film-<name>.webm (VP8, 25 frames a second, its own bitrate);
// - --frames: frame by frame at 60 a second, deterministic. Chromium's headless shell runs with begin-frame control
//   and virtual time: each frame the page's clock moves on exactly 1/60 s (timers, requestAnimationFrame, CSS and
//   scroll animations; fetches still pending hold the clock) and the frame is then drawn and captured whole
//   (HeadlessExperimental.beginFrame), so the film does not depend on how fast the machine is. 1440x900 at 2x and
//   390x844 at 3x; the frames go to ffmpeg (H.264, CRF 16, yuv420p) as <out>/film-<name>.mp4. ffmpeg is looked for in
//   $FFMPEG, then on the PATH, then in ~/.cache/ffmpeg-static; without it the frames are written to <out>/<name>/ as PNG.
//   --seconds N stops each film after N seconds (to check a setup). The shell is $HEADLESS_SHELL or Playwright's own
//   (npx playwright install chromium-headless-shell).
import { mkdirSync, renameSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn, spawnSync } from "node:child_process";

const args = process.argv.slice(2), flag = (name) => args.includes(name), value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const [url, out = "film", only] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--seconds");
if (!url) (console.error("node tests/site/film.mjs <site url> <out dir> [desktop|phone] [--frames] [--seconds N]"), process.exit(2));
mkdirSync(out, { recursive: true });
const FPS = 60, FRAME = 1000 / FPS, LIMIT = value("--seconds") ? +value("--seconds") * FPS : Infinity;
const GPU = ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu", "--enable-unsafe-swiftshader"];
const at = (route) => new URL(route, url).href;  // "#/peta" on the live site is sent on to its own address
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const started = Date.now(), say = (what) => console.log(`${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s  ${what}`);
class Done extends Error {}  // --seconds reached

/** A person in front of the page: a pointer (or a finger) that moves on a curve and pauses, and an eased scroll. `d` is
 *  the driver (below): what moves the pointer, presses keys and lets time pass. */
function presenter(d, touch) {
  let x = 720, y = 450;
  const { pause } = d;
  /** The pointer glides to a point (or the middle of what a selector names) in `ms`, a frame at a time. */
  const glide = async (to, ms = 900) => {
    const [tx, ty] = typeof to === "string" ? await d.box(to).then((b) => [b.x + b.width / 2, b.y + b.height / 2]) : to;
    if (!touch) for (let f = 1, n = Math.max(2, Math.round(ms / 16)); f <= n; f++) {
      const e = ease(f / n);
      await d.move(x + (tx - x) * e, y + (ty - y) * e - Math.sin(Math.PI * e) * 24);  // a slight arc, as a hand moves
      await pause(16);
    }
    [x, y] = [tx, ty];
  };
  /** Glide there, rest a moment, and press (a tap by touch). */
  const press = async (to, ms) => {
    if (typeof to === "string") await d.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "nearest" }), to);
    await glide(to, ms);
    await pause(220);
    touch ? await d.tap(x, y) : await d.click(x, y);
  };
  /** The page scrolls to `top` (a number, or a selector's top under the header) on the site's curve. */
  const scroll = async (top, ms = 2400) => {
    const y = typeof top === "number" ? top : await d.evaluate((s) => scrollY + document.querySelector(s).getBoundingClientRect().top - document.querySelector(".masthead").offsetHeight, top);
    await d.evaluate(([to, ms]) => new Promise((done) => {
      const from = scrollY, t0 = performance.now(), e = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
      document.documentElement.style.scrollSnapType = "none";  // a presenter's scroll is not caught by a story's steps
      const tick = (t) => { const f = Math.min(1, (t - t0) / ms); scrollTo(0, from + (to - from) * e(f)); f < 1 ? requestAnimationFrame(tick) : (document.documentElement.style.scrollSnapType = "", done()); };
      requestAnimationFrame(tick);
    }), [y, ms]);
  };
  /** Fingers moving together from points to points in `ms`, then lifted. */
  const fingers = async (paths, ms = 700) => {
    const points = (f) => paths.map(([[x0, y0], [x1, y1]], id) => ({ x: x0 + (x1 - x0) * ease(f), y: y0 + (y1 - y0) * ease(f), id }));
    await d.touch("touchStart", points(0));
    for (let f = 1, n = Math.round(ms / 16); f <= n; f++) (await d.touch("touchMove", points(f / n)), await pause(16));
    await d.touch("touchEnd", []);
  };
  /** Drag over a box from one point to another (a fraction of it), with a button, on the curve. */
  const drag = async (box, [fx0, fy0], [fx1, fy1], { button = "left", shift = false, ms = 1400 } = {}) => {
    const [x0, y0, x1, y1] = [box.x + box.width * fx0, box.y + box.height * fy0, box.x + box.width * fx1, box.y + box.height * fy1];
    await glide([x0, y0], 500);
    if (shift) await d.shift(true);
    await d.down(button);
    for (let f = 1, n = Math.round(ms / 16); f <= n; f++) (await d.move(x0 + (x1 - x0) * ease(f / n), y0 + (y1 - y0) * ease(f / n)), await pause(16));
    await d.up(button);
    if (shift) await d.shift(false);
    [x, y] = [x1, y1];
  };
  return { pause, glide, press, scroll, fingers, drag };
}

/** The choreography, the same for both ways of recording. */
async function show(name, d, viewport, touch) {
  const p = presenter(d, touch);
  const nav = async (to) => (touch ? (await p.press("#menu-button", 500), await p.pause(700), await p.press(`#menu nav a[data-to="${to}"]`, 600)) : await p.press(`.masthead nav a[data-to="${to}"]`, 900));

  say(`${name}: the arrival`);
  await d.goto(at("#/"));
  await d.until(".hero .chart[data-route]", 60000);
  await p.pause(5200);  // the words come on, the first route sails, the notes appear

  say(`${name}: a word typed and sailed`);
  await p.press(".hero .suggest input", 1100);
  await d.type("nusantara", 110);
  await p.pause(500);
  await d.key("Enter");
  await p.pause(5500);
  if (!touch) (await p.glide([viewport.width * 0.78, viewport.height * 0.45], 1600), await p.glide([viewport.width * 0.62, viewport.height * 0.6], 1600));  // the sea leans to the pointer
  else await p.press(".hero-try li:nth-child(3) button", 600), await p.pause(5000);  // by touch, a chip sails another word

  say(`${name}: the dive`);
  await p.scroll(".featured", 5200);
  await p.pause(1800);

  say(`${name}: a story, from its card`);
  if (!touch) await p.glide(".featured .story-card", 1200), await p.pause(900);  // the card leans to the pointer
  await p.press(".featured .story-card", 600);
  await d.until(".cover .chart, .cover.lit", 30000);
  await p.pause(3500);
  await p.press(".begin", 900);
  await p.pause(2600);
  for (let i = 0; i < 4; i++) {
    touch ? await p.fingers([[[viewport.width / 2, viewport.height * 0.7], [viewport.width / 2, viewport.height * 0.35]]], 450) : await d.key("ArrowDown");
    await p.pause(2600);
  }
  await p.scroll(".landing", 3000);
  await p.pause(3200);

  say(`${name}: the map`);
  await p.scroll(0, 1200);
  await nav("peta");
  await d.until(".map-deep .chart > canvas", 30000);
  await p.pause(3500);
  const sea = await d.box(".map-deep .chart > canvas").catch(() => null);
  if (sea && !touch) {
    await p.drag(sea, [0.55, 0.55], [0.4, 0.5], { button: "right", ms: 1800 });  // turn
    await p.pause(800);
    await p.drag(sea, [0.5, 0.65], [0.5, 0.45], { shift: true, ms: 1400 });  // tilt
    await p.pause(800);
  } else if (sea) {
    await p.scroll(Math.max(0, (await d.evaluate(() => scrollY)) + sea.y - 56), 900);
    const [cx, cy] = [viewport.width / 2, 56 + sea.height / 2];
    await p.fingers([[[cx - 60, cy], [cx, cy - 60]], [[cx + 60, cy], [cx, cy + 60]]], 1200);  // twist to turn
    await p.pause(700);
    await p.fingers([[[cx - 60, cy + 60], [cx - 60, cy - 20]], [[cx + 60, cy + 60], [cx + 60, cy - 20]]], 1000);  // two fingers up: tilt
    await p.pause(700);
  }
  await p.press(".map-steer .suggest input", 900);
  await d.type("prabowo", 110);
  await d.key("Enter");
  await p.pause(3500);
  await p.press('.map-deep .zoom [data-k="above"]', 900);
  await p.pause(3200);
  await p.press('.map-deep .zoom [data-k="above"]', 700);
  await p.pause(2500);

  say(`${name}: a word's page`);
  await d.goto(at("#/kata/kpk"));
  await d.until(".lens-section svg", 30000);
  await p.pause(3000);
  await p.scroll(".lens-section", 2200);
  await p.pause(1200);
  await p.press(".lens-section .player button", 900);
  await p.pause(6000);

  say(`${name}: the share sheet`);
  await d.goto(at("#/cerita/oknum"));
  await d.until(".cover .share", 30000);
  await p.pause(2500);
  await p.press(".cover .share > summary", 1000);
  await p.pause(3200);
}

// ---- as it plays: Playwright's video ---------------------------------------------------------------------------------
async function video(name, viewport, scale, touch) {
  const { chromium } = await import("playwright").catch(() => import("playwright-core"));
  const browser = await chromium.launch({ headless: true, channel: "chromium", args: GPU }).catch(() => chromium.launch({ args: GPU }));
  const size = { width: viewport.width * Math.min(scale, 2), height: viewport.height * Math.min(scale, 2) };  // the video at the screen's own pixels (Playwright's video is VP8 at a fixed rate: the size is what can be raised)
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch, colorScheme: "dark", recordVideo: { dir: out, size } });
  const page = await context.newPage(), cdp = await context.newCDPSession(page);
  page.on("pageerror", (e) => say(`page error: ${e.message}`));
  await show(name, {
    goto: (to) => page.goto(to), pause: (ms) => page.waitForTimeout(ms), evaluate: (fn, arg) => page.evaluate(fn, arg),
    until: (selector, timeout) => page.waitForSelector(selector, { timeout }).catch(() => {}), box: (selector) => page.locator(selector).first().boundingBox(),
    move: (x, y) => page.mouse.move(x, y), down: (button) => page.mouse.down({ button }), up: (button) => page.mouse.up({ button }), click: (x, y) => page.mouse.click(x, y),
    tap: (x, y) => page.touchscreen.tap(x, y), key: (k) => page.keyboard.press(k), type: (text, delay) => page.keyboard.type(text, { delay }),
    shift: (on) => (on ? page.keyboard.down("Shift") : page.keyboard.up("Shift")), touch: (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints }),
  }, viewport, touch);
  await context.close();
  const file = join(out, `film-${name}.webm`);
  renameSync(await page.video().path(), file);
  await browser.close();
  say(`${name}: ${file}`);
}

// ---- frame by frame: the headless shell over the DevTools protocol ---------------------------------------------------
const shell = () => {
  if (process.env.HEADLESS_SHELL) return process.env.HEADLESS_SHELL;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), ".cache/ms-playwright");
  const dir = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().at(-1);
  return dir && join(root, dir, "chrome-headless-shell-linux64/chrome-headless-shell");
};
const ffmpeg = () => [process.env.FFMPEG, "ffmpeg", join(homedir(), ".cache/ffmpeg-static/ffmpeg")].find((f) => f && spawnSync(f, ["-version"]).status === 0);
const KEYS = { Enter: { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }, ArrowDown: { code: "ArrowDown", windowsVirtualKeyCode: 40 }, Shift: { code: "ShiftLeft", windowsVirtualKeyCode: 16 } };

async function frames(name, viewport, scale, touch) {
  const exe = shell();
  if (!exe || !existsSync(exe)) throw new Error("no headless shell: set HEADLESS_SHELL or run npx playwright install chromium-headless-shell");
  const chrome = spawn(exe, ["--remote-debugging-port=0", "--deterministic-mode", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw",
    "--disable-new-content-rendering-timeout", "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--hide-scrollbars",
    "--no-first-run", "--mute-audio", "--no-sandbox", `--force-device-scale-factor=${scale}`, ...GPU, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], detached: true });
  const gone = () => { try { process.kill(-chrome.pid, "SIGKILL"); } catch {} };  // the shell and every process it started, however this ends
  process.on("exit", gone);
  const endpoint = await new Promise((ok, fail) => { let log = ""; chrome.stderr.on("data", (b) => { log += b; const m = log.match(/ws:\/\/\S+/); if (m) ok(m[0]); }); chrome.on("exit", () => fail(new Error(log))); });
  // The protocol: a request and its answer, events by name; a page is talked to through its session.
  const ws = new WebSocket(endpoint), waiting = new Map(), heard = new Map();
  let last = 0, session;
  await new Promise((ok) => ws.addEventListener("open", ok));
  ws.addEventListener("message", ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && waiting.has(m.id)) { const [ok, fail] = waiting.get(m.id); waiting.delete(m.id); m.error ? fail(new Error(`${m.error.message}`)) : ok(m.result); }
    else if (m.method) for (const f of heard.get(m.method) || []) f(m.params);
  });
  const send = (method, params = {}, to = session) => new Promise((ok, fail) => { waiting.set(++last, [ok, fail]); ws.send(JSON.stringify({ id: last, method, params, ...(to ? { sessionId: to } : {}) })); });
  const once = (method) => new Promise((ok) => heard.set(method, [...(heard.get(method) || []), function f(p) { heard.set(method, heard.get(method).filter((g) => g !== f)); ok(p); }]));
  const { browserContextId } = await send("Target.createBrowserContext", {}, null);
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId, enableBeginFrameControl: true, width: viewport.width, height: viewport.height }, null);
  ({ sessionId: session } = await send("Target.attachToTarget", { targetId, flatten: true }, null));
  heard.set("Runtime.exceptionThrown", [(p) => say(`page error: ${p.exceptionDetails.exception?.description?.split("\n")[0] || p.exceptionDetails.text}`)]);
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: scale, mobile: touch });
  if (touch) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  // The page's clock starts at the machine's monotonic clock (which Chromium's ticks are) when virtual time is set up;
  // each frame is stamped with that start plus the virtual time gone by, so requestAnimationFrame, CSS animations and
  // performance.now() keep to one clock.
  const start = Number(process.hrtime.bigint()) / 1e6;

  // Where the frames go: ffmpeg's input, or PNG files.
  const encoder = ffmpeg(), file = join(out, `film-${name}.mp4`), dir = join(out, name);
  const sink = encoder ? spawn(encoder, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] }) : (mkdirSync(dir, { recursive: true }), null);
  const closed = sink && new Promise((ok) => sink.on("close", ok));
  let count = 0, image = null, held = 0, stuck = 0;
  const within = (promise, ms) => { let timer; return Promise.race([promise.then((r) => r ?? true), new Promise((ok) => (timer = setTimeout(ok, ms, false)))]).finally(() => clearTimeout(timer)); };
  /** One frame: the page's clock moves on 1/60 s, then the frame is drawn and kept (the last one again if nothing changed). */
  const frame = async () => {
    if (count >= LIMIT) throw new Done();
    const expired = once("Emulation.virtualTimeBudgetExpired");
    await send("Emulation.setVirtualTimePolicy", { policy: "pauseIfNetworkFetchesPending", budget: FRAME });
    // A fetch that never ends would hold the clock for ever: after 20 s of real time the frame goes on without it.
    if (!(await within(expired, 20000))) (stuck++ || say(`${name}: frame ${count} waited 20 s on a fetch; the clock goes on without it`), await send("Emulation.setVirtualTimePolicy", { policy: "advance", budget: FRAME }), await expired);
    const drawn = await within(send("HeadlessExperimental.beginFrame", { frameTimeTicks: start + (count + 1) * FRAME, interval: FRAME, screenshot: { format: "png" } }), 120000);
    if (!drawn) throw new Error(`frame ${count} was not drawn in two minutes`);
    if (drawn.screenshotData) image = Buffer.from(drawn.screenshotData, "base64"); else held++;
    if (image) sink ? sink.stdin.write(image) || (await new Promise((ok) => sink.stdin.once("drain", ok))) : writeFileSync(join(dir, `${String(count).padStart(6, "0")}.png`), image);
    count++;
  };
  /** Time passes while something is under way: frames are drawn until it is done. */
  const during = async (work) => {
    let done = false, result, error;
    work.then((r) => ((done = true), (result = r)), (e) => ((done = true), (error = e)));
    do await frame(); while (!done);
    if (error) throw error;
    return result;
  };
  const evaluate = (fn, arg) => during(send("Runtime.evaluate", { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true }))
    .then((r) => (r.exceptionDetails ? Promise.reject(new Error(r.exceptionDetails.text)) : r.result.value));
  let modifiers = 0;
  const mouse = (type, x, y, button = "none") => during(send("Input.dispatchMouseEvent", { type, x, y, button, clickCount: type === "mouseMoved" ? 0 : 1, modifiers }));
  let pointer = [0, 0];
  const d = {
    goto: (to) => during(send("Page.navigate", { url: to })),
    pause: async (ms) => { for (let f = Math.max(1, Math.round(ms / FRAME)); f > 0; f--) await frame(); },
    evaluate,
    until: async (selector, timeout) => { for (let t = 0; t < timeout && !(await evaluate((s) => !!document.querySelector(s), selector)); t += 10 * FRAME) await d.pause(9 * FRAME); },
    box: async (selector) => (await evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, width: r.width, height: r.height }; }, selector)) || Promise.reject(new Error(`${selector} not found`)),
    move: (x, y) => ((pointer = [x, y]), mouse("mouseMoved", x, y)),
    down: (button) => mouse("mousePressed", ...pointer, button), up: (button) => mouse("mouseReleased", ...pointer, button),
    click: async (x, y) => (await d.move(x, y), await mouse("mousePressed", x, y, "left"), await mouse("mouseReleased", x, y, "left")),
    tap: async (x, y) => (await d.touch("touchStart", [{ x, y }]), await d.touch("touchEnd", [])),
    touch: (type, touchPoints) => during(send("Input.dispatchTouchEvent", { type, touchPoints })),
    key: async (k) => { for (const type of ["keyDown", "keyUp"]) await during(send("Input.dispatchKeyEvent", { type, key: k, ...KEYS[k], ...(type === "keyUp" ? { text: undefined } : {}) })); },
    type: async (text, delay) => { for (const c of text) (await during(send("Input.insertText", { text: c })), await d.pause(delay)); },
    shift: async (on) => ((modifiers = on ? 8 : 0), await during(send("Input.dispatchKeyEvent", { type: on ? "rawKeyDown" : "keyUp", key: "Shift", ...KEYS.Shift, modifiers }))),
  };
  try { await show(name, d, viewport, touch); } catch (e) { if (!(e instanceof Done)) throw e; }
  if (sink) (sink.stdin.end(), await closed);
  await send("Browser.close", {}, null).catch(() => {});  // the shell closes; what lingers is killed
  ws.close();
  setTimeout(gone, 3000).unref();
  say(`${name}: ${count} frames (${(count / FPS).toFixed(1)} s at ${FPS} a second; ${held} the same as the one before) ${sink ? `in ${file}` : `as PNG in ${dir}: ffmpeg -framerate ${FPS} -i ${dir}/%06d.png -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart ${file}`}`);
}

const record = flag("--frames") ? frames : video;
if (only !== "phone") await record("desktop", { width: 1440, height: 900 }, record === frames ? 2 : 1, false);
if (only !== "desktop") await record("phone", { width: 390, height: 844 }, 3, true);
