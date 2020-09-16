/* eslint-disable */
import NodeEnvironment from "jest-environment-node";
import * as webdriverio from "webdriverio";
import { Event, State } from "jest-circus";
import fs from "fs";
import { get } from "lodash";
import { DEFAULT_RESOURCES_DIR } from "./utils/varmon";
import path from "path";

const varmonConfig = `${process.cwd()}/varmon.json`;
if (!fs.existsSync(varmonConfig)) throw new Error("Missing Varmon Json");
const varmonData = JSON.parse(fs.readFileSync(varmonConfig, "utf-8"));

const resourcesDir = varmonData.resourcesDir || DEFAULT_RESOURCES_DIR;

declare global {
  namespace NodeJS {
    interface Global {
      // driver: IDriver;
      browser: typeof browser;
      vars: any;
      sessionCapabilities: any;
      testName: string;
      $: typeof $;
      $$: typeof $$;
      remote: typeof webdriverio.remote;
    }
  }
}

export type Options = ConstructorParameters<typeof NodeEnvironment>[0];

export type TestEnvironmentOptions = Parameters<
  typeof webdriverio["remote"]
>[0];

export default class WebdriverIOEnvironment extends NodeEnvironment {
  public options: TestEnvironmentOptions;
  private resourcesDir: string;

  public constructor(options: Options) {
    super(options);
    this.options = options.testEnvironmentOptions;
    this.resourcesDir = path.resolve(process.cwd(), resourcesDir);
  }

  public async setup(): Promise<void> {
    await super.setup();
    this.global.remote = webdriverio.remote;
    this.global.browser = await this.global.remote(this.options);
    this.global.$ = this.global.browser.$;
    this.global.$$ = this.global.browser.$$;
    this.global.previousFailureEvent = false;
    // this.global.sessionCapabilities = this.global.browser.capabilities;
    global.sessionCapabilities = this.global.browser.capabilities;
    try {
      if(this.global.browser.isAndroid)
        global.sessionCapabilities.networkStatus = await this.global.browser.getNetworkConnection();
    } catch (e) {
      console.warn("Unable to get network status");
    }
    // Take a screenshot at the point of failure
    if (!fs.existsSync(this.resourcesDir)) {
      fs.mkdirSync(this.resourcesDir, { recursive: true });
    }
  }

  public async teardown(): Promise<void> {
    await new Promise(resolve => {
      setTimeout(resolve, 30000);
    });
    if (this.global.browser) {
      await this.global.browser.deleteSession();
    }

    await super.teardown();
  }

  public async handleTestEvent(event: Event, _state: State): Promise<void> {
    if (event.name == "test_fn_start") {
      this.global.testName = this.resolveName(event.test);
    }

    if (event.name == "test_fn_failure") {
      if (get(event, "error.message") === "SKIPPED") return;

      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.global.previousFailureEvent = true;

      const testName = this.resolveName(event.test);

      const extra = { image: "", source: "" };

      try {
        extra.image = `${this.resourcesDir}/${testName}.png`;
        if (!fs.existsSync(extra.image))
          this.global.browser
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
        this.global.browser
          .getPageSource()
          .then(t => {
            extra.source = `${this.resourcesDir}/${testName}.xml`;
            if (!fs.existsSync(extra.source)) {
              fs.writeFileSync(extra.source, t);
              console.log("xml source saved!");
            }
          })
          .catch(err => {
            console.error("unable to get page source", testName, err);
          });
      } catch (e) {
        console.error("unable to get page source", testName);
      }
    }
  }

  private resolveName(test: any): string {
    let testName = get(test, "name");
    let parent;
    let t = test;
    while ((parent = get(t, "parent"))) {
      const parentName = get(parent, "name");
      if (parentName !== "ROOT_DESCRIBE_BLOCK")
        testName = `${parentName} ${testName}`;

      t = parent;
    }
    return testName;
  }
}

module.exports = WebdriverIOEnvironment;
