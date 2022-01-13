import { Page } from "puppeteer";

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

export function err(message: string): boolean {
  return process.stderr.write(message + "\n");
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
