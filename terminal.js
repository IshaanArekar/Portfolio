// =========================================================
// Terminal mode: a tiny Linux-style shell over the page.
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
  const { closeMenu } = window.portfolio;

  const clean = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ----- Build the file system from the DOM -----
  function file(lines, extra = {}) {
    return { type: "file", lines, ...extra };
  }
  function dir(children, extra = {}) {
    return { type: "dir", children, ...extra };
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

    const mail = document.querySelector('#contact a[href^="mailto:"]');
    const contact = [...document.querySelectorAll("#contact .contact-links a")].map((a) => ({
      link: a.href,
      t: `${clean(a).replace(" ↗", "").padEnd(10)} ${a.getAttribute("href")}`,
    }));
    if (mail) contact.unshift({ link: mail.href, t: `${"email".padEnd(10)} ${clean(mail)}` });

    return dir({
      "about.txt": file([...about.flatMap((p) => [p, ""]), { t: "-----BEGIN CERTIFICATE-----", c: "t-dim" }, ...cert, { t: "-----END CERTIFICATE-----", c: "t-dim" }]),
      projects: dir(projects, { section: "work" }),
      experience: dir(experience, { section: "experience" }),
      "skills.txt": file(skills),
      "achievements.txt": file(achievements),
      "contact.txt": file(contact),
      "resume.pdf": file([{ t: "binary file. try: open resume", c: "t-dim" }], { href: "resume.pdf" }),
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
    ["cat <file>", "print a file, e.g. cat about.txt"],
    ["open <name>", "open a project, github, linkedin, resume or email"],
    ["pwd · whoami · id", "where and who you are"],
    ["neofetch", "system info"],
    ["scan", "port-scan this site (simulated)"],
    ["history · clear", "shell basics"],
    ["sudo hire-me", "the important one"],
    ["exit", "back to the normal site"],
  ];

  const commands = {
    help() {
      print("available commands:", "t-head");
      HELP.forEach(([c, d]) => printHTML(`  <span class="t-ok">${c.padEnd(20)}</span><span class="t-dim">${d}</span>`));
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
      }
    },
    pwd() {
      print(`/home/guest/${cwd.join("/")}`.replace(/\/$/, ""));
    },
    cat(args) {
      if (!args.length) return print("cat: missing file operand", "t-err");
      args.forEach((a) => {
        const node = nodeAt(resolve(a));
        if (!node) return print(`cat: ${a}: No such file or directory`, "t-err");
        if (node.type === "dir") return print(`cat: ${a}: Is a directory`, "t-err");
        if (node.locked) return print(`cat: ${a}: Permission denied. nice try though.`, "t-err");
        node.lines.forEach((l) => print(l));
      });
    },
    open(args) {
      const what = (args[0] || "").toLowerCase().replace(/\.md$/, "");
      if (!what) return print("usage: open <project|github|linkedin|resume|email>", "t-warn");
      const quick = {
        github: document.querySelector('#contact a[href*="github.com"]'),
        linkedin: document.querySelector('#contact a[href*="linkedin.com"]'),
        resume: document.querySelector('#contact a[href$="resume.pdf"]'),
        email: document.querySelector('#contact a[href^="mailto:"]'),
      };
      if (quick[what]) {
        window.open(quick[what].href, what === "email" ? "_self" : "_blank", "noopener");
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
    exit() {
      close(true);
    },
  };
  commands.ll = (args) => commands.ls(["-a", ...args]);
  commands.gui = commands.exit;
  commands.quit = commands.exit;
  commands.man = () => commands.help();

  // ----- Input handling -----
  const history = [];
  let histIdx = 0;

  function run(raw) {
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

  // ----- Open / close -----
  let opener = null;
  let booted = false;

  function boot() {
    const lines = [
      ["[  OK  ] Mounted /home/guest", "t-ok"],
      ["[  OK  ] Started portfolio.service", "t-ok"],
      ["[  OK  ] Loaded projects, experience, skills", "t-ok"],
      ["[  OK  ] Firewall up · ssh disabled · no trackers", "t-ok"],
      ["", ""],
      ["PortfolioOS 1.0 · ishaan arekar · software engineering + security", "t-head"],
      ["type 'help' to get started, or try: cd projects", "t-dim"],
      ["", ""],
    ];
    if (reduceMotion) return lines.forEach(([t, c]) => print(t, c));
    lines.forEach(([t, c], i) => setTimeout(() => { print(t, c); scrollDown(); }, i * 90));
  }

  function open() {
    if (!term.hidden) return;
    closeMenu();
    FS = buildFS(); // rebuild each time so it reflects the current page
    opener = document.activeElement;
    term.hidden = false;
    document.body.classList.add("term-active");
    updatePrompt();
    if (!booted) { boot(); booted = true; }
    setTimeout(() => input.focus(), 30);
  }

  function close(jump) {
    if (term.hidden) return;
    term.hidden = true;
    document.body.classList.remove("term-active");
    const node = nodeAt(cwd);
    if (jump && node && node.section) {
      document.getElementById(node.section).scrollIntoView();
    } else if (opener) {
      opener.focus();
    }
  }

  document.querySelectorAll(".term-open").forEach((b) => b.addEventListener("click", open));
  term.querySelector(".term-close").addEventListener("click", () => close(false));

  document.addEventListener("keydown", (e) => {
    const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
    if (term.hidden && (e.key === "`" || e.key === "~") && !typing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      open();
    } else if (!term.hidden && e.key === "Escape") {
      close(false);
    } else if (!term.hidden && e.key === "Tab" && e.target !== input) {
      // keep focus inside the dialog
      e.preventDefault();
      input.focus();
    }
  });
})();
