import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

const FIXTURE_PAGE = fs.readFileSync(path.join(import.meta.dirname, "fixtures/page.html"), "utf8");
/** Size of `#box` in the fixture page. */
export const BOX_SIZE = { width: 200, height: 100 };
/** Playwright's default viewport. */
export const VIEWPORT_SIZE = { width: 1280, height: 720 };
/** Minimum document height of the fixture page. */
export const PAGE_HEIGHT = 3100;

export type FixtureServer = {
  url: string;
  /** The `Cookie` header of every request to the page. */
  cookies: Array<string | undefined>;
  /** Extra CSS added to the page, to change it between runs. */
  css: string;
  close: () => Promise<void>;
};

/** Serves the fixture page on a random local port. */
export const startFixtureServer = async (): Promise<FixtureServer> => {
  const cookies: Array<string | undefined> = [];
  const server = http.createServer((req, res) => {
    if (req.url !== "/") {
      res.writeHead(404).end();
      return;
    }
    cookies.push(req.headers.cookie);
    const page = FIXTURE_PAGE.replace("</head>", `<style>${fixture.css}</style></head>`);
    res.writeHead(200, { "content-type": "text/html" }).end(page);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const fixture: FixtureServer = {
    url: `http://127.0.0.1:${port}/`,
    cookies,
    css: "",
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
  return fixture;
};

/** CSS that only Firefox applies, to make a cross-browser diff find a change. */
export const FIREFOX_ONLY_CSS = "@supports (-moz-appearance: none) { #box { background: #00c; } }";

export const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "chromascope-test-"));

/** Lists every file below `dir`, relative to it. */
export const listFiles = (dir: string) =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: "utf8" }).sort() : [];

export const readPngSize = (file: string) => {
  const { width, height } = PNG.sync.read(fs.readFileSync(file));
  return { width, height };
};

/** A local URL that refuses connections: the port of a server that was just closed. */
export const closedPortUrl = async () => {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}/`;
};
