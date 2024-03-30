import pr from "puppeteer";
import fs from "fs";
import admZip from "adm-zip";
import util from "util";
import { getOGALink } from "./sources.js";

fs.writeFile = util.promisify(fs.writeFile);
fs.mkdir = util.promisify(fs.mkdir);

let assetCount = 0;

pr.launch({ headless: true }).then(async (browser) => {
  const page = await browser.newPage();

  for (let j = 0; j < 5000; j++) {
    await page.goto(getOGALink(j), { timeout: 0 });

    const links = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll(".field-item.even > a"));
      return elements.map((element) => element.href);
    });

    const contentPage = await browser.newPage();

    for (let i = 0; i < links.length; i++) {
      assetCount += 1;
      console.log(`Asset count: ${assetCount}`);
      contentPage.goto(links[i], { timeout: 0 });

      await contentPage.waitForSelector(".file");

      const contentDescription = await contentPage.evaluate(() => {
        const element = document.querySelector("div[property='content:encoded']");
        return element.textContent;
      });

      const contentLinks = await contentPage.evaluate(() => {
        const elements = Array.from(document.querySelectorAll(".file > a"));
        return elements.map((element) => element.href);
      });

      const attributionSpecial = await contentPage.evaluate(() => {
        const element = document.querySelector(".field-name-field-art-attribution > .field-items > .field-item.even");
        if (element == null) {
          return "";
        }
        return element.textContent;
      });

      const attribution = await contentPage.evaluate(() => {
        const elements = Array.from(document.querySelectorAll(".license-name"));
        console.log(elements);
        return elements.map((e) => e.textContent);
      });

      const name = await contentPage.evaluate(() => {
        const element = document.querySelector("div[property='dc:title'] > h2");
        return element.textContent;
      });

      const tags = await contentPage.evaluate(() => {
        const elements = Array.from(document.querySelectorAll(".field-name-field-art-tags > .field-items > .field-item > a"));
        return elements.map((element) => element.textContent);
      });

      saveAsset(name, contentDescription, tags, contentLinks, attribution, attributionSpecial);
    }
  }

  await browser.close();
});

async function saveAsset(name, description, tags, links, attribution, attributionSpecial) {
  try {
    let fileName = name.replace(/[^a-zA-Z ]/g, "").trim();

    await fs.mkdir(`./data/${fileName}/assets`, { recursive: true });

    for (let i = 0; i < links.length; i++) {
      const response = await fetch(links[i]);
      const buffer = Buffer.from(await response.arrayBuffer());
      let fileType = links[i].split(".").pop();
      let downloadedFile = `./data/${fileName}/assets/${i}.${fileType}`;
      await fs.writeFile(downloadedFile, buffer);

      if (fileType === "zip") {
        const zip = new admZip(downloadedFile);
        zip.extractAllTo(`./data/${fileName}/assets`, true);
        console.log("EXTRACTED!");
      }
    }

    await fs.writeFile(`./data/${fileName}/attributes.json`, JSON.stringify({ name, description, tags, links, attribution, attributionSpecial }, null, 2));
  } catch (e) {}
}
