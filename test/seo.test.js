import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

test("robots.txt is configured with domain, crawl rules, blocked internal routes, and sitemap reference", async () => {
  const robotsPath = path.join(publicDir, "robots.txt");
  const content = await fs.readFile(robotsPath, "utf8");

  assert.ok(content.includes("User-agent: *"), "Must specify User-agent: *");
  assert.ok(content.includes("Allow: /"), "Must allow root public pages");
  assert.ok(content.includes("Disallow: /api/"), "Must disallow /api/");
  assert.ok(content.includes("Disallow: /admin"), "Must disallow /admin");
  assert.ok(content.includes("Disallow: /dashboard"), "Must disallow /dashboard");
  assert.ok(
    content.includes("Sitemap: https://helmerworkspace.com/sitemap.xml"),
    "Must reference full sitemap URL"
  );
  assert.ok(
    content.includes("Host: https://helmerworkspace.com"),
    "Must specify Host directive"
  );
});

test("sitemap.xml is valid XML containing public routes and proper priorities", async () => {
  const sitemapPath = path.join(publicDir, "sitemap.xml");
  const content = await fs.readFile(sitemapPath, "utf8");

  assert.ok(content.startsWith("<?xml"), "Must be a valid XML file");
  assert.ok(content.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));

  // Main page with priority 1.0
  assert.ok(content.includes("<loc>https://helmerworkspace.com/</loc>"));
  assert.ok(content.includes("<priority>1.0</priority>") || content.includes("<priority>1.00</priority>"));

  // Legal and public pages
  assert.ok(content.includes("<loc>https://helmerworkspace.com/privacy</loc>"));
  assert.ok(content.includes("<loc>https://helmerworkspace.com/terms</loc>"));
});

test("index.html head includes title, description, canonical link, robots, and OpenGraph tags", async () => {
  const indexPath = path.join(publicDir, "index.html");
  const content = await fs.readFile(indexPath, "utf8");

  assert.ok(content.includes("<title>Helmer Workspace | Build. Ask. Act.</title>"), "Must have title");
  assert.ok(content.includes('name="description"'), "Must have meta description");
  assert.ok(
    content.includes('<link rel="canonical" href="https://helmerworkspace.com/" />') ||
    content.includes('<link rel="canonical" href="https://helmerworkspace.com/">'),
    "Must have canonical link to https://helmerworkspace.com/"
  );
  assert.ok(content.includes('name="robots" content="index, follow"'), "Must have index, follow robots meta");
  assert.ok(content.includes('property="og:title"'), "Must have og:title");
  assert.ok(content.includes('property="og:description"'), "Must have og:description");
  assert.ok(content.includes('property="og:url" content="https://helmerworkspace.com/"'), "Must have og:url");
  assert.ok(content.includes('property="og:type" content="website"'), "Must have og:type");
  assert.ok(content.includes('property="og:image" content="https://helmerworkspace.com/MarketifyAINewFavicon.png"'), "Must have absolute og:image");
});

test("privacy.html and terms.html include canonical links and indexing metadata", async () => {
  const privacyContent = await fs.readFile(path.join(publicDir, "privacy.html"), "utf8");
  const termsContent = await fs.readFile(path.join(publicDir, "terms.html"), "utf8");

  assert.ok(privacyContent.includes('href="https://helmerworkspace.com/privacy"'), "Privacy must have canonical link");
  assert.ok(privacyContent.includes('name="robots" content="index, follow"'), "Privacy must allow indexing");
  assert.ok(privacyContent.includes('property="og:url" content="https://helmerworkspace.com/privacy"'), "Privacy must have og:url");

  assert.ok(termsContent.includes('href="https://helmerworkspace.com/terms"'), "Terms must have canonical link");
  assert.ok(termsContent.includes('name="robots" content="index, follow"'), "Terms must allow indexing");
  assert.ok(termsContent.includes('property="og:url" content="https://helmerworkspace.com/terms"'), "Terms must have og:url");
});

test("index_admin.html includes noindex, nofollow robots tag", async () => {
  const adminContent = await fs.readFile(path.join(publicDir, "index_admin.html"), "utf8");
  assert.ok(adminContent.includes('name="robots" content="noindex, nofollow"'), "Admin page must not be indexed");
});
