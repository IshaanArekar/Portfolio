const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const root = document.documentElement;

// ----- Mobile menu -----
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");

function closeMenu() {
  links.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "menu";
}

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "close" : "menu";
});
links.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

// ----- Themes -----
const THEMES = {
  hairline: { label: "hairline", color: "#0c0d0f" },
  matrix: { label: "matrix", color: "#020a05" },
  amber: { label: "amber crt", color: "#0f0a02" },
  cyberpunk: { label: "cyberpunk", color: "#0b0614" },
  nord: { label: "nord", color: "#2e3440" },
  paper: { label: "paper (light)", color: "#f5f4ef" },
};
const themeBtn = document.getElementById("theme-btn");
const themeMenu = document.getElementById("theme-menu");

function currentTheme() {
  return root.dataset.theme || "hairline";
}

function setTheme(name) {
  if (!THEMES[name]) return false;
  if (name === "hairline") delete root.dataset.theme;
  else root.dataset.theme = name;
  try { localStorage.setItem("theme", name); } catch (e) {}
  document.querySelector('meta[name="theme-color"]').setAttribute("content", THEMES[name].color);
  themeMenu.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", b.dataset.theme === name));
  document.dispatchEvent(new CustomEvent("themechange"));
  return true;
}

Object.entries(THEMES).forEach(([key, t]) => {
  const b = document.createElement("button");
  b.setAttribute("role", "menuitemradio");
  b.dataset.theme = key;
  b.innerHTML = `<span class="swatch" style="background:${t.color}"></span>${t.label}`;
  b.addEventListener("click", () => {
    setTheme(key);
    themeMenu.hidden = true;
    themeBtn.setAttribute("aria-expanded", "false");
  });
  themeMenu.appendChild(b);
});
setTheme(currentTheme());

themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themeMenu.hidden = !themeMenu.hidden;
  themeBtn.setAttribute("aria-expanded", !themeMenu.hidden);
});
document.addEventListener("click", (e) => {
  if (!themeMenu.hidden && !e.target.closest(".theme-picker")) {
    themeMenu.hidden = true;
    themeBtn.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !themeMenu.hidden) {
    themeMenu.hidden = true;
    themeBtn.setAttribute("aria-expanded", "false");
    themeBtn.focus();
  }
});

window.portfolio = { THEMES, setTheme, currentTheme, closeMenu };

// ----- Decrypt effect for headings -----
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789"; // letter-width glyphs so lines don't rewrap
const RAIN_GLYPHS = "01アイウエオカキクケコサシスセソ<>/\\{}#$%";

function scramble(el) {
  if (reduceMotion || el.dataset.done) return;
  el.dataset.done = "1";
  const final = el.textContent;
  el.setAttribute("aria-label", final);
  el.style.minHeight = el.offsetHeight + "px";
  const start = performance.now();
  const duration = Math.min(900, 300 + final.length * 22);
  el.classList.add("scrambling");
  (function frame(now) {
    const p = Math.min(1, (now - start) / duration);
    const revealed = Math.floor(p * final.length);
    let out = final.slice(0, revealed);
    for (let i = revealed; i < final.length; i++) {
      out += final[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (p < 1) requestAnimationFrame(frame);
    else {
      el.textContent = final;
      el.style.minHeight = "";
      el.classList.remove("scrambling");
      el.removeAttribute("aria-label");
    }
  })(start);
}

const heroTitle = document.getElementById("hero-title");
if (heroTitle) setTimeout(() => scramble(heroTitle), 150);

// ----- Project filters -----
const chips = document.querySelectorAll(".chip");
const items = document.querySelectorAll(".work-item");

chips.forEach((chip) =>
  chip.addEventListener("click", () => {
    const filter = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute("aria-pressed", c === chip));
    items.forEach((item) => {
      item.hidden = filter !== "all" && !item.dataset.tags.split(" ").includes(filter);
    });
  })
);

// ----- Fade-in on scroll (+ decrypt the section heading) -----
const fades = document.querySelectorAll(".fade");

function reveal(el) {
  el.classList.add("in");
  const h = el.querySelector("[data-scramble]");
  if (h) scramble(h);
}

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          reveal(e.target);
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  fades.forEach((el) => observer.observe(el));
} else {
  fades.forEach(reveal);
}

