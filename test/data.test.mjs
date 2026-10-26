import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { isReleased, jstToday, loadData, validateNews, validateProfile, validateSite } from "../src/data.mjs";
import { fixture, writeFixtureRoot } from "./fixture.mjs";

test("jstToday は日本時間の日付", () => {
  // UTC 10/02 16:00 = JST 10/03 01:00
  assert.equal(jstToday(new Date("2026-10-02T16:00:00Z")), "2026-10-03");
});

test("isReleased はリリース日当日から true", () => {
  assert.equal(isReleased({ releaseDate: "2026-10-30" }, "2026-10-29"), false);
  assert.equal(isReleased({ releaseDate: "2026-10-30" }, "2026-10-30"), true);
});

test("正しいデータはそのまま通る", () => {
  const f = fixture();
  assert.equal(validateSite(f.site), f.site);
  assert.equal(validateNews(f.news), f.news);
  assert.equal(validateProfile(f.profile), f.profile);
});

test("site.json の不正は場所と項目名つきで失敗", () => {
  const bad = (mutate, re) => {
    const f = fixture();
    mutate(f.site);
    assert.throws(() => validateSite(f.site), re);
  };
  bad((s) => { delete s.releases[0].title; }, /releases\[0\]: title/);
  bad((s) => { s.releases[0].slug = "感情"; }, /slug が不正/);
  bad((s) => { s.releases[1].slug = "cached-emotion"; }, /slug が重複/);
  bad((s) => { s.releases[0].releaseDate = "2026/10/09"; }, /releaseDate が不正/);
  bad((s) => { s.releases[0].type = "Mixtape"; }, /type が不正/);
  bad((s) => { s.releases[0].links[0].url = "http://x"; }, /links\[0\]/);
  bad((s) => { s.releases[0].preSaveUrl = "javascript:alert(1)"; }, /preSaveUrl/);
  bad((s) => { s.artist.name = ""; }, /artist.name/);
});

test("未定の profile 項目は空文字でよい(URL は空か https)", () => {
  const empty = { siteUrl: "", x: "", label: "", contactEmail: "", companyUrl: "", profile: "", artistLinks: [], aiNotice: "AI" };
  assert.equal(validateProfile(empty), empty);
  assert.throws(() => validateProfile({ ...empty, x: "http://x.com/a" }), /x が https/);
});

test("news / profile の不正", () => {
  assert.throws(() => validateNews([{ date: "2026-1-1", title: "x" }]), /news.json\[0\]: date/);
  assert.throws(() => validateNews([{ date: "2026-10-01", title: "x", url: "javascript:x" }]), /url/);
  const p = fixture().profile;
  p.aiNotice = 1;
  assert.throws(() => validateProfile(p), /aiNotice/);
  const blank = fixture().profile;
  blank.aiNotice = "";
  assert.equal(validateProfile(blank), blank); // HP に出さない(2026-10-27 ユーザー指示)ときは空
  const q = fixture().profile;
  q.artistLinks[0].url = "http://example.com";
  assert.throws(() => validateProfile(q), /artistLinks\[0\]/);
  const r = fixture().profile;
  delete r.artistLinks;
  assert.equal(validateProfile(r), r);
});

test("loadData は 3 つの JSON を読んで検証する", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "neko-"));
  await writeFixtureRoot(dir);
  const data = await loadData(path.join(dir, "data"));
  assert.equal(data.site.releases.length, 2);
  assert.equal(data.profile.x, "https://x.com/neko_example");
});
