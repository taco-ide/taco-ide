/**
 * TACO demo-reel recorder.
 *
 * Drives the running dev stack (web :4001 + api :4000) with Playwright and
 * records ONE .webm per scene into demo/output/, plus a checkpoint screenshot
 * per scene into demo/shots/. Each scene is self-contained: a branded title
 * card ("text") followed by the feature demo — ready to drop into an editor in
 * numeric order.
 *
 * Prereqs:
 *   - dev DB seeded (npm run db:seed:dev) — uses professor@taco-demo.local
 *   - servers running (the runner script starts them) — override with
 *     DEMO_BASE_URL / DEMO_API_URL.
 *
 * Run: node demo/record-demo.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:4001";
const OUT = path.resolve("demo/output");
const SHOTS = path.resolve("demo/shots");
const AUTH_STATE = path.resolve("demo/.auth/professor.json");
const SIZE = { width: 1600, height: 900 };

const PROFESSOR = { email: "professor@taco-demo.local", password: "Teste123!@" };
const CHALLENGE = "00000000-0000-0000-0000-0000000000a0";
const WS_JOHN = "77777777-7777-7777-7777-7777777700a5";
const SUB_JOHN = "88888888-8888-8888-8888-8888888800a5";

const beat = (ms) => new Promise((r) => setTimeout(r, ms));

for (const dir of [OUT, SHOTS, path.dirname(AUTH_STATE)]) {
  fs.mkdirSync(dir, { recursive: true });
}

// ---- Synthetic cursor (injected on every document) ----
const CURSOR_SCRIPT = () => {
  if (window.__demoCursor) return;
  window.__demoCursor = true;
  const mount = () => {
    if (!document.documentElement) return;
    const c = document.createElement("div");
    c.id = "__demo_cursor";
    c.style.cssText =
      "position:fixed;top:-100px;left:-100px;width:22px;height:22px;border-radius:50%;" +
      "background:rgba(255,184,0,0.35);border:2px solid #FFB800;" +
      "box-shadow:0 0 0 4px rgba(255,184,0,0.12);transform:translate(-50%,-50%);" +
      "z-index:2147483646;pointer-events:none;transition:top .04s linear,left .04s linear";
    document.documentElement.appendChild(c);
    window.addEventListener(
      "mousemove",
      (e) => {
        c.style.left = e.clientX + "px";
        c.style.top = e.clientY + "px";
      },
      true
    );
  };
  if (document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", mount);
};

// ---- Title card markup (shared by intro/outro + in-feature overlay) ----
function cardInner(kicker, title, subtitle) {
  return `
    <div style="text-align:center;max-width:1100px;padding:0 64px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
      <div style="font-size:34px;font-weight:800;letter-spacing:1px;color:#FFB800;margin-bottom:34px">🌮 TACO</div>
      <div style="font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#FFB800;opacity:.9;margin-bottom:18px">${kicker}</div>
      <div style="font-size:58px;line-height:1.1;font-weight:800;color:#f8fafc;margin-bottom:20px">${title}</div>
      <div style="font-size:23px;line-height:1.5;color:#94a3b8">${subtitle}</div>
    </div>`;
}
const CARD_BG =
  "background:radial-gradient(1200px 600px at 50% 35%,#1e293b 0%,#0b1120 70%)";

function fullCardHTML(kicker, title, subtitle) {
  return `<!doctype html><html><body style="margin:0">
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;${CARD_BG}">
      ${cardInner(kicker, title, subtitle)}
    </div></body></html>`;
}

async function overlayCard(page, kicker, title, subtitle, hold = 3400) {
  await page.evaluate(
    ({ inner, bg }) => {
      const el = document.createElement("div");
      el.id = "__demo_card";
      el.style.cssText =
        `position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;` +
        `justify-content:center;opacity:0;transition:opacity .5s ease;${bg}`;
      el.innerHTML = inner;
      document.documentElement.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
      });
    },
    { inner: cardInner(kicker, title, subtitle), bg: CARD_BG }
  );
  await beat(hold);
  await page.evaluate(() => {
    const el = document.getElementById("__demo_card");
    if (el) {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 600);
    }
  });
  await beat(700);
}

/** Move the synthetic cursor to a locator and click (cinematic). */
async function clickSlow(page, locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 24,
    });
    await beat(250);
  }
  await locator.click();
}

