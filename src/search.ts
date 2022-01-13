export const TWITTER_LAUNCH_DATE = new Date("2006-07-15");

/**
 * To intelligently calculate the proper date range + granularity for crawling
 * all of a user's tweets, you will want:
 *
 * 1. Their sign-up date
 * 2. Their latest tweet date
 * 3. Their total tweet count
 *
 * One way to do this:
 *
 * 1. Load their profile `with_replies` page
 * 1. Save their signup date as the "since" date
 * 1. Save their tweet count
 * 1. Save all ~3200 tweets there, may as well
 * 1. Save the ~3200nd tweet date as the "until" date
 * 1. If the tweet count falls far below 3200, you're done.
 * 1. Otherwise, crawl search results for specific date ranges
 *
 * The specific date range granularity could be roughly:
 *
 * Estimated max tweets per search (manually counted)
 * maxPerSearch = 50
 *
 * Use a buffer coefficient to avoid missing tweets:
 * bufferCoefficient = 2
 *
 * Calculate how many searchs you need to get ALL ze tweets:
 * totalSearches = bufferCoefficient * tweets / maxPerSearch
 *
 */
export function guessRangeGranularity(
  since: Date,
  until: Date,
  tweetCount: number,
  maxPerSearch: number = 49,
  bufferCoefficient = 2
): number {
  return bufferCoefficient * tweetCount / maxPerSearch
}

const TWO_DAYS = 1000*60*60*24*2

export function getDateRanges(since: Date, until: Date, rangeCount: number) {
  const ranges: [Date, Date][] = [];
  const duration = until.getTime() - since.getTime();
  if (duration <= 0) {
    return ranges;
  }
  if (duration < TWO_DAYS) {
    return [[since, until]]
  }
  const interval = Math.floor(duration / rangeCount);
  let currentTime = since.getTime();
  for (let ii = 0; ii < rangeCount - 1; ii++) {
    ranges.push([new Date(currentTime), new Date(currentTime + interval)]);
    currentTime += interval;
  }
  ranges.push([new Date(currentTime), until]);
  return ranges;
}
