const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

window.portfolio = { closeMenu };

// ----- Decrypt effect for headings -----
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789"; // letter-width glyphs so lines don't rewrap

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

// ----- Live background: slow drifting particle network -----
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
const dotRGB = getComputedStyle(root).getPropertyValue("--particle").trim();
const LINK = 130; // max distance for a hairline between dots
let dots = [];
let w, h, raf;

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
}

function draw() {
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < LINK) {
        ctx.strokeStyle = `rgba(${dotRGB}, ${0.12 * (1 - d / LINK)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(${dotRGB}, 0.35)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function step() {
  for (const d of dots) {
    d.x += d.vx;
    d.y += d.vy;
    if (d.x < -10) d.x = w + 10;
    if (d.x > w + 10) d.x = -10;
    if (d.y < -10) d.y = h + 10;
    if (d.y > h + 10) d.y = -10;
  }
  draw();
  raf = requestAnimationFrame(step);
}

resize();
if (reduceMotion) {
  draw(); // one still frame, no movement
} else {
  raf = requestAnimationFrame(step);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(step);
  });
}

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resize();
    if (reduceMotion) draw();
  }, 150);
});

// ----- Contact form (Web3Forms) -----
const cform = document.getElementById("contact-form");

if (cform) {
  const status = cform.querySelector(".cform-status");
  const sendBtn = cform.querySelector('button[type="submit"]');
  const setStatus = (msg, cls = "") => {
    status.textContent = msg;
    status.className = `cform-status ${cls}`;
  };

  cform.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = cform.querySelector('[name="access_key"]').value;
    if (!key || key.startsWith("YOUR_")) {
      return setStatus("form isn't connected yet. reach me on linkedin for now.", "err");
    }
    sendBtn.disabled = true;
    sendBtn.textContent = "sending…";
    setStatus("");
    try {
      const res = await fetch(cform.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(cform),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        cform.reset();
        setStatus("✓ sent. thanks, I'll get back to you soon.", "ok");
      } else {
        setStatus(`couldn't send: ${data.message || "please try again"}.`, "err");
      }
    } catch {
      setStatus("couldn't reach the server. check your connection and try again.", "err");
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "send message →";
    }
  });
}
