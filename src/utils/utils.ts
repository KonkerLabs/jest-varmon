import path from "path";
import fs from "fs-extra";
import {DEFAULT_RESOURCES_DIR} from "./varmon";

const DEFAULT_TIMEOUT = 10000;

const varmonConfig = `${process.cwd()}/varmon.json`;
if (!fs.existsSync(varmonConfig)) throw new Error("Missing Varmon Json");

const varmonData = JSON.parse(fs.readFileSync(varmonConfig, "utf-8"));
const resourcesDir = varmonData.resourcesDir || DEFAULT_RESOURCES_DIR;

export function takePrint() {
  const printScreensDir = path.resolve(process.cwd(), resourcesDir);

  const testName = global.testName;
  const extra = {image: "", source: ""};

  try {
    extra.image = `${printScreensDir}/${testName}.png`;
    browser
      .saveScreenshot(extra.image)
      .then(() => {
        console.log("SS saved!");
      })
      .catch(err => {
        console.error("unable to get screenshot", testName, err);
      });
  } catch (e) {
    console.error("unable to get screenshot", testName);
  }

  try {
    browser
      .getPageSource()
      .then(t => {
        extra.source = `${printScreensDir}/${testName}.xml`;
        fs.writeFileSync(extra.source, t);
        console.log("xml source saved!");
      })
      .catch(err => {
        console.error("unable to get page source", testName, err);
      });
  } catch (e) {
    console.error("unable to get page source", testName);
  }
}

export const delay = (timeout = DEFAULT_TIMEOUT) => {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
};

type SelectorType = {
  selector: string;
  timeout?: number;
  message?: string;
};
export const getElement = async ({
  selector,
  timeout = DEFAULT_TIMEOUT,
  message,
}: SelectorType): Promise<WebdriverIOAsync.Element> => {
  const t = timeout;
  let success = false;
  const printTimeout = Math.max(200, t - 1000);
  delay(printTimeout).then(() => {
    if (!success) return takePrint();
    return;
  });
  await browser.waitUntil(
    function() {
      return browser.$(selector).then(value => value.isExisting());
    },
    timeout,
    message
      ? `{{${message}}}`
      : `{{${selector} não foi encontrado no intervalo de tempo}}`,
    500
  );
  const test: WebdriverIOAsync.Element = await browser.$(selector);
  success = true;
  return test;
};
export const getElementIfClickable = async ({
  selector,
  timeout = DEFAULT_TIMEOUT,
  message,
}: SelectorType): Promise<WebdriverIOAsync.Element> => {
  const t = timeout;
  let success = false;
  const printTimeout = Math.max(200, t - 1000);
  delay(printTimeout).then(() => {
    if (!success) return takePrint();
    return;
  });
  await browser.waitUntil(
    function() {
      return browser.$(selector).then(value => value.isClickable());
    },
    timeout,
    message
      ? `{{${message}}}`
      : `{{${selector} não ficou clicavél no intervalo de tempo de ${(
          t / 1000
        ).toFixed(0)}s }}`,
    500
  );
  const test: WebdriverIOAsync.Element = await browser.$(selector);
  success = true;
  return test;
};

export function skipIfFails() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  if (previousFailureEvent) throw new Error("SKIPPED");
}

export async function swipe(
  initialX = 400,
  finalX = 20,
  y = 300
): Promise<void> {
  console.log("swipe", arguments);

  await browser.touchPerform([
    {
      action: "press",
      options: {x: initialX, y: y},
    },
    {
      action: "wait",
      options: {ms: 500},
    },
    {
      action: "moveTo",
      options: {x: finalX, y: y},
    },
    {
      action: "release",
    },
  ]);
}

export async function scroll(initialY = 500, finalY = 50): Promise<void> {
  await browser.pause(2000);

  console.log("scrolling");
  await browser.touchPerform([
    {
      action: "press",
      options: {x: 100, y: initialY},
    },
    {
      action: "wait",
      options: {ms: 1000},
    },
    {
      action: "moveTo",
      options: {x: 100, y: finalY},
    },
    {
      action: "release",
    },
  ]);
  await browser.pause(2000);
}

export const vars = global.vars;
