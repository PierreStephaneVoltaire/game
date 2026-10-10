import { describe, expect, test } from 'vitest';
import {
  creditHref,
  creditTimestamp,
  loadQuoteCredits,
  type QuoteCredit,
} from './quote-credits';

const credit = (videoSource: string, timestamp: string | null = '1:02:03') =>
  ({ quote: 'Quote', videoSource, timestamp }) satisfies QuoteCredit;

describe('quote credits', () => {
  test('links YouTube and Twitch sources to the quoted timestamp', () => {
    expect(creditHref(credit('https://www.youtube.com/watch?v=abc'))).toBe(
      'https://www.youtube.com/watch?v=abc&t=3723s',
    );
    expect(creditHref(credit('https://youtu.be/abc', '04:05'))).toBe(
      'https://youtu.be/abc?t=245s',
    );
    expect(creditHref(credit('https://www.twitch.tv/videos/1'))).toBe(
      'https://www.twitch.tv/videos/1?t=1h2m3s',
    );
  });

  test('tweets link without a timestamp', () => {
    const tweet = credit('https://x.com/bri/status/1');
    expect(creditTimestamp(tweet)).toBeNull();
    expect(creditHref(tweet)).toBe('https://x.com/bri/status/1');
    expect(creditTimestamp(credit('https://twitter.com/bri/status/1'))).toBe(
      null,
    );
  });

  test('keeps the source untouched when the timestamp is missing or unreadable', () => {
    expect(creditHref(credit('https://www.youtube.com/watch?v=a', null))).toBe(
      'https://www.youtube.com/watch?v=a',
    );
    expect(
      creditHref(credit('https://www.youtube.com/watch?v=a', 'soon')),
    ).toBe('https://www.youtube.com/watch?v=a');
  });

  test('drops malformed records and failed responses', async () => {
    const respond = (body: unknown, ok = true) =>
      (async () =>
        ({ ok, json: async () => body }) as Response) as typeof fetch;
    expect(
      await loadQuoteCredits(
        respond([
          credit('https://youtu.be/a'),
          { quote: ' ', videoSource: 'https://youtu.be/b', timestamp: null },
          {
            quote: 'Bad link',
            videoSource: 'javascript:alert(1)',
            timestamp: null,
          },
        ]),
      ),
    ).toEqual([credit('https://youtu.be/a')]);
    expect(await loadQuoteCredits(respond([], false))).toEqual([]);
    expect(await loadQuoteCredits(respond({}))).toEqual([]);
  });
});