/**
 * Cinematic smooth scroll over a controlled duration (easeInOutQuad), instead
 * of the browser's short native smooth scroll. `frac` is 0..1 of the page's
 * max scroll.
 */
async function smoothScroll(page, frac = 1, duration = 2400) {
  await page.evaluate(
    ({ frac, duration }) =>
      new Promise((resolve) => {
        const maxY = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight
        );
        const startY = window.scrollY;
        const dist = maxY * frac - startY;
        if (Math.abs(dist) < 2) return resolve();
        const start = performance.now();
        const ease = (t) =>
          t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const frame = (now) => {
          const p = Math.min(1, (now - start) / duration);
          window.scrollTo(0, startY + dist * ease(p));
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      }),
    { frac, duration }
  );
}

/**
 * Cinematic push-in / pull-out by animating a CSS transform on <body>
 * (easeInOutQuad). Used when a panel fits the viewport and there's nothing to
 * scroll — gives smooth motion and enlarges small text. The synthetic cursor
 * lives on <html>, so it is not affected by the <body> transform.
 */
async function zoomTo(page, scale, duration = 2200, origin = "50% 35%") {
  await page.evaluate(
    ({ scale, duration, origin }) =>
      new Promise((resolve) => {
        const b = document.body;
        b.style.transformOrigin = origin;
        b.style.willChange = "transform";
        const from = window.__demoScale || 1;
        const start = performance.now();
        const ease = (t) =>
          t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const frame = (now) => {
          const p = Math.min(1, (now - start) / duration);
          const s = from + (scale - from) * ease(p);
          b.style.transform = `scale(${s})`;
          window.__demoScale = s;
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      }),
    { scale, duration, origin }
  );
}

async function dismissTourIfPresent(page) {
  try {
    const close = page.locator(".driver-popover-close-btn");
    if (await close.isVisible({ timeout: 1500 })) {
      await close.click();
      await beat(400);
    }
  } catch {
    /* no tour — fine */
  }
}

// ---- Scene runner: one context => one video file ----
async function runScene(browser, name, { authed = true, fn }) {
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT, size: SIZE },
    storageState: authed ? AUTH_STATE : undefined,
    locale: "en-US",
  });
  await context.addInitScript(CURSOR_SCRIPT);
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "en", url: BASE },
  ]);
  const page = await context.newPage();
  const video = page.video();
  try {
    await fn(page);
  } finally {
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
    await context.close();
  }
  const src = await video.path();
  const dest = path.join(OUT, `${name}.webm`);
  fs.renameSync(src, dest);
  console.log(`✓ ${name} -> ${path.relative(process.cwd(), dest)}`);
}