// ----- Simulated security log in the hero -----
// Decoration only. IPs are from the documentation ranges (RFC 5737).
const seclog = document.getElementById("seclog");
const LOG_LINES = [
  ["allow", "443/tcp tls1.3 handshake 198.51.100.24"],
  ["block", "22/tcp brute-force 203.0.113.7 rate-limited"],
  ["audit", "iam: least-privilege check passed"],
  ["ok", "soc2: evidence synced, 0 gaps"],
  ["scan", "deps: 0 critical, 0 high"],
  ["alert", "auth: 5 failed logins 192.0.2.41 triaged"],
  ["allow", "api: token signature verified"],
  ["block", "waf: sqli pattern dropped 203.0.113.19"],
  ["audit", "access review: 2 stale accounts revoked"],
  ["ok", "secrets: none found in repo"],
  ["scan", "vuln: CVE patched on host-07"],
  ["allow", "deploy: build signed and shipped"],
];

if (seclog) {
  let i = 0;
  const stamp = () => new Date().toTimeString().slice(0, 8);
  const add = () => {
    const [lv, msg] = LOG_LINES[i++ % LOG_LINES.length];
    const li = document.createElement("li");
    li.innerHTML = `<span class="t-dim">${stamp()}</span> <span class="lv lv-${lv}">[${lv}]</span> ${msg}`;
    seclog.appendChild(li);
    while (seclog.children.length > 9) seclog.firstElementChild.remove();
  };
  if (reduceMotion) {
    for (let k = 0; k < 9; k++) add();
  } else {
    for (let k = 0; k < 4; k++) add();
    setInterval(() => { if (!document.hidden) add(); }, 1400);
  }
}

// ----- Live background: particles | rain | grid (set per theme) -----
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
const mouse = { x: -9999, y: -9999 };
const LINK = 130;   // max distance for a hairline between dots
const REACH = 170;  // cursor influence radius
let colors = {};
let mode = "particles";
let dots = [];
let drops = [];
let gridOffset = 0;
let w, h, raf, lastRain = 0;

function readTheme() {
  const css = getComputedStyle(root);
  colors = {
    dot: css.getPropertyValue("--particle").trim(),
    hot: css.getPropertyValue("--particle-hot").trim(),
    bg: css.getPropertyValue("--bg-rgb").trim(),
  };
  mode = css.getPropertyValue("--bg-mode").trim() || "particles";
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(90, Math.round((w * h) / 16000));
  dots = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    r: Math.random() * 1.2 + 0.4,
  }));
  drops = Array.from({ length: Math.ceil(w / 16) }, () => Math.random() * -h / 16);
  ctx.clearRect(0, 0, w, h);
}

