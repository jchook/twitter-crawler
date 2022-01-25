import PuppeteerExtra from "puppeteer-extra";
import { Tweet } from "..";
import { crawlAllTweets, crawlUserDetails, parseUserDetails } from "../crawl";
import { getDateRanges, guessDateRangeCount } from "../search";

function writeTweet(tweet: Tweet) {
  return process.stdout.write(JSON.stringify(tweet) + "\n");
}

function dateToYmd(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

(async () => {
  try {
    // Run as headless
    const HEADLESS = process.env.HEADLESS;

    // Launch the browser outside for clean-up
    const browser = await PuppeteerExtra.launch({ headless: !!HEADLESS });
    const [page] = await browser.pages();

    try {
      // Get the path we want to access from the command line
      // https://twitter.com/search?q=from%3ABrowtweaten%20since%3A2017-04-01%20until%3A2017-05-01
      const username = process.argv[2] || "Browtweaten";

      // Keep track of how many tweets we find on the user's timeline (we'll need it later)
      let timelineTweetCount = 0;

      // Go to the user's timeline (with replies!)
      await page.goto(
        `https://twitter.com/${encodeURIComponent(username)}/with_replies`,
        { waitUntil: "networkidle0" }
      );

      // Get the user details from the top of the page
      const userDetailsRaw = await crawlUserDetails(page, {});
      const userDetails = parseUserDetails(userDetailsRaw);
      process.stderr.write(JSON.stringify(userDetailsRaw) + "\n");
      process.stderr.write(JSON.stringify(userDetails) + "\n");
      if (process.env.USER_DETAILS) {
        return;
      }

      // Scrape as many tweets as we can from this page
      let oldestTweet: Tweet | undefined;
      const userTimeline = crawlAllTweets(page);
      for await (const tweets of userTimeline) {
        for (const tweet of tweets) {
          writeTweet(tweet);
          oldestTweet = tweet;
          timelineTweetCount += 1;
        }
      }

      // If there is no oldest tweet, we are done
      if (!oldestTweet || !oldestTweet.created) {
        return;
      }

      // If scraping the user details failed, do not "fail open" by running
      // tons of search requests and potentially running up the proxy bill
      if (!userDetails.signUpDate || !userDetails.estimatedTotalTweets) {
        return;
      }

      // The "since" date is the user's join date
      const userSinceDate = userDetails.signUpDate;

      // Determine the "until" date based on the oldest tweet
      const userUntilDate = new Date(oldestTweet.created);

      // Guess how many date ranges we need to search (to get "all" the tweets)
      const dateRangeCount = guessDateRangeCount(
        userDetails.estimatedTotalTweets
      );

      // Use advanced search to uncover more tweets
      const ranges = getDateRanges(
        userSinceDate,
        userUntilDate,
        dateRangeCount
      );

      // For each date range...
      for (const [since, until] of ranges) {
        const sinceStr = dateToYmd(since);
        const untilStr = dateToYmd(until);

        // Build the query
        const query = encodeURIComponent(
          `from:${username} since:${sinceStr} until:${untilStr}`
        );

        // Perform the search
        await page.goto("https://twitter.com/search?q=" + query, {
          waitUntil: "networkidle0",
        });

        // Emit tweets
        const gen = crawlAllTweets(page);
        for await (const tweets of gen) {
          for (const tweet of tweets) {
            writeTweet(tweet);
          }
        }
      }
    } finally {
      if (browser) await browser.close();
    }
  } catch (err) {
    process.stderr.write(err + "\n");
  }
})();
