// Headless verification of the THANK YOU footer WebGL shader.
// Loads export/index.html, checks the canvas + WebGL context, no errors,
// and screenshots the footer card. Run: node verify-thankyou.js
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const fileUrl =
    "file://" + path.resolve(__dirname, "export/index.html");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForTimeout(1000); // let a few rAF frames run

  const info = await page.evaluate(() => {
    const c = document.querySelector("canvas[data-thankyou-shader]");
    if (!c) return { canvas: false };
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    const footer = document.querySelector('[data-framer-name="v2/Footer"]');
    const thanks = Array.from(document.querySelectorAll("span,p")).find((e) =>
      /THANK YOU/.test(e.textContent || "")
    );
    const fr = footer ? footer.getBoundingClientRect() : null;
    const tr = thanks ? thanks.getBoundingClientRect() : null;
    const tcs = thanks ? getComputedStyle(thanks) : null;
    return {
      canvas: true,
      drawW: c.width,
      drawH: c.height,
      cssW: Math.round(c.clientWidth),
      cssH: Math.round(c.clientHeight),
      hasGL: !!gl,
      glLost: gl ? gl.isContextLost() : null,
      footerW: fr ? Math.round(fr.width) : null,
      footerBg: footer ? getComputedStyle(footer).backgroundColor : null,
      // canvas should fill the footer width
      fillsWidth: fr ? Math.abs(c.clientWidth - fr.width) < 2 : null,
      thanksText: thanks ? (thanks.textContent || "").trim() : null,
      thanksVisible: !!(tr && tr.width > 0 && tr.height > 0 && tcs.visibility !== "hidden"),
      thanksZ: tcs ? tcs.zIndex : null,
    };
  });

  // Scroll footer into view and screenshot it.
  await page.evaluate(() => {
    const f = document.querySelector('[data-framer-name="v2/Footer"]');
    if (f) f.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(500);
  const footer = await page.$('[data-framer-name="v2/Footer"]');
  const shot = path.resolve(__dirname, "export/thankyou-shader-proof.png");
  if (footer) await footer.screenshot({ path: shot });

  await browser.close();

  console.log(JSON.stringify({ info, consoleErrors, pageErrors, shot }, null, 2));

  const ok =
    info.canvas &&
    info.hasGL &&
    info.glLost === false &&
    info.drawW > 0 &&
    info.fillsWidth &&
    info.thanksVisible &&
    /THANK YOU/.test(info.thanksText || "") &&
    consoleErrors.filter((e) => /shader|compile|link|webgl/i.test(e)).length === 0 &&
    pageErrors.length === 0;
  console.log("VERIFY_RESULT:", ok ? "PASS" : "FAIL");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("verify-thankyou crashed:", e);
  process.exit(2);
});