function drawParticles() {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < LINK) {
        ctx.strokeStyle = `rgba(${colors.dot}, ${0.12 * (1 - d / LINK)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    const m = Math.hypot(a.x - mouse.x, a.y - mouse.y);
    const heat = m < REACH ? 1 - m / REACH : 0;
    if (heat > 0) {
      ctx.strokeStyle = `rgba(${colors.hot}, ${0.25 * heat})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
    ctx.fillStyle = heat > 0 ? `rgba(${colors.hot}, ${0.35 + 0.5 * heat})` : `rgba(${colors.dot}, 0.35)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r + heat, 0, Math.PI * 2);
    ctx.fill();
  }
}

function moveParticles() {
  for (const d of dots) {
    d.x += d.vx;
    d.y += d.vy;
    if (d.x < -10) d.x = w + 10;
    if (d.x > w + 10) d.x = -10;
    if (d.y < -10) d.y = h + 10;
    if (d.y > h + 10) d.y = -10;
  }
}

function drawRain() {
  // translucent bg wash leaves fading trails behind each glyph
  ctx.fillStyle = `rgba(${colors.bg}, 0.12)`;
  ctx.fillRect(0, 0, w, h);
  ctx.font = "14px 'JetBrains Mono', monospace";
  for (let i = 0; i < drops.length; i++) {
    const x = i * 16;
    const y = drops[i] * 16;
    const near = Math.abs(x - mouse.x) < 60;
    ctx.fillStyle = `rgba(${near ? colors.hot : colors.dot}, ${near ? 0.7 : 0.35})`;
    ctx.fillText(RAIN_GLYPHS[(Math.random() * RAIN_GLYPHS.length) | 0], x, y);
    if (y > h && Math.random() > 0.975) drops[i] = 0;
    drops[i] += 1;
  }
}

function drawGrid() {
  ctx.clearRect(0, 0, w, h);
  const horizon = h * 0.55;
  const cx = w / 2;
  ctx.lineWidth = 1;
  // receding horizontal lines
  for (let i = 0; i < 18; i++) {
    const t = ((i + gridOffset) % 18) / 18;
    const y = horizon + (h - horizon) * t * t;
    ctx.strokeStyle = `rgba(${colors.hot}, ${0.05 + 0.18 * t})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // lines converging on the vanishing point
  for (let i = -14; i <= 14; i++) {
    ctx.strokeStyle = `rgba(${colors.dot}, 0.12)`;
    ctx.beginPath();
    ctx.moveTo(cx + i * 12, horizon);
    ctx.lineTo(cx + i * (w / 10), h);
    ctx.stroke();
  }
  // soft horizon glow
  const g = ctx.createLinearGradient(0, horizon - 80, 0, horizon + 4);
  g.addColorStop(0, `rgba(${colors.hot}, 0)`);
  g.addColorStop(1, `rgba(${colors.hot}, 0.12)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon - 80, w, 84);
}

function frame(now) {
  if (mode === "rain") {
    if (now - lastRain > 50) { drawRain(); lastRain = now; } // ~20fps feels right for rain
  } else if (mode === "grid") {
    gridOffset = (gridOffset + 0.04) % 18;
    drawGrid();
  } else {
    moveParticles();
    drawParticles();
  }
  raf = requestAnimationFrame(frame);
}

function drawStill() {
  if (mode === "grid") drawGrid();
  else if (mode === "rain") { for (let k = 0; k < 40; k++) drawRain(); }
  else drawParticles();
}

readTheme();
resize();
if (reduceMotion) {
  drawStill();
} else {
  raf = requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });
}

document.addEventListener("themechange", () => {
  readTheme();
  ctx.clearRect(0, 0, w, h);
  if (reduceMotion) drawStill();
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resize();
    if (reduceMotion) drawStill();
  }, 150);
});

// ----- Cursor: spotlight + trailing ring (mouse/trackpad only) -----
if (finePointer && !reduceMotion) {
  const ring = document.querySelector(".cursor-ring");
  const pos = { x: 0, y: 0 };
  const ringPos = { x: 0, y: 0 };

  window.addEventListener("mousemove", (e) => {
    pos.x = mouse.x = e.clientX;
    pos.y = mouse.y = e.clientY;
    root.style.setProperty("--mx", e.clientX + "px");
    root.style.setProperty("--my", e.clientY + "px");
    document.body.classList.add("cursor-on");
  });
  root.addEventListener("mouseleave", () => {
    mouse.x = mouse.y = -9999;
    document.body.classList.remove("cursor-on");
  });
  window.addEventListener("mousedown", () => ring.classList.add("down"));
  window.addEventListener("mouseup", () => ring.classList.remove("down"));

  document.addEventListener("mouseover", (e) => {
    ring.classList.toggle("hover", !!e.target.closest("a, button, summary, input"));
  });

  (function follow() {
    ringPos.x += (pos.x - ringPos.x) * 0.2;
    ringPos.y += (pos.y - ringPos.y) * 0.2;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
    requestAnimationFrame(follow);
  })();
}
