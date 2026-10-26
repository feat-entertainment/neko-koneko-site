import { test } from "node:test";
import assert from "node:assert/strict";
import { html, raw } from "../src/html.mjs";
import { newsItems, renderSite } from "../src/render.mjs";
import { hasForbiddenWord, sha256 } from "../src/forbidden.mjs";
import { emptyFixture, fixture } from "./fixture.mjs";

const TODAY = "2026-10-12"; // 感情コピーは配信中、404 Humanity は未リリース
const render = (f = fixture(), today = TODAY) => renderSite({ ...f, today });

test("html は値をエスケープし raw はそのまま", () => {
  assert.equal(String(html`<p title="${'"<x>'}">${raw("<b>ok</b>")}</p>`), '<p title="&quot;&lt;x&gt;">' + "<b>ok</b></p>");
});

test("言語ごとにトップ + 曲ごとのシェア用ページを出力し、404 は直下に 1 つ", () => {
  const perLang = ["index.html", "releases/404-humanity/index.html", "releases/cached-emotion/index.html"];
  const expected = ["404.html", ...["", "en/", "pt/", "zh/", "ko/"].flatMap((d) => perLang.map((f) => d + f))];
  assert.deepEqual(Object.keys(render()).sort(), expected.sort());
});

test("トップに Discography・News・Contact のセクションがある", () => {
  const top = render()["index.html"];
  for (const id of ["discography", "news", "contact"]) assert.match(top, new RegExp(`<section[^>]* id="${id}"`));
  assert.match(top, /href="mailto:info@label.example"/);
});

test("配信中の曲カードは配信ボタンと is-released を持つ", () => {
  const top = render()["index.html"];
  assert.match(top, /<li class="card is-released" data-release-date="2026-10-09" id="cached-emotion">[\s\S]*?open.spotify.com\/album\/7pmF8zRKoF6kwvv532XTwC[\s\S]*?<\/li>/);
});

test("未リリースの曲カードは Coming Soon とカウントダウン", () => {
  const top = render()["index.html"];
  assert.match(top, /<li class="card" data-release-date="2026-10-30" id="404-humanity">[\s\S]*?Coming Soon[\s\S]*?data-countdown="2026-10-30"[\s\S]*?<\/li>/);
});

test("曲ページ(SNS 告知用)は曲の OGP を持ち、トップへ自動で戻らない", () => {
  const page = render()["releases/cached-emotion/index.html"];
  assert.match(page, /<meta property="og:image" content="https:\/\/neko-koneko.example\/assets\/artwork\/cached-emotion.jpg">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/neko-koneko.example\/releases\/cached-emotion\/">/);
  assert.match(page, /<title>感情コピー \| NEKO KONEKO<\/title>/);
  assert.doesNotMatch(page, /http-equiv="refresh"/);
});

test("曲ページはジャケット・タイトル・配信ボタン・X でシェア・戻るリンクを持つ", () => {
  const page = render()["releases/cached-emotion/index.html"];
  assert.match(page, /<article class="hero release is-released" data-release-date="2026-10-09">/);
  assert.match(page, /<img class="hero-art" src="\/assets\/artwork\/cached-emotion.jpg"/);
  assert.match(page, /<h1[^>]*>感情コピー<\/h1>/);
  assert.match(page, /href="https:\/\/open.spotify.com\/album\/7pmF8zRKoF6kwvv532XTwC"/);
  const share = page.match(/href="(https:\/\/x\.com\/intent\/post\?[^"]+)"/);
  assert.ok(share, "X でシェアのリンクが無い");
  const params = new URL(share[1].replaceAll("&amp;", "&")).searchParams;
  assert.equal(params.get("url"), "https://neko-koneko.example/releases/cached-emotion/");
  assert.match(params.get("text"), /感情コピー/);
  assert.match(page, /href="\/#discography"/);
});

test("未リリースの曲ページは Coming Soon とカウントダウン", () => {
  const page = render()["releases/404-humanity/index.html"];
  assert.match(page, /<article class="hero release" data-release-date="2026-10-30">/);
  assert.match(page, /Coming Soon[\s\S]*data-countdown="2026-10-30"/);
});

test("Discography のジャケットは曲ページへのリンク", () => {
  const top = render()["index.html"];
  assert.match(top, /<li class="card[^"]*"[^>]*id="cached-emotion">\s*<a class="card-art" href="\/releases\/cached-emotion\/"><img /);
});

test("AI 制作の公言は全ページにあり、ツール名・非公開情報は出ない", () => {
  const f = fixture();
  for (const [file, page] of Object.entries(render(f))) {
    assert.ok(page.includes(f.profile.aiNotice), `${file} に AI 公言がない`);
    assert.equal(hasForbiddenWord(page), false, `${file} に公開禁止語がある`);
  }
});

test("hasForbiddenWord は語単位・大小文字無視で照合する", () => {
  const hashes = new Set([sha256("secretword")]);
  assert.equal(hasForbiddenWord("<p>Made with SecretWord.</p>", hashes), true);
  assert.equal(hasForbiddenWord("<p>secretwords</p>", hashes), false);
  assert.equal(hasForbiddenWord("<p>nothing here</p>", hashes), false);
});

