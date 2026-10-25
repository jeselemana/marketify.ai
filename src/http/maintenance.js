export const MAINTENANCE_MESSAGE = "Platformamızın texniki infrastrukturunda aşkar edilmiş ciddi problemlər səbəbindən xidmətimiz müvəqqəti olaraq dayandırılıb. Xidmətin bərpası ilə bağlı yenilikləri sizinlə paylaşacağıq.";

const page = `<!doctype html>
<html lang="az">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Helmer xidmətində müvəqqəti fasilə / Temporary service interruption</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#10131a;color:#f4f6fa;font-family:system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:64px 32px}small{color:#a8b5cf;letter-spacing:.15em}header{margin-bottom:40px}h1{font-size:clamp(28px,5vw,42px);line-height:1.2;margin:16px 0}h2{font-size:14px;letter-spacing:.08em;color:#a8b5cf;margin:0 0 24px}p{line-height:1.8;color:#c6cedd;margin:0 0 20px}.languages{display:grid;grid-template-columns:1fr 1fr;gap:56px}a{color:#a9c8ff;text-underline-offset:4px;overflow-wrap:anywhere}a:focus-visible{outline:2px solid #a9c8ff;outline-offset:4px}@media(max-width:760px){main{padding:40px 24px}.languages{grid-template-columns:1fr;gap:32px}section+section{border-top:1px solid #303847;padding-top:32px}}
</style>
</head>
<body><main>
<header><small>HELMER</small><h1>Helmer xidmətində müvəqqəti fasilə</h1></header>
<div class="languages">
<section lang="az" aria-labelledby="az-title">
<h2 id="az-title">AZƏRBAYCANCA</h2>
<p><strong>Dəyərli istifadəçilərimiz,</strong></p>
<p>Helmer olaraq fəaliyyətə başladığımız gündən sizə sabit, etibarlı və təhlükəsiz xidmət göstərməyi əsas prioritetimiz hesab edirik.</p>
<p>Təəssüf ki, platformamızın texniki infrastrukturunda aşkar edilmiş ciddi problemlər səbəbindən xidmətimizi müvəqqəti olaraq dayandırmaq qərarına gəlmişik.</p>
<p>Hazırda komandamız problemlərin əsas səbəblərinin müəyyənləşdirilməsi, aradan qaldırılması və sistemin hərtərəfli yoxlanılması istiqamətində çalışır.</p>
<p>İstifadəçi təcrübəsi və xidmətin etibarlılığı bizim üçün kompromis mövzusu deyil. Bu səbəbdən platformanın sabit və təhlükəsiz fəaliyyətinə əmin olmadan xidməti yenidən aktivləşdirməyəcəyik.</p>
<p>Xidmətin bərpası ilə bağlı yenilikləri sizinlə paylaşacağıq.</p>
<p>Suallarınız üçün <a href="mailto:support@helmeros.com"><strong>support@helmeros.com</strong></a> ünvanına müraciət edə bilərsiniz.</p>
<p>Yaranmış narahatlığa görə üzr istəyir, səbriniz və bizə göstərdiyiniz etimad üçün təşəkkür edirik.</p>
</section>
<section lang="en" aria-labelledby="en-title">
<h2 id="en-title">ENGLISH</h2>
<p><strong>Dear users,</strong></p>
<p>Since launching Helmer, providing you with a stable, reliable, and secure service has been our top priority.</p>
<p>Unfortunately, we have decided to temporarily suspend our service due to serious issues identified in our platform’s technical infrastructure.</p>
<p>Our team is currently working to identify and resolve the root causes of these issues and thoroughly test the system.</p>
<p>We will not compromise on user experience or service reliability. For this reason, we will not reactivate the service until we are confident that the platform can operate stably and securely.</p>
<p>We will share updates with you about the restoration of service.</p>
<p>If you have any questions, please contact <a href="mailto:support@helmeros.com"><strong>support@helmeros.com</strong></a>.</p>
<p>We apologize for the inconvenience and thank you for your patience and the trust you place in us.</p>
</section>
</div>
</main></body></html>`;

// Maintenance is opt-in; ordinary startup serves the application.
export function maintenanceMiddleware(req, res, next) {
  if (process.env.MAINTENANCE_MODE !== "true") return next();
  // Infrastructure probes remain available; no application or admin bypass.
  if ((req.method === "GET" || req.method === "HEAD") && req.path === "/api/health") return next();
  res.set({ "Cache-Control": "no-store, max-age=0", "Retry-After": "3600", "X-Robots-Tag": "noindex" });
  if (/^\/(?:api|admin\/api)(?:\/|$)/i.test(req.path)) {
    return res.status(503).json({ error: MAINTENANCE_MESSAGE, code: "MAINTENANCE_MODE" });
  }
  return res.status(503).type("html").send(page);
}
