import fs from "fs-extra";
import path from "path";
import {
  DEFAULT_RESOURCES_DIR,
  prepareRequest,
  resolveValidTest,
  send,
} from "../utils/varmon";
import {
  BaseReporter,
  TestResult,
  AggregatedResult,
  Test,
} from "@jest/reporters";
import {Context} from "vm";
const varmonConfig = `${process.cwd()}/varmon.json`;
if (!fs.existsSync(varmonConfig)) throw new Error("Missing Varmon Json");
const varmonData = JSON.parse(fs.readFileSync(varmonConfig, "utf-8"));

const resourcesDir = varmonData.resourcesDir || DEFAULT_RESOURCES_DIR;

class VarmonReporter extends BaseReporter {
  private readonly resourcesDir: string;
  constructor() {
    super();
    this.resourcesDir = path.resolve(process.cwd(), resourcesDir);
    fs.ensureDir(this.resourcesDir);
  }

  onTestResult(_test?: Test, _testResult?: TestResult): void {
    try {
      const files = fs.readdirSync(this.resourcesDir);

      _testResult.testResults.forEach(test => {
        const title = test.fullName;

        const hasPNG = files.find(file => file === `${title}.png`);
        const hasXML = files.find(file => file === `${title}.xml`);

        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        test.source = hasXML ? `${title}.xml` : null;
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        test.image = hasPNG ? `${title}.png` : null;
      });
    } catch (e) {
      console.log("no screenshots", e.message);
    }

    let resultJSON = resolveValidTest({testResults: [_testResult]});

    prepareRequest(varmonData.flows, resultJSON, this.resourcesDir)
      .then(requests => {
        return send(requests, varmonData);
      })
      .then(() => {
        console.log("Data sent!");
        resultJSON = null;
        return;
      })
      .catch(err => {
        console.error("Unable to send data to Varmon APIs", err);
        resultJSON = null;
        return;
      });
  }
  delay(): Promise<void> | void {
    return new Promise(resolve => {
      setTimeout(resolve, 5000);
    });
  }

  onRunComplete(
    _contexts: Set<Context>,
    results: AggregatedResult
  ): Promise<void> | void {
    fs.writeFileSync(
      `${this.resourcesDir}/results.json`,
      JSON.stringify(results)
    );

    return this.delay();
  }
}

module.exports = VarmonReporter;
