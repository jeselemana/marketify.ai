export function createRequireAdmin(adminIdentities = new Set()) {
  const allowed = adminIdentities instanceof Set ? adminIdentities : new Set(adminIdentities);
  return function requireAdmin(req, res, next) {
    const username = req.user?.username?.toLowerCase() || "";
    const email = req.user?.email?.toLowerCase() || "";
    if (req.user && (allowed.has(username) || allowed.has(email))) return next();
    if (req.accepts?.("html") && req.method === "GET") return res.redirect("/?auth=login&next=/admin");
    return res.status(404).json({ error: "Yol tapılmadı.", code: "NOT_FOUND" });
  };
}
