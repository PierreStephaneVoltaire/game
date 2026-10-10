export type QuoteCredit = {
  quote: string;
  videoSource: string;
  timestamp: string | null;
};

export async function loadQuoteCredits(
  fetcher: typeof fetch = fetch,
): Promise<QuoteCredit[]> {
  try {
    const response = await fetcher('/api/content/quote-credits');
    if (!response.ok) return [];
    const value: unknown = await response.json();
    if (!Array.isArray(value)) return [];
    return value.filter(
      (credit): credit is QuoteCredit =>
        typeof credit?.quote === 'string' &&
        Boolean(credit.quote.trim()) &&
        typeof credit.videoSource === 'string' &&
        /^https:\/\//.test(credit.videoSource) &&
        (credit.timestamp === null || typeof credit.timestamp === 'string'),
    );
  } catch {
    return [];
  }
}

export function isTweet(credit: QuoteCredit): boolean {
  return /^(?:www\.)?(?:twitter|x)\.com$/i.test(hostOf(credit.videoSource));
}

export function creditTimestamp(credit: QuoteCredit): string | null {
  return isTweet(credit) ? null : credit.timestamp;
}

export function creditHref(credit: QuoteCredit): string {
  const seconds = timestampSeconds(creditTimestamp(credit));
  if (seconds === null) return credit.videoSource;
  const url = new URL(credit.videoSource);
  const host = url.hostname.replace(/^(?:www\.|m\.)/, '');
  if (host === 'youtube.com' || host === 'youtu.be')
    url.searchParams.set('t', `${seconds}s`);
  else if (host === 'twitch.tv')
    url.searchParams.set(
      't',
      `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m${seconds % 60}s`,
    );
  return url.toString();
}

function hostOf(source: string): string {
  try {
    return new URL(source).hostname;
  } catch {
    return '';
  }
}

function timestampSeconds(timestamp: string | null): number | null {
  if (!timestamp || !/^\d+(?::\d{1,2}){0,2}$/.test(timestamp.trim()))
    return null;
  return timestamp
    .trim()
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0);
}
