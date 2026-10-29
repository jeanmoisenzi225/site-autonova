// Construction du site : lit les contenus publiés depuis l'appli (écran
// « Mon site internet »), télécharge les photos, puis fabrique les pages
// dans dist/. Aucune dépendance : Node 20 ou plus.
//
//   node build.mjs            contenus publiés, posés sur les contenus du site
//   node build.mjs --exemple  contenus du site seuls (content.example.json), sans appel réseau
//
// Règle (décision du 2026-10-23) : les textes du site (content.example.json)
// sont la base. Ce qui est publié depuis l'appli ne remplace que les champs
// remplis : un texte vide, une photo absente ou une liste vide dans l'appli
// laissent le contenu du site tel quel.
import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const useExample = process.argv.includes("--exemple");

/* ---------- Réglages (assets/config.js) ---------- */
const configSource = await readFile(path.join(ROOT, "assets/config.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(configSource, sandbox);
const config = sandbox.window.SITE_CONFIG;
// SITE_API_URL : autre serveur (essais en local).
const apiUrl = process.env.SITE_API_URL || config.apiUrl;
const api = `${apiUrl.replace(/\/$/, "")}/api/public/garages/${encodeURIComponent(config.garageSlug)}`;

/* ---------- Contenus ---------- */
async function loadSite() {
  const example = JSON.parse(await readFile(path.join(ROOT, "content.example.json"), "utf8"));
  if (useExample) return { ...example, source: "exemple" };
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(`${api}/site`, { signal: AbortSignal.timeout(20_000) });
      break;
    } catch (err) {
      if (attempt === 3) throw new Error(`Appli injoignable (${err.message}) : construction annulée, le site en ligne reste inchangé.`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  if (res.status === 404) {
    console.warn("Rien n'est encore publié depuis l'appli : contenus d'exemple utilisés.");
    return { ...example, source: "exemple" };
  }
  if (!res.ok) throw new Error(`Réponse inattendue de l'appli (${res.status}) : construction annulée.`);
  const published = await res.json();
  return { ...published, content: overlay(example.content, published.content), source: "appli" };
}

// Pose les champs remplis de `published` sur `base`. Texte vide, null, false
// ou liste vide : la base est gardée. Une liste remplie remplace la liste
// entière (équipe, prestations, actualités, photos…).
function overlay(base, published) {
  if (Array.isArray(base) || Array.isArray(published)) {
    return Array.isArray(published) && published.length ? published : base;
  }
  if (base && typeof base === "object") {
    const out = { ...base };
    for (const key of Object.keys(published && typeof published === "object" ? published : {})) {
      out[key] = key in base ? overlay(base[key], published[key]) : published[key];
    }
    return out;
  }
  if (typeof published === "string") return published.trim() ? published : base;
  if (published === null || published === undefined || published === false) return base;
  return published;
}

/* ---------- Mini moteur de modèles (syntaxe Mustache) ----------
   {{nom}} texte échappé · {{#nom}}…{{/nom}} liste ou condition ·
   {{^nom}}…{{/nom}} si vide · {{> partie}} morceau commun de src/parts. */
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function lookup(stack, name) {
  if (name === ".") return stack[stack.length - 1];
  const [head, ...rest] = name.split(".");
  for (let i = stack.length - 1; i >= 0; i--) {
    const ctx = stack[i];
    if (ctx && typeof ctx === "object" && head in ctx) {
      return rest.reduce((v, key) => (v == null ? v : v[key]), ctx[head]);
    }
  }
  return undefined;
}

const isEmpty = (v) => v == null || v === false || v === "" || v === 0 || (Array.isArray(v) && v.length === 0);

function render(template, stack) {
  let out = "";
  let i = 0;
  const open = /\{\{([#^/]?)\s*([\w.]+)\s*\}\}/g;
  while (i < template.length) {
    open.lastIndex = i;
    const m = open.exec(template);
    if (!m) { out += template.slice(i); break; }
    out += template.slice(i, m.index);
    const [tag, kind, name] = m;
    i = m.index + tag.length;
    if (kind === "") { const v = lookup(stack, name); out += v == null ? "" : escapeHtml(v); continue; }
    if (kind === "/") throw new Error(`Balise fermante inattendue : ${tag}`);
    // Bloc : trouver la balise fermante correspondante (blocs imbriqués du même nom compris).
    let depth = 1, j = i, end = -1, endLen = 0;
    const inner = new RegExp(`\\{\\{([#^/])\\s*${name.replace(/\./g, "\\.")}\\s*\\}\\}`, "g");
    while (depth > 0) {
      inner.lastIndex = j;
      const n = inner.exec(template);
      if (!n) throw new Error(`Bloc non fermé : ${tag}`);
      depth += n[1] === "/" ? -1 : 1;
      j = n.index + n[0].length;
      if (depth === 0) { end = n.index; endLen = n[0].length; }
    }
    const body = template.slice(i, end);
    const value = lookup(stack, name);
    if (kind === "^") { if (isEmpty(value)) out += render(body, stack); }
    else if (Array.isArray(value)) value.forEach((item) => (out += render(body, [...stack, item])));
    else if (!isEmpty(value)) out += render(body, typeof value === "object" ? [...stack, value] : stack);
    i = end + endLen;
  }
  return out;
}

/* ---------- Préparation des données pour les pages ---------- */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const paragraphs = (text) => String(text || "").split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ text: t }));
const slugify = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "categorie";

async function downloadPhotos(ids) {
  await mkdir(path.join(DIST, "photos"), { recursive: true });
  const ok = new Set();
  for (const id of ids) {
    try {
      const res = await fetch(`${api}/site/photos/${id}.jpg`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(String(res.status));
      await writeFile(path.join(DIST, "photos", `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
      ok.add(id);
    } catch (err) {
      console.warn(`Photo ${id} non récupérée (${err.message}) : emplacement laissé vide.`);
    }
  }
  return ok;
}

function viewModel(site, photosOk) {
  const c = site.content;
  const photo = (id, alt = "") => (id && photosOk.has(id) ? { url: `photos/${id}.jpg`, alt } : null);
  const photos = (ids, alt) => (ids || []).map((id) => photo(id, alt)).filter(Boolean);
  const categories = (c.services.categories || []).filter((cat) => cat.name).map((cat) => ({
    ...cat,
    id: slugify(cat.name),
    photo: photo(cat.photo, cat.name),
    rows: (cat.rows || []).filter((r) => r.name),
    firstPrice: (cat.rows || []).map((r) => r.price).find(Boolean) || "",
  }));
  const news = [...(c.news || [])]
    .filter((n) => n.title)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((n) => {
      const [, m, d] = (n.date || "").split("-");
      return { ...n, day: d ? String(Number(d)) : "", month: m ? MONTHS[Number(m) - 1] : "", textParagraphs: paragraphs(n.text) };
    });
  const hidden = c.hidden || {};
  const r = site.reviews || {};
  const reviewItems = (r.items || []).filter((it) => it.comment).map((it) => ({ ...it, stars: "★".repeat(it.rating) + "☆".repeat(5 - it.rating) }));
  return {
    garageName: site.garage?.name || "",
    appName: site.garage?.appName || "",
    footerTagline: c.footer?.tagline || "",
    home: {
      ...c.home,
      heroPhoto: photos(c.home.heroPhotos, "L'atelier")[0] || null,
      welcomeParagraphs: paragraphs(c.home.welcomeText),
      welcomePhotos: photos(c.home.welcomePhotos, ""),
    },
    garage: {
      ...c.garage,
      historyParagraphs: paragraphs(c.garage.historyText),
      historyPhoto: photo(c.garage.historyPhoto, "Le garage"),
      figures: (c.garage.figures || []).filter((f) => f.label && f.value),
      team: (c.garage.team || []).filter((t) => t.name).map((t) => ({ ...t, photo: photo(t.photo, t.name) })),
      equipment: (c.garage.equipment || []).filter(Boolean).map((text) => ({ text })),
      gallery: photos(c.garage.gallery, "L'atelier").map((p, i) => ({ ...p, wide: i === 0 })),
    },
    // Notre histoire (2026-10-29) : photo du récit, à défaut celle de
    // l'histoire de la page « Le garage ».
    history: {
      ...c.history,
      storyParagraphs: paragraphs(c.history.storyText),
      photo: photo(c.history.photo || c.garage.historyPhoto, `L'histoire de ${site.garage?.name || "du garage"}`),
      timeline: (c.history.timeline || []).filter((t) => t.title || t.period).map((t) => ({ ...t, textParagraphs: paragraphs(t.text), photo: photo(t.photo, t.title) })),
      founderPhoto: photo(c.history.founderPhoto, c.history.founderName),
      founderQuoteParagraphs: paragraphs(c.history.founderQuote),
    },
    services: { intro: c.services.intro, categories },
    jobs: {
      intro: c.jobs.intro,
      openings: (c.jobs.openings || []).filter((o) => o.title).map((o) => ({ ...o, tags: [o.contract, o.level].filter(Boolean).map((text) => ({ text })) })),
      perks: (c.jobs.perks || []).filter((p) => p.title),
    },
    news,
    // Rubriques affichées : masquées depuis l'appli (« Afficher sur le site »).
    show: {
      homeWelcome: !hidden.homeWelcome,
      homeServices: !hidden.homeServices && categories.length > 0,
      homeNews: !hidden.homeNews && news.length > 0,
      garageHistory: !hidden.garageHistory && Boolean(c.garage.historyTitle),
      garageTeam: !hidden.garageTeam,
      garageWorkshop: !hidden.garageWorkshop,
      garagePromises: !hidden.garagePromises,
      jobsOpenings: !hidden.jobsOpenings,
      jobsPerks: !hidden.jobsPerks,
      historyTimeline: !hidden.historyTimeline && (c.history.timeline || []).some((t) => t.title || t.period),
      historyFounder: !hidden.historyFounder && Boolean(c.history.founderName),
    },
    reviews: !hidden.homeReviews && r.show && (r.count || reviewItems.length)
      ? { average: r.average != null ? String(r.average).replace(".", ",") : "", count: r.count, items: reviewItems }
      : null,
  };
}

/* ---------- Construction ---------- */
const site = await loadSite();
const content = site.content;
// Non-indexation (et emplacements de photos marqués) tant qu'il reste des
// textes à compléter entre crochets (ex. « [Prénom Nom] »). Le bandeau
// « Site en préparation » a été retiré le 2026-10-29 à la demande du garage.
const stillDraft = /\[[^\]\n]{2,}\]/.test(JSON.stringify(content));
const photoIds = [
  ...content.home.heroPhotos, ...content.home.welcomePhotos, content.garage.historyPhoto,
  ...content.garage.team.map((t) => t.photo), ...content.garage.gallery, ...content.services.categories.map((c) => c.photo),
  content.history.photo, content.history.founderPhoto, ...content.history.timeline.map((t) => t.photo),
].filter(Boolean);

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
const photosOk = site.source === "appli" ? await downloadPhotos([...new Set(photoIds)]) : new Set();
const view = viewModel(site, photosOk);

// Coordonnées : reprises dans assets/config.js, lu par les pages.
await cp(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
const contact = content.contact || {};
const runtimeConfig = { ...config, phone: contact.phone || "", whatsapp: contact.whatsapp || "", email: contact.email || "", address: contact.address || "", mapUrl: contact.mapUrl || "" };
await writeFile(path.join(DIST, "assets/config.js"), `window.SITE_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};\n`);

const parts = {};
for (const file of await readdir(path.join(SRC, "parts"))) parts[file.replace(/\.html$/, "")] = await readFile(path.join(SRC, "parts", file), "utf8");
const PAGES = {
  "index.html": { nav: "home", title: `${view.garageName} · Garage automobile`, description: content.home.intro || content.home.title },
  "garage.html": { nav: "garage", title: `Le garage · ${view.garageName}`, description: content.garage.intro },
  "histoire.html": { nav: "history", title: `Notre histoire · ${view.garageName}`, description: content.history.intro || content.history.storyTitle },
  "prestations.html": { nav: "services", title: `Prestations et tarifs · ${view.garageName}`, description: content.services.intro },
  "recrutement.html": { nav: "jobs", title: `Recrutement · ${view.garageName}`, description: content.jobs.intro },
  "contact.html": { nav: "contact", title: `Contact · ${view.garageName}`, description: `Contacter ${view.garageName} : téléphone, WhatsApp, adresse, horaires, ou demande de rappel.` },
  "mentions-legales.html": { nav: "", title: `Mentions légales · ${view.garageName}`, description: `Mentions légales du site de ${view.garageName}.` },
  "confidentialite.html": { nav: "", title: `Politique de confidentialité · ${view.garageName}`, description: `Comment ${view.garageName} utilise les informations envoyées par le formulaire de son site.` },
};
for (const [file, meta] of Object.entries(PAGES)) {
  let template = await readFile(path.join(SRC, file), "utf8");
  template = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => parts[name] ?? "");
  const page = { ...meta, nav: { [meta.nav]: true }, draft: stillDraft };
  await writeFile(path.join(DIST, file), render(template, [view, { page }]));
}
// Contenus actuellement en ligne, lus par l'écran « Mon site internet » de
// l'appli (aperçu et texte actuel des champs laissés vides).
await writeFile(path.join(DIST, "contenus.json"), JSON.stringify(content));
console.log(`Site construit dans dist/ (${Object.keys(PAGES).length} pages, ${photosOk.size} photos, contenus : ${site.source}).`);
