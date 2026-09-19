import assert from "node:assert/strict";
import test from "node:test";
import { normalizeApplePodcastsUrl } from "../public/apple-podcasts-url-utils.js";
import { applePodcastsImportError } from "../lib/apple-podcasts.mjs";

const show = "https://podcasts.apple.com/us/podcast/synthetic-podcast/id1234567890";

test("Apple Podcasts keeps the exact episode and storefront while stripping share parameters", () => {
  assert.equal(normalizeApplePodcastsUrl(`${show}?l=zh-Hans-CN&i=1000000000001`), `${show}?i=1000000000001`);
  assert.equal(normalizeApplePodcastsUrl(`${show}?i=1000000000001&uo=4&at=tracking#t=50`), `${show}?i=1000000000001`);
  assert.equal(normalizeApplePodcastsUrl("podcasts.apple.com/cn/podcast/id1234567890?i=1000000000001"), "https://podcasts.apple.com/cn/podcast/id1234567890?i=1000000000001");
});

test("Apple Podcasts rejects whole shows, ambiguous episode IDs and non-Apple URLs before downloading", () => {
  assert.throws(() => normalizeApplePodcastsUrl(show), /分享单集/);
  for (const value of [null, {}, "", "file:///etc/passwd", "http://127.0.0.1/", `${show}?i=abc`,
    `${show}?i=1000000000001&i=1000000000002`, `${show}?i=-1`, `${show}/other?i=1000000000001`,
    "https://podcasts.apple.com.evil.example/us/podcast/id1234567890?i=1000000000001",
    "https://user:password@podcasts.apple.com/us/podcast/id1234567890?i=1000000000001",
    "https://podcasts.apple.com:8080/us/podcast/id1234567890?i=1000000000001",
  ]) assert.throws(() => normalizeApplePodcastsUrl(value), {statusCode: 400});
});

test("Podcast errors explain unavailable audio and network failures without exposing raw URLs", () => {
  const fail = stderr => applePodcastsImportError({result:{stderr}});
  assert.match(fail("No video formats found: subscription required"), /订阅专享/);
  assert.match(fail("HTTP Error 403: signed-url-secret"), /网络/);
  assert.doesNotMatch(fail("Unexpected signed-url-secret"), /signed-url-secret/);
});
