#!/usr/bin/env node
import fs from "fs-extra";
import "./JestEnvironment";
import "./utils/utils";
import "./reporter/json-reporter";
import {start} from "./utils/varmon";
import {vars} from "./utils/utils";

const varmonConfig = `${process.cwd()}/varmon.json`;
if (!fs.existsSync(varmonConfig)) throw new Error("Missing Varmon Json");

const varmonData = JSON.parse(fs.readFileSync(varmonConfig, "utf-8"));

/**
 * on exit SIGINT shutdown the processes
 */
process.once("SIGINT", function() {
  console.log("Force stop!");
  process.exit(0);
});

async function tester() {
  await start(varmonData);
}
const {VARMON_FREQUENCY = "1000"} = process.env;
const run = () => {
  return new Promise(function() {
    (async function waitState() {
      console.log("starting....");
      await tester();
      console.log("finished....");
      setTimeout(waitState, parseInt(VARMON_FREQUENCY));
    })();
  });
};

run().catch(console.error);
