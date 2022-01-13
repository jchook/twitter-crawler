import PuppeteerExtra from "puppeteer-extra";
import { crawlAllTweets } from "../crawl";
import {getDateRanges} from "../search";


(async () => {
  try {

    // Run as headless
    const HEADLESS = process.env.HEADLESS;

    // Launch the browser outside for clean-up
    const browser = await PuppeteerExtra.launch({ headless: !!HEADLESS });

    try {

      // Get the path we want to access from the command line
      // https://twitter.com/search?q=from%3ABrowtweaten%20since%3A2017-04-01%20until%3A2017-05-01
      const username = process.argv[2] || 'Browtweaten'

      // TODO figure out start date from the user's profile
      const startDate = new Date('2017-04-01')

      const ranges = getDateRanges(startDate, new Date())
      const query = encodeURIComponent(`from:${username} since:${sinceStr} until:${untilStr}`);
      const [page] = await browser.pages()

      // Perform search
      await page.goto("https://twitter.com/search?q=" + query, {
        waitUntil: "networkidle0",
      });

      // Emit as JSONL
      const gen = crawlAllTweets(page);
      for await (const tweets of gen) {
        for (const tweet of tweets) {
          process.stdout.write(JSON.stringify(tweet) + "\n");
        }
      }

    } finally {
      if (browser) await browser.close();
    }
  } catch (err) {
    process.stderr.write(err + "\n");
  }

})();


