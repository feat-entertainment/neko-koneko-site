// サイトの HTML を生成する(純粋関数)。戻り値は { 出力相対パス: HTML }。
// 本体は index.html の 1 ページ。releases/<slug>/ は曲ごとの SNS 告知用ページ(曲の OGP 付き)で、Discography のジャケットから開く。
// 言語ごとに同じ構成のページを出す(日本語は直下、他は en/ などの下。i18n.mjs)。404 は直下に 1 つだけ
import { isReleased } from "./data.mjs";
import { DEFAULT_LANG, LANGS, langPath, pick, t } from "./i18n.mjs";
import { html, raw } from "./html.mjs";
import { icon, platformIcon } from "./icons.mjs";

const fmtDate = (d) => d.replaceAll("-", ".");
const releaseRest = (r) => `releases/${r.slug}/`;
const xShareUrl = (text, url) => `https://x.com/intent/post?${new URLSearchParams(url ? { text, url } : { text })}`;
const byDateDesc = (a, b) => (a.date ?? a.releaseDate) < (b.date ?? b.releaseDate) ? 1 : (a.date ?? a.releaseDate) > (b.date ?? b.releaseDate) ? -1 : 0;
const ext = (href, label, cls = "", iconName = null) =>
  html`<a class="${cls}" href="${href}" target="_blank" rel="noopener">${iconName ? icon(iconName) : ""}${label}</a>`;
const xHandle = (url) => `@${url.replace(/\/+$/, "").split("/").pop()}`;
/** 未定(空)の項目は出さないためのヘルパー */
const xLink = (profile, label, cls = "") => (profile.x ? ext(profile.x, label ?? `X ${xHandle(profile.x)}`, cls, "x") : "");
const hasContact = (profile) => Boolean(profile.contactEmail || profile.companyUrl);
const absUrl = (profile, p) => (profile.siteUrl ? `${profile.siteUrl}${p}` : null);
/** 配信サービスのアーティストページ(profile.json の artistLinks。無ければ空) */
const artistLinkButtons = (profile) => (profile.artistLinks ?? []).map((l) => html` ${ext(l.url, l.platform, "btn", platformIcon(l.platform))}`);

/** 言語の切り替え: 今のページの各言語版へのリンク */
function langSwitch(lang, rest) {
  return html`<nav class="lang-switch" aria-label="${t(lang).languageMenu}">${LANGS.map((l) =>
    l.code === lang.code
      ? html`<a href="${langPath(l, rest)}" lang="${l.hreflang}" aria-current="page">${l.label}</a>`
      : html`<a href="${langPath(l, rest)}" lang="${l.hreflang}" hreflang="${l.hreflang}">${l.label}</a>`,
  )}</nav>`;
}

/** rest: 言語フォルダより下の相対パス(トップは "")。null なら言語の切り替え・hreflang を出さない(404) */
function layout(ctx, { rest, title, description, image, body }) {
  const { site, profile, lang } = ctx;
  const tr = t(lang);
  const name = site.artist.name;
  const fullTitle = title ? `${title} | ${name}` : tr.siteTitle(name);
  const desc = description ?? (profile.aiNotice || tr.siteTitle(name));
  const img = image ?? site.artist.logo;
  const ogImage = img ? absUrl(profile, `/${img}`) : null;
  const path = rest == null ? "/404.html" : langPath(lang, rest);
  const ogUrl = absUrl(profile, path);
  const top = langPath(lang);
  return String(html`<!doctype html>
<html lang="${lang.hreflang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0607">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="${rest === "" ? "website" : "article"}">
<meta property="og:locale" content="${lang.ogLocale}">
<meta property="og:site_name" content="${name} Official Site">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
${ogUrl ? html`<meta property="og:url" content="${ogUrl}">` : ""}
${ogImage ? html`<meta property="og:image" content="${ogImage}">` : ""}
<meta name="twitter:card" content="${image && ogImage ? "summary_large_image" : "summary"}">
${rest != null && profile.siteUrl ? [...LANGS.map((l) => html`<link rel="alternate" hreflang="${l.hreflang}" href="${absUrl(profile, langPath(l, rest))}">
`), html`<link rel="alternate" hreflang="x-default" href="${absUrl(profile, langPath(DEFAULT_LANG, rest))}">`] : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@400;700&display=swap">
<link rel="stylesheet" href="${ctx.assetUrls?.css ?? "/styles.css"}">
<script src="${ctx.assetUrls?.js ?? "/main.js"}" defer></script>
</head>
<body>
<header class="site-header">
  <a class="brand" href="${top}">${site.artist.logo ? html`<img src="/${site.artist.logo}" alt="" width="36" height="36">` : ""}<span class="brand-name">${name}</span></a>
  <nav class="nav">
    <a href="${top}#discography">Discography</a>
    <a href="${top}#news">News</a>
    ${hasContact(profile) ? html`<a href="${top}#contact">Contact</a>` : ""}
    ${xLink(profile, "X", "nav-x")}
  </nav>
  ${rest != null ? langSwitch(lang, rest) : ""}
</header>
<main class="main">
${body}
</main>
<footer class="site-footer">
  ${profile.aiNotice ? html`<p class="ai-notice" lang="en">${profile.aiNotice}</p>` : ""}
  <p class="footer-links">${[xLink(profile), ...(profile.artistLinks ?? []).map((l) => ext(l.url, l.platform, "", platformIcon(l.platform)))].filter(Boolean).map((a, i) => (i ? html` · ${a}` : a))}</p>
  <p class="copyright">© ${ctx.today.slice(0, 4)} ${profile.label || name}</p>
</footer>
</body>
</html>
`);
}

