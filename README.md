Twitter Crawler
===============

Crawls Twitter using Puppeteer (Chrome / Firefox / etc).


Why?
----

Twitter [now requires JavaScript](https://news.ycombinator.com/item?id=25464280).
As a result, virtually every simple HTTP-only crawler no longer works.

This project serves as a proof-of-concept for crawling twitter via a real Web
browser.


Try It Out
----------

Requirements:

- Node 12+
- Yarn

Basic usage:

```sh
# Install locally
git clone git@github.com:jchook/twitter-crawler.git
cd twitter-crawler
yarn

# Run a short demo
yarn crawl

# Search for a particular phrase
yarn crawl "search?q=a+shrimp+fried+this+rice"

# Crawl a specific user
yarn crawl "Rainmaker1973"

# Crawl in headless mode
HEADLESS=1 yarn crawl "search?q=puppeteer"
```

