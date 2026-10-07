// ----- Typing effect in the hero terminal -----
// Edit these lines to change what gets "typed".
const lines = [
  "whoami",
  "cs @ asu '28 · security + ai + full-stack",
  "cat now.txt",
  "learning cloud security: iam, logging, least privilege",
];

const typed = document.getElementById("typed");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduceMotion) {
  typed.textContent = lines.join("\n");
} else {
  let line = 0;
  let char = 0;
  let deleting = false;

  function tick() {
    const current = lines[line];
    if (!deleting) {
      typed.textContent = current.slice(0, ++char);
      if (char === current.length) {
        deleting = true;
        return setTimeout(tick, 1600);
      }
      setTimeout(tick, 55 + Math.random() * 50);
    } else {
      typed.textContent = current.slice(0, --char);
      if (char === 0) {
        deleting = false;
        line = (line + 1) % lines.length;
        return setTimeout(tick, 300);
      }
      setTimeout(tick, 25);
    }
  }
  setTimeout(tick, 600);
}

// ----- Nav: border on scroll + mobile menu -----
const nav = document.querySelector(".nav");
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 10);
});

toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// ----- Reveal sections as they scroll into view -----
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

document.getElementById("year").textContent = new Date().getFullYear();