function linkList(r, tr) {
  if (r.links.length) return html`<ul class="links">${r.links.map((l) => html`<li>${ext(l.url, l.platform, "btn", platformIcon(l.platform))}</li>`)}</ul>`;
  if (r.preSaveUrl) return html`<ul class="links"><li>${ext(r.preSaveUrl, tr.listen, "btn btn-primary", "note")}</li></ul>`;
  return "";
}

function stateAttrs(r, today) {
  return raw(`class="%CLS%${isReleased(r, today) ? " is-released" : ""}" data-release-date="${r.releaseDate}"`);
}
const withClass = (attrs, cls) => raw(String(attrs).replace("%CLS%", cls));

function upcomingBlock(r, tr) {
  return html`<div class="when-upcoming">
  <p class="badge">${tr.comingSoon}</p>
  <p class="countdown" data-countdown="${r.releaseDate}"></p>
  ${r.preSaveUrl ? html`<p>${ext(r.preSaveUrl, tr.preSave, "btn btn-primary", "note")}</p>` : ""}
</div>`;
}

function card(r, today, lang) {
  const tr = t(lang);
  return html`<li ${withClass(stateAttrs(r, today), "card")} id="${r.slug}">
  <a class="card-art" href="${langPath(lang, releaseRest(r))}"><img src="/${r.artwork}" alt="${r.title}" loading="lazy" width="600" height="600"></a>
  <span class="card-title">${r.title}</span>
  ${r.titleEn && r.titleEn !== r.title ? html`<span class="card-title-en" lang="en">${r.titleEn}</span>` : ""}
  <span class="card-meta">${r.type} · ${fmtDate(r.releaseDate)}</span>
  ${upcomingBlock(r, tr)}
  <div class="when-released">${linkList(r, tr)}</div>
</li>`;
}

export function newsItems(site, news, today, lang = DEFAULT_LANG) {
  const auto = site.releases
    .filter((r) => isReleased(r, today))
    .map((r) => ({ date: r.releaseDate, title: t(lang).released(r.type, r.title), url: `${langPath(lang)}#${r.slug}` }));
  const manual = news.filter((n) => n.date <= today).map((n) => ({ ...n, title: pick(n.title, lang), body: n.body == null ? n.body : pick(n.body, lang) }));
  return [...auto, ...manual].sort(byDateDesc);
}

function newsList(items) {
  return html`<ul class="news">${items.map((n) => html`<li>
  <time datetime="${n.date}">${fmtDate(n.date)}</time>
  <div>${n.url ? html`<a href="${n.url}">${n.title}</a>` : n.title}${n.body ? html`<p>${n.body}</p>` : ""}</div>
</li>`)}</ul>`;
}

/** アーティスト紹介: 顔(ロゴ)・名前・プロフィール文(未定なら名前と顔だけ) */
function artistSection(ctx) {
  const { site, profile, lang } = ctx;
  const text = pick(profile.profile, lang);
  return html`<section class="artist" id="artist">
  ${site.artist.logo ? html`<img class="artist-face" src="/${site.artist.logo}" alt="${site.artist.name}" width="400" height="400">` : ""}
  <div class="artist-info">
    <h2 class="artist-name">${site.artist.name}</h2>
    ${site.artist.reading ? html`<p class="artist-reading">${site.artist.reading}</p>` : ""}
    ${text ? html`<p class="artist-profile">${text}</p>` : ""}
  </div>
</section>`;
}

