import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findAnswer, flattenAdditionalRequirements } from "../flatten";

describe("findAnswer", () => {
  test("matches the exact/specific needle even when a broader needle would match an earlier, unrelated question", () => {
    const flat = new Map([
      ["nationality", "Indian"],
      ["do you have a laptop?", "No"],
      ["employment status", "Student"],
    ]);
    // "employment" alone would match nothing here (no question contains the
    // bare word outside "employment status"), but if a form phrased an
    // unrelated question with "employment" in it earlier than the real
    // question, the specific needle must still win.
    const flatWithDecoy = new Map([
      ["are you seeking employment abroad?", "No"],
      ["employment status", "Student"],
    ]);
    assert.equal(findAnswer(flat, "employment status", "employment"), "Student");
    assert.equal(findAnswer(flatWithDecoy, "employment status", "employment"), "Student");
  });

  test("only falls back to the broader needle when the specific one matches nothing", () => {
    const flat = new Map([
      ["current employment type", "Self-employed"],
      ["nationality", "Indian"],
    ]);
    assert.equal(findAnswer(flat, "employment status", "employment"), "Self-employed");
  });

  test("skips a matching question with a blank answer and keeps looking for another match on the same needle", () => {
    const flat = new Map([
      ["employment status (draft)", ""],
      ["employment status", "Employed"],
    ]);
    assert.equal(findAnswer(flat, "employment status"), "Employed");
  });

  test("returns null when no substring matches anything", () => {
    const flat = new Map([["nationality", "Indian"]]);
    assert.equal(findAnswer(flat, "employment status", "employment"), null);
  });
});

describe("flattenAdditionalRequirements", () => {
  test("flattens nested and table answers into a single lowercased lookup", () => {
    const flat = flattenAdditionalRequirements([
      {
        sectionName: "Basic details",
        responses: [
          { question: "Employment status", answer: "Student", answerType: "dropdown" },
          {
            question: "Do you have a laptop?",
            answer: "No",
            answerType: "dropdown",
            nestedAnswers: [{ question: "Laptop is essential", answer: null, answerType: "typography" }],
          },
        ],
      },
    ]);
    assert.equal(flat.get("employment status"), "Student");
    assert.equal(flat.get("do you have a laptop?"), "No");
  });
});