test("ロゴ設定時もヘッダーにアーティスト名が出る", () => {
  const page = render()["index.html"];
  assert.match(page, /<img src="\/[^"]+" alt="" width="36" height="36">/);
  assert.match(page, /class="brand"[^>]*>.*NEKO KONEKO/s);
});

test("X へのリンクが全ページにある", () => {
  for (const page of Object.values(render())) assert.match(page, /href="https:\/\/x.com\/neko_example"/);
});

test("内部リンクはすべて出力ページ・assets・トップのセクションを指す", () => {
  const pages = render();
  const exists = (href) => {
    const [p, frag] = href.replace(/^\//, "").split("#");
    if (frag) return (p === "" || p.endsWith("/")) && (pages[`${p}index.html`] ?? "").includes(`id="${frag}"`);
    return p === "" || p in pages || `${p}index.html` in pages || /^(assets\/|styles\.css(\?v=\w+)?$|main\.js(\?v=\w+)?$)/.test(p);
  };
  for (const [file, page] of Object.entries(pages)) {
    for (const [, href] of page.matchAll(/(?:href|src)="(\/[^"]*)"/g)) assert.ok(exists(href), `${file}: ${href}`);
  }
});

test("タイトルの HTML はエスケープされる", () => {
  const f = fixture();
  f.site.releases[0].title = "<script>x</script>";
  for (const page of Object.values(render(f))) assert.doesNotMatch(page, /<script>x/);
});

test("newsItems は配信済みリリースを自動追加し、未来の記事は出さない", () => {
  const f = fixture();
  f.news.push({ date: "2026-12-01", title: "未来の記事" });
  const items = newsItems(f.site, f.news, TODAY);
  assert.deepEqual(items.map((n) => n.date), ["2026-10-09", "2026-10-01"]);
  assert.equal(items[0].url, "/#cached-emotion");
});

test("ヒーローは最新の配信中リリース、無ければ最も近い未リリース", () => {
  assert.match(render()["index.html"], /class="hero is-released"[^>]*>[\s\S]*?感情コピー/);
  const f = fixture();
  f.site.releases[0].releaseDate = "2026-11-01";
  assert.match(render(f)["index.html"], /class="hero"[^>]*>[\s\S]*?404 Humanity/);
});

test("アーティストページのリンクを紹介欄とフッターに出す", () => {
  const top = render()["index.html"];
  const hits = top.match(/href="https:\/\/music.amazon.co.jp\/artists\/B0BPNDZ311"/g) ?? [];
  assert.equal(hits.length, 2);
  const f = fixture();
  delete f.profile.artistLinks;
  assert.doesNotMatch(render(f)["index.html"], /amazon/);
});

test("各リンクにアイコンが付く(ブランドに無いものは音符)", () => {
  const top = render()["index.html"];
  const iconOf = (re) => {
    const m = top.match(re);
    assert.ok(m, `リンクが無い: ${re}`);
    return m[0];
  };
  const svg = /<svg class="icon"[^>]*aria-hidden="true"[^>]*><path d="([^"]+)"\/><\/svg>/;
  const spotify = iconOf(/<a class="btn" href="https:\/\/open.spotify.com[^"]*"[^>]*>[\s\S]*?<\/a>/);
  const amazon = iconOf(/<a class="btn" href="https:\/\/music.amazon.co.jp[^"]*"[^>]*>[\s\S]*?<\/a>/);
  const mail = iconOf(/<a class="btn btn-primary" href="mailto:[^"]*"[^>]*>[\s\S]*?<\/a>/);
  const x = iconOf(/<a class="btn" href="https:\/\/x.com\/neko_example"[^>]*>[\s\S]*?<\/a>/);
  for (const a of [spotify, amazon, mail, x]) assert.match(a, svg);
  const paths = [spotify, amazon, mail, x].map((a) => a.match(svg)[1]);
  assert.equal(new Set(paths).size, 4, "アイコンがサービスごとに違う");
  assert.match(spotify, /Spotify<\/a>$/);
});

test("アーティスト紹介に顔(ロゴ)・名前・プロフィール文を出す", () => {
  const top = render()["index.html"];
  assert.match(top, /<section class="artist" id="artist">[\s\S]*?<img class="artist-face" src="\/assets\/logo.png"[\s\S]*?NEKO KONEKO[\s\S]*?テスト用のプロフィール文[\s\S]*?<\/section>/);
});

