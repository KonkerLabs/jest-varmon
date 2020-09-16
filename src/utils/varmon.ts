import { get, flatMapDeep } from "lodash";
import fs from "fs-extra";
import os from "os";
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";
import Axios from "axios";
import rimraf from "rimraf";
import path from "path";
import {run} from "jest-cli";

export const DEFAULT_RESOURCES_DIR = "test-report";

function cleanString(inputb: string) {
  let output = "";
  const input = inputb.replace(/\[\d+m/g, " ");
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) === 27) {
      output += " ";
    } else {
      output += input.charAt(i);
    }
  }
  return output;
}

function ignoreFailures(msg){
  if(!msg) return false;
  if(msg.includes("Error: connect ECONNREFUSED")) return true;

  return msg.includes("Error: socket hang up");
}

export function resolveValidTest(resultJSON: any){
  if (get(resultJSON, "testResults")){
    resultJSON.testResults = resultJSON.testResults.filter(value => {
      if(Array.isArray(value.failureMessages)){
        return value.failureMessages.filter(fm => ignoreFailures(fm)).length===0;
      }

      return !ignoreFailures(value.failureMessage);
    });
  }
  return resultJSON;
}

export function getStepResult(
  flowName: string,
  stepName: string,
  resultJSON: any,
  startedAt?: number
): any[] {
  if (get(resultJSON, "testResults"))
    return getStepResult(
      flowName,
      stepName,
      resultJSON.testResults,
      get(resultJSON, "testResults.perfStats.start")
    );

  if (Array.isArray(resultJSON)) {
    const results = resultJSON
      .map(test => {
        return getStepResult(flowName, stepName, test);
      })
      .filter(val => val);
    if (results.length) return flatMapDeep(results);
  }

  const ancestorTitles: Array<string> = get(resultJSON, "ancestorTitles", []);
  const title: string = get(resultJSON, "title", "");

  if (ancestorTitles.includes(flowName) && title === stepName) {
    resultJSON.flowName = flowName;
    resultJSON.stepName = stepName;
    resultJSON.timestamp = startedAt;
    // skip on fail!
    const failureMessages = cleanString(
      [resultJSON.failureMessages].join("\n")
    );
    if (!failureMessages.includes("Error: SKIPPED")) {
      return resultJSON;
    }
  }

  return [];
}

async function optimizeImage(filePath: string) {
  return await imagemin([filePath], {
    destination: os.tmpdir(),
    plugins: [
      imageminPngquant({
        quality: [0.6, 0.8]
      })
    ]
  });
}

async function loadImageInBase64Encode(filePath: string) {
  if (!fs.existsSync(filePath)) throw new Error("no such file or directory");

  const optimizedImage = await optimizeImage(filePath);
  const bitmapBase64 = fs.readFileSync(
    optimizedImage[0].destinationPath,
    "base64"
  );
  // delete files
  fs.unlinkSync(optimizedImage[0].destinationPath);
  return bitmapBase64;
}

export async function resolveImages(testJson: any, imageFolder: string) {
  const image = testJson.image
    ? await loadImageInBase64Encode(`${imageFolder}/${testJson.image}`)
    : null;
  return image;
}

export function resolveSource(testJson: any, sourceFolder: string) {
  return testJson.source
    ? fs.readFileSync(`${sourceFolder}/${testJson.source}`, "utf8")
    : null;
}

enum StatusEnum {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED"
}

type DetailsType = {
  errorMessage?: string;
  source?: string;
  image?: string;
  sessionCapabilities?: any;
};

type VarmonRequestItemType = {
  featureName: string;
  scenarioName: string;
  timestamp: string; // isoDate
  duration: Date;
  status: StatusEnum;
  details?: DetailsType;
};

type StepType = {
  name: string;
};

type FlowType = {
  [key: string]: Array<string>;
};

export async function prepareRequest(
  flowDefinition: FlowType,
  resultJSON: any,
  resourcesDir: string
): Promise<Array<VarmonRequestItemType>> {
  const requests: Array<VarmonRequestItemType> = [];
  const testResults = resolveFlowsTestResults(flowDefinition, resultJSON);

  for (let i = 0; i < testResults.length; i++) {
    const testResult = testResults[i];
    const status =
      testResult.status === "passed" ? StatusEnum.SUCCESS : StatusEnum.FAILED;
    const duration = testResult.duration;
    const timestamp = testResult.timestamp
      ? new Date(testResult.timestamp)
      : new Date();
    const errorMessage = cleanString([testResult.failureMessages].join("\n"));

    requests.push({
      featureName: testResult.flowName as string,
      scenarioName: testResult.stepName as string,
      status,
      duration,
      timestamp: timestamp.toISOString(),
      details: {
        errorMessage,
        sessionCapabilities: global.sessionCapabilities,
        image: await resolveImages(testResult, resourcesDir),
        source: resolveSource(testResult, resourcesDir)
      }
    });
  }
  return requests;
}

export function resolveFlowsTestResults(
  flowDefinition: FlowType,
  resultJSON: any
) {
  const testResults = [];
  const keys = Object.keys(flowDefinition);
  for (let i = 0; i < keys.length; i++) {
    const flowName = keys[i];
    const steps = flowDefinition[flowName];
    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];
      const tr = getStepResult(flowName, step, resultJSON);
      if (tr.length) testResults.push(...tr);
    }
  }

  return testResults;
}

type VarmonAPIType = {
  url: string;
  token: string;
};

type VarmonConfigType = {
  resourcesDir: string;
  apis: Array<VarmonAPIType>;
  flows: FlowType;
};

export async function moveToSending(origin: string) {
  const isoDate = new Date().toISOString();
  const sending = `${origin}-sending/${isoDate}`;
  await fs.move(origin, sending);
  return sending;
}

export async function readResultFileAsJSON(resourceDir: string) {
  const resultsFile = `${resourceDir}/results.json`;
  return await fs.readJSON(resultsFile);
}

export async function send(
  data: Array<VarmonRequestItemType>,
  config: VarmonConfigType
) {
  for (const api of config.apis) {
    console.log("-----> sending <------", api, data.length);
    try {
      await Axios.request({
        method: "PUT",
        url: `${api.url}/api/features/batch?token=${api.token}`,
        data
      }).catch(reason => {
        console.error(
            get(reason,"message"),
            get(reason,"response.status"),
            get(reason,"response.statusText"),
            get(reason,"response.config.url"),
            get(reason,"response.data")
        );
      });
    } catch (e) {
      console.error(e.message);
    }
    console.log("-----> ended <------", api, data.length);
  }
}

export async function resolveRequests(config: VarmonConfigType) {
  const resourcesDir = path.resolve(
    process.cwd(),
    get(config, "resourceDir", DEFAULT_RESOURCES_DIR)
  );

  const sendingResourceDir = await moveToSending(resourcesDir);
  const resultJSON = resolveValidTest(await readResultFileAsJSON(sendingResourceDir));
  const requests = await prepareRequest(
    config.flows,
    resultJSON,
    sendingResourceDir
  );

  return requests;
}
export async function runJest() {
  await run();
}

export async function start(config: VarmonConfigType) {
  const resourcesDir = path.resolve(
    process.cwd(),
    get(config, "resourceDir", DEFAULT_RESOURCES_DIR)
  );

  rimraf.sync(resourcesDir);
  await runJest();

  await moveToSending(resourcesDir);
  // const requests = await resolveRequests(config);
  // console.log("Sending data to Varmon APIs");
  // send(requests, config).then(()=>{
  //   console.log("Data sent!");
  // }).catch((err)=>{
  //   console.error("Unable to send data to Varmon APIs",err);
  // });
}
