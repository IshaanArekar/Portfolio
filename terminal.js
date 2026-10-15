// =========================================================
// Terminal: a tiny Linux-style shell that lives in the hero and
// can expand to full screen.
// The file system is built from the page itself, so editing
// index.html updates both views.
// =========================================================
(() => {
  const term = document.getElementById("term");
  if (!term) return;
  const out = term.querySelector(".term-out");
  const body = term.querySelector(".term-body");
  const form = term.querySelector(".term-line");
  const input = document.getElementById("term-in");
  const promptEl = term.querySelector(".term-prompt");
  const titleEl = term.querySelector(".term-title");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clean = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ----- Build the file system from the DOM -----
  function file(lines, extra = {}) {
    return { type: "file", lines, ...extra };
  }
  function dir(children, extra = {}) {
    return { type: "dir", children, ...extra };
  }

  // ----- Resume: read from resume.txt (a text copy of resume.pdf) -----
  let resumeText = null;
  function loadResume() {
    if (resumeText !== null) return Promise.resolve();
    return fetch("resume.txt", { cache: "no-cache" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => { resumeText = t; })
      .catch(() => { resumeText = ""; });
  }

  const RESUME_NAMES = { "technical skills": "skills", "leadership & involvement": "leadership" };
  function resumeDir() {
    const lines = (resumeText || "").replace(/\r/g, "").split("\n");
    if (!lines[0]) {
      const note = [{ t: "resume text isn't available right now. try: open resume", c: "t-dim" }];
      return dir({}, { full: note });
    }
    const isHeading = (l, i) => i > 0 && /^[A-Z][A-Z &]{3,}$/.test(l.trim());
    const fmt = (l, i) => (i === 0 || isHeading(l, i) ? { t: l, c: "t-head" } : l);
    const full = lines.map(fmt);
    const children = {};
    let current = null;
    lines.forEach((l, i) => {
      if (isHeading(l, i)) {
        const h = l.trim().toLowerCase();
        current = `${RESUME_NAMES[h] || slug(h)}.txt`;
        children[current] = file([{ t: l.trim(), c: "t-head" }]);
      } else if (current) {
        children[current].lines.push(l);
      }
    });
    Object.values(children).forEach((f) => { while (f.lines.length && f.lines[f.lines.length - 1] === "") f.lines.pop(); });
    while (full.length && full[full.length - 1] === "") full.pop();
    return dir(children, { full });
  }

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
  const LEVEL_CLASS = { allow: "t-ok", ok: "t-ok", block: "t-err", alert: "t-err", audit: "t-info", scan: "t-info" };
  function logLine([lv, msg]) {
    const stamp = new Date().toTimeString().slice(0, 8);
    return { t: `${stamp} [${lv}]`.padEnd(18) + msg, c: LEVEL_CLASS[lv] };
  }

  function buildFS() {
    const about = [...document.querySelectorAll("#about .about-text > p")].map(clean);
    const cert = [...document.querySelectorAll("#about .cert dt")].map(
      (dt) => `  ${clean(dt).padEnd(12)} ${clean(dt.nextElementSibling)}`
    );

    const projects = {};
    document.querySelectorAll("#work .card").forEach((card) => {
      const title = clean(card.querySelector(".card-title"));
      const lines = [
        { t: `# ${title}`, c: "t-head" },
        { t: `${clean(card.querySelector(".w-id"))} · ${clean(card.querySelector(".card-meta .tag"))}`, c: "t-dim" },
        "",
        clean(card.querySelector(".card-sum")),
        { t: `stack: ${clean(card.querySelector(".card-stack"))}`, c: "t-dim" },
      ];
      card.querySelectorAll(".writeup dt").forEach((dt) => {
        lines.push("", { t: `## ${clean(dt)}`, c: dt.classList.contains("sec-dt") ? "t-ok" : "t-head" });
        lines.push(clean(dt.nextElementSibling));
      });
      const links = [...card.querySelectorAll(".w-links a")].map((a) => ({ label: clean(a), href: a.href }));
      if (links.length) {
        lines.push("");
        links.forEach((l) => lines.push({ link: l.href, t: l.label }));
      }
      projects[`${slug(title)}.md`] = file(lines, { links, title });
    });

    const experience = {};
    document.querySelectorAll("#experience .timeline > li").forEach((li) => {
      const role = clean(li.querySelector(".role"));
      const org = clean(li.querySelector(".org")).replace(/^·\s*/, "");
      const lines = [
        { t: role, c: "t-head" },
        { t: [org, clean(li.querySelector(".when"))].filter(Boolean).join(" · "), c: "t-dim" },
        "",
        ...[...li.querySelectorAll("ul li")].map((b) => `- ${clean(b)}`),
      ];
      experience[`${slug(role)}.txt`] = file(lines);
    });

    const skills = [];
    document.querySelectorAll(".skills > div").forEach((group) => {
      skills.push({ t: clean(group.querySelector("h3")).replace(/^●\s*/, ""), c: "t-head" });
      group.querySelectorAll(".skill-list li").forEach((li) => {
        const [name, label] = li.querySelectorAll("span");
        skills.push(`  ${clean(name).padEnd(32)} ${clean(label)}`);
      });
      skills.push("");
    });

    const achievements = [...document.querySelectorAll(".rows li")].map((li) => {
      const sub = clean(li.querySelector(".row-sub"));
      const name = clean(li.firstElementChild).replace(sub, "").trim();
      return `- ${name} (${sub})`;
    });

    const tracks = [];
    document.querySelectorAll("#tracks .track").forEach((t) => {
      tracks.push({ t: `${clean(t.querySelector("h3"))}  (${clean(t.querySelector(".tag"))})`, c: "t-head" });
      tracks.push({ t: clean(t.querySelector(":scope > p")), c: "t-dim" });
      t.querySelectorAll("li").forEach((li) => {
        const tag = li.querySelector(".tag");
        const text = tag ? `${clean(li).replace(clean(tag), "").trim()} (${clean(tag)})` : clean(li);
        tracks.push(`- ${text}`);
      });
      tracks.push("");
    });

    const status = [...document.querySelectorAll(".hero .meta dt")].map(
      (dt) => `  ${clean(dt).padEnd(12)} ${clean(dt.nextElementSibling)}`
    );
    status.unshift({ t: clean(document.querySelector(".hero .eyebrow")), c: "t-head" }, { t: clean(document.getElementById("hero-title")), c: "t-dim" }, "");

    const eduItem = [...document.querySelectorAll("#experience .timeline > li")].find((li) => /b\.s\.|degree|university/i.test(clean(li)));
    const education = eduItem
      ? [{ t: clean(eduItem.querySelector(".role")), c: "t-head" }, { t: [clean(eduItem.querySelector(".org")).replace(/^·\s*/, ""), clean(eduItem.querySelector(".when"))].filter(Boolean).join(" · "), c: "t-dim" }, "", ...[...eduItem.querySelectorAll("ul li")].map((b) => `- ${clean(b)}`)]
      : [];

    const contact = [...document.querySelectorAll("#contact .contact-links a")].map((a) => ({
      link: a.href,
      t: `${clean(a).replace(" ↗", "").padEnd(12)} ${a.getAttribute("href")}`,
    }));
    if (document.getElementById("contact-form")) {
      contact.unshift({ t: `${"message".padEnd(12)} type 'message' to jump to the contact form`, c: "t-ok" });
    }

    return dir({
      "about.txt": file([...about.flatMap((p) => [p, ""]), { t: "-----BEGIN CERTIFICATE-----", c: "t-dim" }, ...cert, { t: "-----END CERTIFICATE-----", c: "t-dim" }], { section: "about" }),
      "status.txt": file(status, { section: "top" }),
      "tracks.txt": file(tracks, { section: "tracks" }),
      "education.txt": file(education, { section: "experience" }),
      projects: dir(projects, { section: "work" }),
      experience: dir(experience, { section: "experience" }),
      "skills.txt": file(skills, { section: "skills" }),
      "achievements.txt": file(achievements, { section: "achievements" }),
      "contact.txt": file(contact, { section: "contact" }),
      "sec.log": file([{ t: "# simulated feed, decoration only. IPs are documentation ranges (RFC 5737)", c: "t-dim" }, ...LOG_LINES.map(logLine)]),
      resume: resumeDir(),
      "resume.pdf": file([{ t: "binary file. try: cat resume, open resume, or download resume", c: "t-dim" }], { href: "resume.pdf" }),
      ".secrets": dir({ "flag.txt": file([], { locked: true }) }, { hidden: true }),
    });
  }

  let FS = null;
  let cwd = []; // path segments from ~

  // ----- Paths -----
  function resolve(path) {
    if (!path) return [...cwd];
    let parts = path.startsWith("~") || path.startsWith("/") ? [] : [...cwd];
    path.replace(/^~\/?|^\//, "").split("/").forEach((seg) => {
      if (!seg || seg === ".") return;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    });
    return parts;
  }
  function nodeAt(parts) {
    let node = FS;
    for (const p of parts) {
      if (!node || node.type !== "dir" || !node.children[p]) return null;
      node = node.children[p];
    }
    return node;
  }
  const pathStr = (parts) => (parts.length ? "~/" + parts.join("/") : "~");

  // find a file even without its extension ("cat skills"), and fall back to ~ ("cat skills" from ~/projects)
  function findFile(path) {
    const tries = [path, `${path}.txt`, `${path}.md`];
    if (!path.includes("/") && !path.startsWith("~")) tries.push(`~/${path}`, `~/${path}.txt`, `~/${path}.md`);
    for (const t of tries) {
      const parts = resolve(t);
      const node = nodeAt(parts);
      if (node) return { node, parts };
    }
    return null;
  }

  // every section on the page, and how to reach it from here
  const SECTIONS = [
    ["status", "top", "cat status"],
    ["about", "about", "cat about"],
    ["tracks", "tracks", "cat tracks"],
    ["projects", "work", "ls projects"],
    ["experience", "experience", "ls experience"],
    ["education", "experience", "cat education"],
    ["skills", "skills", "cat skills"],
    ["achievements", "achievements", "cat achievements"],
    ["contact", "contact", "cat contact"],
  ];

  // ----- Output helpers -----
  function print(line = "", cls) {
    const div = document.createElement("div");
    if (typeof line === "object" && line !== null) {
      if (line.link) {
        const a = document.createElement("a");
        a.href = line.link;
        a.textContent = line.t;
        if (!line.link.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener"; }
        div.appendChild(a);
      } else {
        div.textContent = line.t;
        if (line.c) div.className = line.c;
      }
    } else {
      div.textContent = line;
      if (cls) div.className = cls;
    }
    out.appendChild(div);
  }
  function printHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    out.appendChild(div);
  }
  function echoCommand(cmd) {
    const div = document.createElement("div");
    const p = document.createElement("span");
    p.className = "t-prompt";
    p.textContent = promptText();
    div.append(p, " " + cmd);
    out.appendChild(div);
  }
  function promptText() {
    return `guest@ishaan:${pathStr(cwd)}$`;
  }
  function updatePrompt() {
    promptEl.textContent = promptText();
    titleEl.textContent = `guest@ishaan: ${pathStr(cwd)}`;
  }
  const scrollDown = () => (body.scrollTop = body.scrollHeight);

  function listDir(node, showHidden) {
    const names = Object.keys(node.children).filter((n) => showHidden || !node.children[n].hidden);
    if (showHidden) names.unshift(".", "..");
    const html = names
      .map((n) => {
        const child = node.children[n];
        const isDir = n === "." || n === ".." || (child && child.type === "dir");
        return isDir ? `<span class="t-dir">${n}/</span>` : n;
      })
      .join("   ");
    printHTML(html || '<span class="t-dim">(empty)</span>');
  }

  // ----- Commands -----
  const HELP = [
    ["help", "show this list"],
    ["ls [-a] [dir]", "list files"],
    ["cd <dir>", "change directory (projects, experience, .., ~)"],
    ["cat <file>", "print a file, e.g. cat about, cat skills"],
    ["about · skills · ...", "shortcuts: about, status, tracks, projects, experience,"],
    ["", "education, skills, achievements, contact"],
    ["sections", "map of the whole site"],
    ["goto <section>", "close the terminal and jump there on the page"],
    ["open <name>", "open a project, github, linkedin or resume"],
    ["message", "jump to the contact form and write to me"],
    ["cat resume", "read my full resume right here"],
    ["cd resume", "browse it by section: summary, skills, experience..."],
    ["download resume", "save my resume as a PDF (wget / curl -O work too)"],
    ["pwd · whoami · id", "where and who you are"],
    ["neofetch", "system info"],
    ["scan", "port-scan this site (simulated)"],
    ["history · clear", "shell basics"],
    ["cat sec.log · tail -f sec.log", "the (simulated) security feed"],
    ["fullscreen", "toggle full screen (or press `)"],
    ["sudo hire-me", "the important one"],
    ["exit", "back to the normal site"],
  ];

  const commands = {
    help() {
      print("available commands:", "t-head");
      const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      HELP.forEach(([c, d]) => printHTML(`  <span class="t-ok">${esc(c.padEnd(22))}</span><span class="t-dim">${esc(d)}</span>`));
      print("");
      print("tip: Tab completes, ↑/↓ walks history, Esc closes.", "t-dim");
    },
    ls(args) {
      const showHidden = args.includes("-a") || args.includes("-la") || args.includes("-al");
      const target = args.find((a) => !a.startsWith("-"));
      const node = nodeAt(resolve(target));
      if (!node) return print(`ls: cannot access '${target}': No such file or directory`, "t-err");
      if (node.type === "file") return print(target);
      listDir(node, showHidden);
    },
    cd(args) {
      const target = args[0] || "~";
      const parts = resolve(target);
      const node = nodeAt(parts);
      if (!node) return print(`cd: no such file or directory: ${target}`, "t-err");
      if (node.type !== "dir") return print(`cd: not a directory: ${target}`, "t-err");
      if (node.hidden) return print(`cd: permission denied: ${target} (least privilege, remember?)`, "t-err");
      cwd = parts;
      updatePrompt();
      if (node.section) {
        listDir(node);
        print(`hint: cat <file> to read one, or 'exit' to jump to this section on the page.`, "t-dim");
      } else if (node.full) {
        listDir(node);
        print("hint: cat <section> to read one part, cat ~/resume for all of it, or download resume.", "t-dim");
      }
    },
    pwd() {
      print(`/home/guest/${cwd.join("/")}`.replace(/\/$/, ""));
    },
    cat(args) {
      if (!args.length) return print("cat: missing file operand", "t-err");
      args.forEach((a) => {
        const found = findFile(a);
        const node = found && found.node;
        if (!node) return print(`cat: ${a}: No such file or directory`, "t-err");
        if (node.type === "dir" && node.full) return node.full.forEach((l) => print(l)); // cat resume
        if (node.type === "dir") return print(`cat: ${a}: Is a directory`, "t-err");
        if (node.locked) return print(`cat: ${a}: Permission denied. nice try though.`, "t-err");
        node.lines.forEach((l) => print(l));
      });
    },
    open(args) {
      const what = (args[0] || "").toLowerCase().replace(/\.md$/, "");
      if (!what) return print("usage: open <project|github|linkedin|resume>", "t-warn");
      if (what === "email" || what === "mail") return commands.message();
      const quick = {
        github: document.querySelector('#contact a[href*="github.com"]'),
        linkedin: document.querySelector('#contact a[href*="linkedin.com"]'),
        resume: document.querySelector('#contact a[href$="resume.pdf"]'),
      };
      if (quick[what]) {
        window.open(quick[what].href, "_blank", "noopener");
        return print(`opening ${what}…`, "t-ok");
      }
      const proj = FS.children.projects.children[`${slug(what)}.md`] ||
        Object.values(FS.children.projects.children).find((p) => slug(p.title).startsWith(slug(what)));
      if (proj && proj.links && proj.links.length) {
        window.open(proj.links[0].href, "_blank", "noopener");
        return print(`opening ${proj.title} (${proj.links[0].label})…`, "t-ok");
      }
      if (proj) return print(`${proj.title} has no public link.`, "t-warn");
      print(`open: '${args[0]}' not found. try: ls ~/projects`, "t-err");
    },
    download(args) {
      const what = (args.filter((a) => !a.startsWith("-"))[0] || "resume").toLowerCase();
      if (!/^(~\/)?resume(\.pdf)?$/.test(what)) return print(`download: only the resume is downloadable. try: download resume`, "t-err");
      const a = document.createElement("a");
      a.href = "resume.pdf";
      a.download = "Ishaan-Arekar-Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      print("Ishaan-Arekar-Resume.pdf  100%[==================>]  saved", "t-ok");
    },
    whoami() {
      print("guest");
      print("(the person you're looking for is ishaan: cat ~/about.txt)", "t-dim");
    },
    id() {
      print("uid=1000(guest) gid=1000(visitors) groups=1000(visitors),27(recruiters)");
    },
    uname(args) {
      print(args.includes("-a") ? "PortfolioOS 1.0 ishaan html-css-js #1 SMP x86_64 GNU/Linux" : "PortfolioOS");
    },
    neofetch() {
      const projects = Object.keys(FS.children.projects.children).length;
      const art = ["   ___ ", "  |_ _|", "   | | ", "   | | ", "  |___|", "       "];
      const info = [
        `<span class="t-ok">ishaan</span>@<span class="t-ok">portfolio</span>`,
        `<span class="t-ok">os</span>      PortfolioOS 1.0`,
        `<span class="t-ok">shell</span>   ish 1.0 (you're in it)`,
        `<span class="t-ok">theme</span>   hairline dark`,
        `<span class="t-ok">focus</span>   software + security, 50/50`,
        `<span class="t-ok">pkgs</span>    ${projects} projects`,
      ];
      art.forEach((a, i) => printHTML(`<span class="t-ok">${a.replace(/</g, "&lt;")}</span>   ${info[i] || ""}`));
    },
    scan() {
      const lines = [
        ["Starting scan of portfolio (simulated, nothing is actually probed)", "t-dim"],
        ["PORT      STATE     SERVICE", "t-head"],
        ["22/tcp    filtered  ssh       (not exposed, as it should be)", ""],
        ["80/tcp    open      http      → redirects to https", ""],
        ["443/tcp   open      https     tls 1.3", "t-ok"],
        ["", ""],
        ["headers:  no trackers · no cookies · static files only", "t-dim"],
        ["result:   attack surface ≈ a static site. that's the point.", "t-ok"],
      ];
      lines.forEach(([t, c], i) => setTimeout(() => { print(t, c); scrollDown(); }, reduceMotion ? 0 : i * 180));
    },
    history() {
      history.forEach((h, i) => print(`  ${String(i + 1).padStart(3)}  ${h}`));
    },
    clear() {
      out.innerHTML = "";
    },
    echo(args) {
      print(args.join(" "));
    },
    date() {
      print(new Date().toString());
    },
    sudo(args) {
      if (args.join(" ") === "hire-me") {
        print("[sudo] password for guest: ********", "t-dim");
        print("access granted.", "t-ok");
        commands.cat(["~/contact.txt"]);
        print("");
        print("ishaan is open to Summer 2027 internships: SWE, cloud, or security.", "t-ok");
        print("type 'message' to send him a note.", "t-dim");
        return;
      }
      print("guest is not in the sudoers file. This incident will be reported.", "t-err");
      print("(try: sudo hire-me)", "t-dim");
    },
    rm(args) {
      if (args.join(" ").includes("-rf")) return print("rm: nice try. this filesystem is read-only, and so is my sense of humor.", "t-err");
      print("rm: read-only file system", "t-err");
    },
    ssh() {
      print("ssh: connect to host ishaan port 22: Connection refused (good. it should be.)", "t-err");
    },
    sections() {
      print("everything on the site:", "t-head");
      SECTIONS.forEach(([name, , how]) => printHTML(`  <span class="t-ok">${name.padEnd(14)}</span><span class="t-dim">${how.padEnd(18)}</span><span class="t-dim">or goto ${name}</span>`));
    },
    goto(args) {
      const name = (args[0] || "").toLowerCase().replace(/\.(txt|md)$/, "");
      const hit = SECTIONS.find(([n, id]) => n === name || id === name);
      if (!hit) return print(`goto: unknown section '${args[0] || ""}'. try: sections`, "t-err");
      print(`jumping to ${hit[0]}…`, "t-ok");
      setTimeout(() => {
        collapse(false);
        document.getElementById(hit[1]).scrollIntoView();
      }, reduceMotion ? 0 : 250);
    },
    tail(args) {
      if (!args.some((a) => /sec\.log$/.test(a))) return print("usage: tail [-f] sec.log", "t-warn");
      if (!args.includes("-f")) return LOG_LINES.slice(-6).forEach((l) => print(logLine(l)));
      print("streaming sec.log (simulated)… stops after a few lines", "t-dim");
      LOG_LINES.slice(0, 8).forEach((l, i) =>
        setTimeout(() => { print(logLine(l)); scrollDown(); if (i === 7) { print("^C", "t-dim"); scrollDown(); } }, reduceMotion ? 0 : (i + 1) * 450)
      );
    },
    message() {
      const form = document.getElementById("contact-form");
      if (!form) return print("message: the contact form isn't on this page", "t-err");
      print("opening the contact form…", "t-ok");
      setTimeout(() => {
        collapse(false);
        form.scrollIntoView(); // honours scroll-padding-top, so the sticky nav never covers it
        document.getElementById("cf-name").focus({ preventScroll: true });
      }, reduceMotion ? 0 : 250);
    },
    fullscreen() {
      if (isFull()) collapse(false);
      else expand();
    },
    exit() {
      if (isFull()) return collapse(true);
      const node = nodeAt(cwd);
      if (node && node.section) return document.getElementById(node.section).scrollIntoView();
      print("you're already on the page. hit ⤢ full screen for more room.", "t-dim");
    },
  };
  commands.ll = (args) => commands.ls(["-a", ...args]);
  commands.gui = commands.exit;
  commands.quit = commands.exit;
  commands.man = () => commands.help();
  // section shortcuts: "skills" works like "cat skills", "projects" like "ls projects"
  ["about", "status", "tracks", "education", "skills", "achievements", "contact"].forEach((name) => {
    commands[name] = () => commands.cat([`~/${name}`]);
  });
  commands.projects = () => commands.ls(["~/projects"]);
  commands.work = commands.projects;
  commands.experience = () => commands.ls(["~/experience"]);
  commands.map = commands.sections;
  commands.wget = commands.download;
  commands.curl = commands.download;
  commands.resume = () => commands.open(["resume"]);
  commands.full = commands.fullscreen;
  commands.mail = commands.message;

  // ----- Input handling -----
  const history = [];
  let histIdx = 0;

  function run(raw) {
    FS = buildFS();
    const line = raw.trim();
    echoCommand(raw);
    if (line) {
      history.push(line);
      histIdx = history.length;
      const [cmd, ...args] = line.split(/\s+/);
      const fn = commands[cmd.toLowerCase()];
      if (fn) fn(args);
      else print(`ish: command not found: ${cmd}. try 'help'`, "t-err");
    }
    scrollDown();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    run(v);
  });

  function complete() {
    const v = input.value;
    const parts = v.split(/\s+/);
    if (parts.length === 1) {
      const m = Object.keys(commands).filter((c) => c.startsWith(parts[0]));
      if (m.length === 1) input.value = m[0] + " ";
      else if (m.length > 1) { echoCommand(v); print(m.join("   ")); scrollDown(); }
      return;
    }
    const partial = parts[parts.length - 1];
    const slash = partial.lastIndexOf("/");
    const base = slash >= 0 ? partial.slice(0, slash + 1) : "";
    const stem = slash >= 0 ? partial.slice(slash + 1) : partial;
    const node = nodeAt(resolve(base || "."));
    if (!node || node.type !== "dir") return;
    const m = Object.keys(node.children).filter((n) => n.startsWith(stem) && (stem.startsWith(".") || !node.children[n].hidden));
    if (m.length === 1) {
      const isDir = node.children[m[0]].type === "dir";
      parts[parts.length - 1] = base + m[0] + (isDir ? "/" : "");
      input.value = parts.join(" ");
    } else if (m.length > 1) {
      echoCommand(v);
      print(m.join("   "));
      scrollDown();
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      if (!input.value && !isFull()) return; // empty inline prompt: let Tab move focus on, so nobody gets trapped
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx > 0) input.value = history[--histIdx];
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      histIdx = Math.min(history.length, histIdx + 1);
      input.value = history[histIdx] || "";
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      commands.clear();
    }
  });

  term.querySelectorAll(".term-chips button").forEach((b) =>
    b.addEventListener("click", () => {
      run(b.dataset.cmd);
      input.focus();
    })
  );
  body.addEventListener("click", () => {
    if (!window.getSelection().toString()) input.focus();
  });

  // ----- Boot + live demo -----
  let userTyped = false;
  input.addEventListener("keydown", () => { userTyped = true; }, { once: true });

  function boot() {
    const lines = [
      ["[  OK  ] Mounted /home/guest", "t-ok"],
      ["[  OK  ] Started portfolio.service", "t-ok"],
      ["[  OK  ] Firewall up · ssh disabled · no trackers", "t-ok"],
      ["", ""],
      ["PortfolioOS 1.0 · ishaan arekar · software engineering + security", "t-head"],
      ["type 'help', or try: cd projects, cat resume", "t-dim"],
      ["", ""],
    ];
    if (reduceMotion) return lines.forEach(([t, c]) => print(t, c));
    lines.forEach(([t, c], i) => setTimeout(() => { print(t, c); scrollDown(); }, 300 + i * 110));
    setTimeout(() => demoType("ls"), 300 + lines.length * 110 + 600);
  }

  // types a command on its own so the panel feels alive, unless the visitor got there first
  function demoType(cmd) {
    if (userTyped) return;
    let k = 0;
    const t = setInterval(() => {
      if (userTyped) { clearInterval(t); input.value = ""; return; }
      input.value = cmd.slice(0, ++k);
      if (k === cmd.length) {
        clearInterval(t);
        setTimeout(() => { if (!userTyped) { input.value = ""; run(cmd); } }, 350);
      }
    }, 120);
  }

  // ----- Inline <-> full screen -----
  const fullBtn = term.querySelector(".term-full");
  const isFull = () => term.classList.contains("is-full");

  function expand() {
    if (isFull()) return;
    term.classList.add("is-full");
    term.setAttribute("role", "dialog");
    term.setAttribute("aria-modal", "true");
    document.body.classList.add("term-active");
    fullBtn.setAttribute("aria-pressed", "true");
    fullBtn.textContent = "⤡ exit full screen";
    scrollDown();
    setTimeout(() => input.focus(), 30);
  }

  function collapse(jump) {
    if (!isFull()) return;
    term.classList.remove("is-full");
    term.setAttribute("role", "region");
    term.removeAttribute("aria-modal");
    document.body.classList.remove("term-active");
    fullBtn.setAttribute("aria-pressed", "false");
    fullBtn.textContent = "⤢ full screen";
    scrollDown();
    const node = nodeAt(cwd);
    if (jump && node && node.section) document.getElementById(node.section).scrollIntoView();
    else fullBtn.focus({ preventScroll: true });
  }

  fullBtn.addEventListener("click", () => (isFull() ? collapse(false) : expand()));

  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === "`" || e.key === "~") && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      isFull() ? collapse(false) : expand();
    } else if (isFull() && e.key === "Escape") {
      collapse(false);
    } else if (isFull() && e.key === "Tab" && e.target !== input && e.target !== fullBtn) {
      // keep focus inside the full-screen terminal
      e.preventDefault();
      input.focus();
    }
  });

  // ----- Start -----
  FS = buildFS();
  updatePrompt();
  loadResume().then(() => { FS = buildFS(); });
  boot();
})();
