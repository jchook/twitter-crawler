import PuppeteerExtra from "puppeteer-extra";
import { crawlAllTweets } from "../crawl";


(async () => {
  try {

    // Run as headless
    const HEADLESS = process.env.HEADLESS;

    // Launch the browser outside for clean-up
    const browser = await PuppeteerExtra.launch({ headless: !!HEADLESS });

    try {

      // Get the path we want to access from the command line
      const path = process.argv[2] || "search?q=a+shrimp+fried+this+rice";
      const [page] = await browser.pages()

      // Perform search
      await page.goto("https://twitter.com/" + path, {
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