function homePage(ctx) {
  const { site, today, profile, lang } = ctx;
  const tr = t(lang);
  const sorted = [...site.releases].sort(byDateDesc);
  const hero = sorted.find((r) => isReleased(r, today)) ?? sorted.at(-1);
  const news = newsItems(site, ctx.news, today, lang);
  const body = html`
${hero ? html`<section ${withClass(stateAttrs(hero, today), "hero")} id="top">
  <img class="hero-art" src="/${hero.artwork}" alt="${hero.title}" width="1200" height="1200">
  <div class="hero-info">
    <p class="eyebrow"><span class="when-released">${tr.latest}</span><span class="when-upcoming">${tr.comingSoon}</span></p>
    <h1 class="title">${hero.title}</h1>
    <p class="release-date">${hero.type} · ${fmtDate(hero.releaseDate)}</p>
    ${upcomingBlock(hero, tr)}
    <div class="when-released">${linkList(hero, tr)}</div>
  </div>
</section>` : ""}
${artistSection(ctx)}
${profile.aiNotice || profile.x || profile.artistLinks?.length ? html`<section class="intro">
  ${profile.aiNotice ? html`<p class="ai-notice" lang="en">${profile.aiNotice}</p>` : ""}
  ${profile.x || profile.artistLinks?.length ? html`<p class="intro-links">${xLink(profile, profile.x ? tr.followOnX(xHandle(profile.x)) : "", "btn")}${artistLinkButtons(profile)}</p>` : ""}
</section>` : ""}
<section class="section" id="discography">
  <h2 class="section-title">Discography</h2>
  ${sorted.length ? html`<ul class="cards">${sorted.map((r) => card(r, today, lang))}</ul>` : html`<p class="muted">${tr.emptyDiscography}</p>`}
</section>
<section class="section" id="news">
  <h2 class="section-title">News</h2>
  ${news.length ? newsList(news) : html`<p class="muted">${tr.emptyNews}</p>`}
</section>
${hasContact(profile) ? html`<section class="section contact" id="contact">
  <h2 class="section-title">Contact</h2>
  <p>${tr.contact(profile.label)}</p>
  ${profile.contactEmail ? html`<p><a class="btn btn-primary" href="mailto:${profile.contactEmail}">${icon("mail")}${profile.contactEmail}</a></p>` : ""}
  <p>${profile.companyUrl ? ext(profile.companyUrl, tr.website(profile.label || "Label"), "btn", "globe") : ""} ${xLink(profile, undefined, "btn")}</p>
</section>` : ""}`;
  return layout(ctx, { rest: "", body });
}

/** 曲ごとの SNS 告知用ページ: 曲の OGP を持ち、ジャケット・配信ボタン・X でシェアを出す */
function releasePage(ctx, r) {
  const { site, profile, today, lang } = ctx;
  const tr = t(lang);
  const pageUrl = absUrl(profile, langPath(lang, releaseRest(r)));
  const shareText = tr.shareText(site.artist.name, r.title, fmtDate(r.releaseDate));
  const body = html`<article ${withClass(stateAttrs(r, today), "hero release")}>
  <img class="hero-art" src="/${r.artwork}" alt="${r.title}" width="1200" height="1200">
  <div class="hero-info">
    <p class="eyebrow">${r.type}</p>
    <h1 class="title">${r.title}</h1>
    ${r.titleEn && r.titleEn !== r.title ? html`<p class="title-en" lang="en">${r.titleEn}</p>` : ""}
    <p class="release-date">${tr.releaseOn(fmtDate(r.releaseDate))}</p>
    ${upcomingBlock(r, tr)}
    <div class="when-released">${linkList(r, tr)}</div>
    <p>${ext(xShareUrl(shareText, pageUrl), tr.shareOnX, "btn", "x")}</p>
    ${profile.aiNotice ? html`<p class="ai-notice small" lang="en">${profile.aiNotice}</p>` : ""}
    <p><a class="back" href="${langPath(lang)}#discography">← Discography</a></p>
  </div>
</article>`;
  return layout(ctx, { rest: releaseRest(r), title: r.title, description: shareText, image: r.artwork, body });
}

function notFoundPage(ctx) {
  const body = html`<section class="not-found">
  <h1 class="title">404</h1>
  <p>ページが見つかりません。<br><span lang="en">Page not found.</span></p>
  <p><a class="btn" href="/">Top</a></p>
</section>`;
  return layout(ctx, { rest: null, title: "Not Found", body });
}

export function renderSite(ctx) {
  const pages = { "404.html": notFoundPage({ ...ctx, lang: DEFAULT_LANG }) };
  for (const lang of LANGS) {
    const c = { ...ctx, lang };
    pages[`${lang.dir}index.html`] = homePage(c);
    for (const r of ctx.site.releases) pages[`${lang.dir}${releaseRest(r)}index.html`] = releasePage(c, r);
  }
  return pages;
}
