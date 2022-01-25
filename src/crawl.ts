import { Page } from "puppeteer";
import { TWITTER_LAUNCH_DATE } from "./search";

const TWITTER_SEARCH = "https://twitter.com/search?q=";

export interface Tweet {
  url: string;
  content: string;
  created: string;
}

export const crawlAllTweetsOptionsDefaults: CrawlAllTweetsOptions = {
  paginate: true,
  nextPageTimeout: 10000,
  nextPagePause: 500,
  crawledAttribute: "data-crawled",
};

export interface CrawlAllTweetsOptions {
  crawledAttribute: string;
  paginate: boolean;
  nextPageTimeout: number;
  nextPagePause: number;
  [key: string]: any;
}

export interface CrawlUserDetailsOptions {}

export interface UserDetails {
  displayName?: string;
  location?: string;
  signUpDate?: Date;
  estimatedTotalTweets?: number;
}

export interface UserDetailsRaw {
  displayName?: string;
  location?: string;
  signUpDate?: string;
  estimatedTotalTweets?: string;
}

// Parse estimated tweet count
// This function needs to live inside the page
function parseEstimatedTweetTotal(est?: string): number | undefined {
  if (!est) return undefined
  const matches = est.match(/\s*([0-9\.,]+)([MK]?)\s*Tweets/);
  if (!matches) {
    return undefined;
  }
  const mainNum = parseFloat(matches[1].replace(",", ""));
  const modifier = matches[2] || "";
  if (modifier === "K") {
    return 1000 * mainNum;
  } else if (modifier === "M") {
    return 1000000 * mainNum;
  } else {
    return mainNum;
  }
}

export function parseUserDetails(details: UserDetailsRaw): UserDetails {
  return {
    ...details,
    signUpDate: details.signUpDate ? new Date(details.signUpDate) : undefined,
    estimatedTotalTweets: parseEstimatedTweetTotal(details.estimatedTotalTweets),
  }
}

export async function crawlUserDetails(
  page: Page,
  options: Partial<CrawlUserDetailsOptions>
) {
  return await page.evaluate(() => {
    // Display name
    const displayName =
      document.querySelector("main h2")?.textContent || undefined;

    // Total tweets
    const estimatedTotalTweets =
      document.querySelector("main h2 + div")?.textContent || undefined;

    // Header items
    const userHeaderItems = document.querySelectorAll('[data-testid=UserProfileHeader_Items] > span')
    let signUpDate: string | undefined
    let userLocation: string | undefined
    for (const headerItem of userHeaderItems) {
      if (headerItem.getAttribute('data-testid') === 'UserLocation') {
        userLocation = headerItem.textContent || undefined
      } else {
        const text = headerItem.textContent || ''
        const matches = text.match(/Joined\s+(.+)/)
        if (matches) {
          signUpDate = matches[1]
        }
      }
    }
    const details: UserDetailsRaw = {
      displayName,
      location: userLocation,
      estimatedTotalTweets,
      signUpDate,
    };
    return details;
  });
}

/**
 * Crawl tweets with pagination
 */
export async function* crawlAllTweets(
  page: Page,
  options: Partial<CrawlAllTweetsOptions> = {}
): AsyncGenerator<Tweet[]> {
  const opt: CrawlAllTweetsOptions = Object.assign(
    {},
    crawlAllTweetsOptionsDefaults,
    options
  );
  while (true) {
    const tweets = await page.evaluate((opt: CrawlAllTweetsOptions) => {
      const tweets: Tweet[] = [];

      // Keep track of the last article so we can tag it with an ID
      let lastArticle: Element | null = null;

      // Find all the tweets on the page
      const articles = document.querySelectorAll(
        'article[data-testid="tweet"]'
      );

      // For each tweet...
      for (const article of articles) {
        // Skip tweets we already crawled
        if (article.getAttribute(opt.crawledAttribute)) {
          continue;
        }

        // Mark the tweet as crawled
        article.setAttribute(opt.crawledAttribute, "yes");

        // Keep track of the last tweet in the list
        lastArticle = article;

        // Extract details
        const time = article.querySelector("time[datetime]") || undefined;
        const datetime = time?.getAttribute("datetime");
        const url =
          time?.parentNode instanceof HTMLAnchorElement
            ? time?.parentNode.getAttribute("href")
            : undefined;
        const content = article.querySelector("div[dir][lang]")?.textContent;

        // Bail if anything is missing
        if (!url || !content || !datetime) {
          continue;
        }

        // Wow kind of wild we are able to type check this
        tweets.push({ created: datetime, url, content });
      }

      // Trigger infinite scroll
      if (opt.paginate && lastArticle) {
        lastArticle.scrollIntoView();
      }

      // Return a batch of tweets
      return tweets;
    }, opt);

    // Looks like we're done!
    if (!tweets.length) {
      return;
    }

    // Yield this batch of tweets
    const injected = yield tweets;

    // If the controller wants to stop, send in false
    // TODO: make this an explicit Symbol, like signals.STOP_CRAWLING
    if (injected === false) {
      return;
    }

    // If we don't even want to paginate, stop here
    if (!opt.paginate) {
      return;
    }

    // Wait for infinite scroll to finish
    await page.waitForTimeout(opt.nextPagePause);
    await page.waitForNetworkIdle({
      timeout: opt.nextPageTimeout,
    });

    // TODO: Does this quit too easily? Maybe it should do some scroll jiggers
    // to get more tweets?
  }
}

/**
 * Crawl the tweets on the page without any pagination
 */
export async function crawlTweets(page: Page): Promise<Tweet[]> {
  const gen = crawlAllTweets(page, { paginate: false });
  return (await gen.next()).value();
}

/**
 * @deprecated navigate to the desired tweet feed in your controller logic
 */
export async function crawlSearchResults(
  page: Page,
  query: string
): Promise<Tweet[]> {
  const url = `${TWITTER_SEARCH}${query}`;
  await page.goto(url, { waitUntil: "networkidle0" });
  return await crawlTweets(page);
}

export function err(message: string): boolean {
  return process.stderr.write(message + "\n");
}