test("まだ決まっていない情報(X・連絡先・HP の URL・リリース)は出さず、壊れない", () => {
  const pages = render(emptyFixture());
  assert.deepEqual(Object.keys(pages).sort(), ["404.html", "en/index.html", "index.html", "ko/index.html", "pt/index.html", "zh/index.html"]);
  for (const [file, page] of Object.entries(pages)) {
    assert.doesNotMatch(page, /x\.com/, `${file} に X のリンクがある`);
    assert.doesNotMatch(page, /mailto:/, `${file} に mailto がある`);
    assert.doesNotMatch(page, /property="og:url"/, `${file} に og:url がある`);
    assert.doesNotMatch(page, /property="og:image" content="(?!https:)/, `${file} の og:image が絶対 URL でない`);
    assert.doesNotMatch(page, /undefined|null/, `${file} に undefined/null が出ている`);
  }
  const top = pages["index.html"];
  assert.doesNotMatch(top, /id="contact"/);
  assert.doesNotMatch(top, /href="\/#contact"/);
  assert.match(top, /id="discography"[\s\S]*?class="muted"/);
  assert.match(top, /<section class="artist" id="artist">[\s\S]*?NEKO KONEKO/);
  assert.match(top, /© \d{4} NEKO KONEKO/);
});

test("HP の URL が未定なら、曲ページでも大きい画像のカード指定にしない(画像の絶対 URL が無いため)", () => {
  const f = fixture();
  f.profile.siteUrl = "";
  const page = render(f)["releases/cached-emotion/index.html"];
  assert.doesNotMatch(page, /property="og:image"/);
  assert.match(page, /<meta name="twitter:card" content="summary">/);
  assert.match(render()["releases/cached-emotion/index.html"], /<meta name="twitter:card" content="summary_large_image">/);
});

test("AI の英文(aiNotice)が空なら、どのページにも出さず説明文はサイト名にする", () => {
  const f = fixture();
  f.profile.aiNotice = "";
  for (const [file, page] of Object.entries(render(f))) {
    assert.doesNotMatch(page, /class="ai-notice/, `${file} に AI の英文の欄がある`);
    assert.doesNotMatch(page, /generated using AI/, `${file} に AI の英文がある`);
    assert.doesNotMatch(page, /content=""/, `${file} に空の meta がある`);
  }
  assert.match(render(f)["index.html"], /<meta name="description" content="NEKO KONEKO Official Site">/);
});

test("各言語のページは html の lang・言語の切り替え(同じページの 5 言語)・hreflang を持つ", () => {
  const pages = render();
  const langs = [["", "ja"], ["en/", "en"], ["pt/", "pt-BR"], ["zh/", "zh-Hans"], ["ko/", "ko"]];
  for (const [dir, lang] of langs) {
    for (const rest of ["", "releases/cached-emotion/"]) {
      const page = pages[`${dir}${rest}index.html`];
      assert.match(page, new RegExp(`<html lang="${lang}">`));
      const sw = page.match(/<nav class="lang-switch"[^>]*>([\s\S]*?)<\/nav>/);
      assert.ok(sw, `${dir}${rest} に言語の切り替えが無い`);
      assert.match(page, /<details class="lang-menu"><summary aria-label="[^"]+">[\s\S]*?<\/summary><nav class="lang-switch"/, `${dir}${rest} の言語の切り替えがプルダウンになっていない`);
      for (const [d] of langs) assert.ok(sw[1].includes(`href="/${d}${rest}"`), `${dir}${rest} → /${d}${rest} が無い`);
      assert.match(sw[1], new RegExp(`href="/${dir}${rest}"[^>]*aria-current="page"`));
      for (const [d, l] of langs) {
        assert.ok(page.includes(`<link rel="alternate" hreflang="${l}" href="https://neko-koneko.example/${d}${rest}">`), `${dir}${rest} に hreflang ${l} が無い`);
      }
      assert.ok(page.includes(`<link rel="alternate" hreflang="x-default" href="https://neko-koneko.example/${rest}">`));
    }
  }
});

test("各言語のページは、その言語の文とリンク先を使う", () => {
  const pages = render(emptyFixture());
  assert.match(pages["index.html"], /配信日が決まった曲から/);
  assert.match(pages["en/index.html"], /Songs will appear here once their release dates are set\./);
  assert.match(pages["pt/index.html"], /Ainda não há novidades\./);
  assert.match(pages["zh/index.html"], /暂无消息。/);
  assert.match(pages["ko/index.html"], /아직 소식이 없습니다\./);
  const ko = render()["ko/index.html"];
  assert.match(ko, /href="\/ko\/#discography"/);
  assert.match(ko, /<a class="card-art" href="\/ko\/releases\/cached-emotion\/">/);
  assert.match(ko, /공개 예정/);
  assert.match(render()["en/releases/cached-emotion/index.html"], /href="\/en\/#discography"/);
});

test("プロフィール文とお知らせは言語ごとに書け、無い言語は日本語を出す", () => {
  const f = fixture();
  f.profile.profile = { ja: "日本語のプロフィール", en: "English profile" };
  f.news = [{ date: "2026-10-01", title: { ja: "日本語のお知らせ", en: "English news" } }];
  const pages = render(f);
  assert.match(pages["en/index.html"], /English profile/);
  assert.match(pages["en/index.html"], /English news/);
  assert.match(pages["pt/index.html"], /日本語のプロフィール/);
  assert.match(pages["pt/index.html"], /日本語のお知らせ/);
  assert.match(pages["index.html"], /日本語のプロフィール/);
});
