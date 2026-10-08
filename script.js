// ----- Mobile menu -----
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "close" : "menu";
});

links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "menu";
  })
);

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

// ----- Gentle fade-in on scroll -----
const fades = document.querySelectorAll(".fade");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  fades.forEach((el) => observer.observe(el));
} else {
  fades.forEach((el) => el.classList.add("in"));
}

// ----- Live background: drifting particle network -----
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
const css = getComputedStyle(document.documentElement);
const dotRGB = css.getPropertyValue("--particle").trim();
const hotRGB = css.getPropertyValue("--particle-hot").trim();
const mouse = { x: -9999, y: -9999 };
const LINK = 130;   // max distance for a hairline between dots
const REACH = 170;  // cursor influence radius
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
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < LINK) {
        ctx.strokeStyle = `rgba(${dotRGB}, ${0.12 * (1 - d / LINK)})`;
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
      ctx.strokeStyle = `rgba(${hotRGB}, ${0.25 * heat})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
    ctx.fillStyle = heat > 0 ? `rgba(${hotRGB}, ${0.35 + 0.5 * heat})` : `rgba(${dotRGB}, 0.35)`;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r + heat, 0, Math.PI * 2);
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
  step();
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) step();
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

// ----- Cursor: spotlight + trailing ring (mouse/trackpad only) -----
if (finePointer && !reduceMotion) {
  const ring = document.querySelector(".cursor-ring");
  const root = document.documentElement;
  const pos = { x: 0, y: 0 };
  const ringPos = { x: 0, y: 0 };

  window.addEventListener("mousemove", (e) => {
    pos.x = mouse.x = e.clientX;
    pos.y = mouse.y = e.clientY;
    root.style.setProperty("--mx", e.clientX + "px");
    root.style.setProperty("--my", e.clientY + "px");
    document.body.classList.add("cursor-on");
  });
  document.documentElement.addEventListener("mouseleave", () => {
    mouse.x = mouse.y = -9999;
    document.body.classList.remove("cursor-on");
  });
  window.addEventListener("mousedown", () => ring.classList.add("down"));
  window.addEventListener("mouseup", () => ring.classList.remove("down"));

  document.addEventListener("mouseover", (e) => {
    ring.classList.toggle("hover", !!e.target.closest("a, button, summary"));
  });

  (function follow() {
    ringPos.x += (pos.x - ringPos.x) * 0.2;
    ringPos.y += (pos.y - ringPos.y) * 0.2;
    ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
    requestAnimationFrame(follow);
  })();
}
