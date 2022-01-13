set dotenv-load := true

default:
  just --list

build:
  yarn tsc

docs:
  yarn typedoc --out docs/html src/index.ts

crawl path="":
  yarn ts-node src/example/crawl-tweets.ts '{{path}}'

search query:
  yarn ts-node src/example/crawl-tweets.ts 'search?q={{query}}'

