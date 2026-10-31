import { describe, expect, it } from "vitest";

import { parseDurationSeconds, parsePodcastFeed } from "./podcast.parse";

const feed = (items: string, head = "") => `<?xml version="1.0"?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
  <channel>
    <title>Pixels &amp; Perspective</title>
    <description><![CDATA[<p>Un podcast</p>]]></description>
    <link>https://example.com/show</link>
    <itunes:image href="https://example.com/show.jpg"/>
    ${head}
    ${items}
  </channel>
</rss>`;

describe("parsePodcastFeed", () => {
  it("reads channel metadata and decodes entities / CDATA", () => {
    const parsed = parsePodcastFeed(feed(""));
    expect(parsed.title).toBe("Pixels & Perspective");
    expect(parsed.description).toBe("Un podcast");
    expect(parsed.image).toBe("https://example.com/show.jpg");
    expect(parsed.episodes).toEqual([]);
  });

  it("parses episodes, including a single item and attribute-bearing guid", () => {
    const parsed = parsePodcastFeed(
      feed(`<item>
        <title><![CDATA[Épisode 1]]></title>
        <guid isPermaLink="false">abc-123</guid>
        <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
        <itunes:duration>01:02:40</itunes:duration>
        <itunes:season>2</itunes:season>
        <enclosure url="https://cdn.example.com/a.mp3?x=1&amp;y=2" type="audio/mpeg"/>
        <link>https://example.com/ep1</link>
      </item>`),
    );
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.episodes[0]).toMatchObject({
      guid: "abc-123",
      title: "Épisode 1",
      duration: "63 min",
      durationSec: 3760,
      season: 2,
      audioUrl: "https://cdn.example.com/a.mp3?x=1&y=2",
      image: "https://example.com/show.jpg",
      link: "https://example.com/ep1",
    });
  });

  it("drops non-http(s) URLs and untitled items", () => {
    const parsed = parsePodcastFeed(
      feed(`<item><title>Bad</title><enclosure url="javascript:alert(1)"/><link>ftp://x</link></item>
            <item><description>no title</description></item>`),
    );
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.episodes[0].audioUrl).toBe("");
    expect(parsed.episodes[0].link).toBe("");
    expect(parsed.episodes[0].season).toBeUndefined();
  });

  it("rejects a document without a channel", () => {
    expect(() => parsePodcastFeed("<html></html>")).toThrow();
  });
});

describe("parseDurationSeconds", () => {
  it("handles seconds, MM:SS and HH:MM:SS", () => {
    expect(parseDurationSeconds("3760")).toBe(3760);
    expect(parseDurationSeconds("62:40")).toBe(3760);
    expect(parseDurationSeconds("01:02:40")).toBe(3760);
    expect(parseDurationSeconds("abc")).toBeUndefined();
    expect(parseDurationSeconds("")).toBeUndefined();
  });
});
