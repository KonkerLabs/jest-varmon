import {
  getStepResult, prepareRequest,
  resolveFlowsTestResults,
  resolveImages,
  resolveSource, resolveValidTest
} from "./varmon";
// @ts-ignore
import resultJSON from "./__TEST__/resources/results.json";
import path from "path";
const flowConfig = {
  "Login": [
    "Login"
  ],
  "Meu Neon": [
    "Aba Menu Neon"
  ],
  "Extrato": [
    "Alterar view de saldo",
    "Abrir Extrato"
  ],
  "Crédito": [
    "Aba Crédito",
    "Ver Fatura"
  ]   ,
  "Cartão": [
    "Aba Cartões",
    "Cartão Físico"
  ]    ,

  "Investimentos": [
    "Aba Investimentos",
    "Abrir Investimentos"
  ]   ,
  "Indicações": [
    "Aba Indicações",
  ]
};
describe("Varmon", () => {
  describe("resolveValidTest", () => {
    it("resolveValidTest should return valid test results", () => {
      const resultJSONSolved = resolveValidTest(
          resultJSON
      );
      expect(resultJSONSolved.testResults).toBeDefined();
      expect(resultJSONSolved.testResults).toHaveLength(5);
    });
  })
  describe("getStepResult", () => {
    it("getStepResult should return step results", () => {
      const stepResult = getStepResult(
        "Cartão",
        "Aba Cartões",
        resultJSON
      );
      expect(stepResult).toBeDefined();
      expect(stepResult).toHaveLength(5);
    });
    it("getStepResult should return null", () => {
      const stepResult = getStepResult(
        "Investimentos",
        "Aba Indicações",
        resultJSON
      );
      expect(stepResult).toHaveLength(0);
    });
  });

  describe("resolveSource", () => {
    it("resolveSource should return a xml string", () => {
      const source = resolveSource(
        { source: "Fluxo 4 Cartão Cartão Físico.xml" },
        path.resolve(__dirname, "__TEST__/resources")
      );
      expect(source).toBeDefined();
    });
    it("resolveSource with invalid path should throw an exception", () => {
      expect(() =>
        resolveSource(
          { source: "Fluxo 4 Cartão Cartão Físico.xml" },
          path.resolve(__dirname, "invalid folder")
        )
      ).toThrowError(/no such file or directory/);
    });

    it("resolveSource with no source should return null", () => {
      expect(
        resolveSource({}, path.resolve(__dirname, "invalid folder"))
      ).toBeNull();
    });
  });
  describe("resolveImages", () => {
    it("resolveImages should return a base64 string", async () => {
      const source = await resolveImages(
        { image: "Fluxo 4 Cartão Cartão Físico.png" },
        path.resolve(__dirname, "__TEST__/resources")
      );
      expect(source).not.toBeNull();
    });
    it("resolveImages with invalid path should throw an exception", async () => {
      try {
        await resolveImages(
          { image: "Fluxo 4 Cartão Cartão Físico.png" },
          path.resolve(__dirname, "invalid folder")
        );
        expect("did not throw").toBeFalsy();
      } catch (e) {
        expect("did throw").toBeDefined();
      }
    });

    it("resolveImages with no source should return null", async () => {
      expect(
        await resolveImages({}, path.resolve(__dirname, "invalid folder"))
      ).toBeNull();
    });
  });

  describe("resolveFlowsTestResults", () => {
    it("resolveFlowsTestResults should return array of values", async () => {
      const flows = await resolveFlowsTestResults({  "Indicações": ["Aba Indicações"] }, resultJSON);
      expect(flows).not.toHaveLength(0);
    });
    it("resolveFlowsTestResults should return an empty array", async () => {
      const flows = await resolveFlowsTestResults({  "no": ["no"] }, resultJSON);
      expect(flows).toHaveLength(0);
    });
  });

  describe("prepareRequest", () => {

    it("prepareRequest should return array of values", async () => {
      const flows = await prepareRequest(flowConfig, resultJSON,path.resolve(__dirname, "__TEST__/resources"));
      expect(flows).not.toHaveLength(0);
      const failedFlows = flows.find(value => value.status==="FAILED");
      expect(failedFlows.details.errorMessage).toContain("not found");
      expect(failedFlows.details.image).not.toBeNull();
      expect(failedFlows.details.image).toBeDefined();
      expect(failedFlows.details.source).toBeDefined();

    });
    it("prepareRequest should return an empty array", async () => {
      const flows = await prepareRequest({"no":["no"]}, resultJSON,path.resolve(__dirname, "__TEST__/resources"));
      expect(flows).toHaveLength(0);
    });
  });
});
