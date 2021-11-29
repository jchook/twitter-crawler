import PuppeteerExtra from "puppeteer-extra";
import { crawlAllTweets } from "../crawl";

const HEADLESS = process.env.HEADLESS;

(async () => {
  // Keep the browser in outer scope for clean-up
  let browser:
    | Awaited<ReturnType<typeof PuppeteerExtra["launch"]>>
    | undefined = undefined;

  try {
    // Get the path we want to access from the command line
    const path = process.argv[2] || "search?q=a+shrimp+fried+this+rice";

    browser = await PuppeteerExtra.launch({ headless: !!HEADLESS });
    const [page] = await browser.pages();

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
  } catch (err) {
    process.stderr.write(err + "\n");
  } finally {
    if (browser) await browser.close();
  }
})();