async function main() {
  const browser = await chromium.launch();

  // 00 — Intro card
  await runScene(browser, "00-intro", {
    authed: false,
    fn: async (page) => {
      await page.setContent(
        fullCardHTML(
          "Demo",
          "Teach Python with AI in the loop",
          "Create exercises, let an AI tutor help students, and review how they got there."
        )
      );
      await beat(4200);
    },
  });

  // 01 — Login (also produces the auth state for later scenes)
  await runScene(browser, "01-login", {
    authed: false,
    fn: async (page) => {
      await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
      await page.getByLabel(/email/i).waitFor({ timeout: 30_000 });
      await overlayCard(
        page,
        "Step 1",
        "One workspace for your class",
        "Teachers, coordinators and students — one secure sign-in."
      );
      await page.getByLabel(/email/i).pressSequentially(PROFESSOR.email, {
        delay: 55,
      });
      await beat(400);
      await page
        .getByLabel(/password/i)
        .pressSequentially(PROFESSOR.password, { delay: 55 });
      await beat(500);
      await clickSlow(page, page.getByRole("button", { name: /sign in/i }));
      await page.waitForURL((u) => !u.pathname.startsWith("/auth/login"), {
        timeout: 30_000,
      });
      await beat(1500);
      await page.context().storageState({ path: AUTH_STATE });
    },
  });

  // 02 — Dashboard
  await runScene(browser, "02-dashboard", {
    fn: async (page) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      await dismissTourIfPresent(page);
      await beat(1000);
      await overlayCard(
        page,
        "Overview",
        "Your classroom at a glance",
        "Recent challenges, classrooms and quick actions — in one place."
      );
      // Pan down to reveal the classrooms…
      await page.mouse.move(560, 420, { steps: 12 });
      await smoothScroll(page, 0.4, 1800);
      await beat(1400);
      // …then open the "Data Structures" classroom to show what's inside.
      const dsCard = page
        .getByRole("link", { name: /Data Structures/i })
        .first();
      await clickSlow(page, dsCard);
      await page.waitForURL(/\/classrooms\//, { timeout: 20_000 });
      await page
        .getByRole("heading", { name: /Data Structures/i })
        .first()
        .waitFor({ timeout: 15_000 });
      await beat(1500);
      // Smoothly scroll through the room: students, then its problems.
      await smoothScroll(page, 0.5, 2800);
      await page.mouse.move(800, 360, { steps: 16 });
      await beat(1800);
      await smoothScroll(page, 1, 2800);
      await page.mouse.move(800, 380, { steps: 14 });
      await beat(2000);
    },
  });

  // 03 — Submissions list
  await runScene(browser, "03-submissions", {
    fn: async (page) => {
      await page.goto(`${BASE}/create/${CHALLENGE}/submissions`, {
        waitUntil: "domcontentloaded",
      });
      await page.getByText(/Mary/).first().waitFor({ timeout: 20_000 });
      await overlayCard(
        page,
        "Submissions",
        "Every submission in one place",
        "The whole class, with AI-review status and grades."
      );
      await beat(2800);
    },
  });

  // 04 — AI auto-review (John's submission)
  await runScene(browser, "04-auto-review", {
    fn: async (page) => {
      await page.goto(
        `${BASE}/create/${CHALLENGE}/submissions/${SUB_JOHN}`,
        { waitUntil: "domcontentloaded" }
      );
      await page
        .getByText(/Incomplete submission/i)
        .waitFor({ timeout: 20_000 });
      await overlayCard(
        page,
        "AI review",
        "Every submission, reviewed by AI",
        "Strengths, problems by severity, and concrete next steps."
      );
      // The review fits the viewport (nothing to scroll), so present it with a
      // slow push-in on the review column, then pull back. Cursor stays on the
      // panel at fixed, always-visible coordinates.
      await page.mouse.move(330, 360, { steps: 18 });
      await beat(1500);
      await page.mouse.move(820, 320, { steps: 18 });
      await beat(500);
      await zoomTo(page, 1.45, 2400, "50% 32%");
      await beat(2800);
      await zoomTo(page, 1, 2000, "50% 32%");
      await page.mouse.move(820, 320, { steps: 12 });
      await beat(800);
    },
  });

  // 05 — Replay (HERO)
  await runScene(browser, "05-replay", {
    fn: async (page) => {
      await page.goto(
        `${BASE}/create/${CHALLENGE}/work-sessions/${WS_JOHN}/replay`,
        { waitUntil: "domcontentloaded" }
      );
      await page.getByText(/Steps/i).first().waitFor({ timeout: 20_000 });
      await overlayCard(
        page,
        "Replay",
        "Replay how a student solved it",
        "Step through chat, code and output — see what changed, and when."
      );
      // Let autoplay run briefly first (Play is enabled before reaching the end).
      await clickSlow(page, page.getByRole("button", { name: /play/i }));
      await beat(4500);
      const pause = page.getByRole("button", { name: /pause/i });
      if (await pause.isVisible().catch(() => false)) await pause.click();
      await beat(1200);
      // Then walk key steps via the right-hand Steps column, ending on the
      // final-code milestone so the scene closes on the full solution + diff.
      const stepButtons = page.locator("aside ol li button");
      const count = await stepButtons.count();
      const picks = [2, 6, count].filter((n) => n >= 1 && n <= count);
      for (const n of picks) {
        await clickSlow(page, stepButtons.nth(n - 1));
        await beat(2300);
      }
      await beat(1200);
    },
  });

  // 06 — Outro card
  await runScene(browser, "06-outro", {
    authed: false,
    fn: async (page) => {
      await page.setContent(
        fullCardHTML(
          "TACO",
          "Teach Python with AI in the loop",
          "From assignment to insight — in one platform."
        )
      );
      await beat(4200);
    },
  });

  await browser.close();
  console.log("\nAll scenes recorded to demo/output/  ·  screenshots in demo/shots/");
}

main().catch((err) => {
  console.error("demo recorder failed:", err);
  process.exit(1);
});
