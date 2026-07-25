import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const measurementId = "G-E9WKM6FF0H";
const tagUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
const exportDir = fileURLToPath(new URL("../export/", import.meta.url));
const snippet = `<!-- Google tag (gtag.js) -->
<script async src="${tagUrl}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${measurementId}');
</script>`;

const htmlFiles = (await readdir(exportDir)).filter((file) => file.endsWith(".html"));

for (const file of htmlFiles) {
  const filePath = join(exportDir, file);
  const html = await readFile(filePath, "utf8");
  const existingTag = html.match(/https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=([^"'&<\s]+)/);

  if (existingTag && existingTag[1] !== measurementId) {
    throw new Error(`${file} already declares a different Google tag: ${existingTag[1]}`);
  }

  if (html.includes(tagUrl)) continue;
  if (!/<head(?:\s[^>]*)?>/i.test(html)) {
    throw new Error(`${file} does not include a head element`);
  }

  await writeFile(
    filePath,
    html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n  ${snippet}`),
    "utf8",
  );
}
