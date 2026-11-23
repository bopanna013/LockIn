import { describe, expect, it } from "vitest";
import {
  computeDimensionScores,
  DISCOVERY_QUESTIONS,
  rankBranchesForStudent,
  RECOMMENDATION_ALGORITHM_VERSION,
  type BranchCandidate,
} from "./engine";

const SAMPLE_CANDIDATES: BranchCandidate[] = [
  {
    slug: "computer-science-engineering",
    code: "CSE",
    title: "Computer Science and Engineering (CSE)",
    category: "Computing & Information",
    fitWeights: {
      programmingAndAlgorithms: 95,
      electronicsAndHardware: 40,
      physicsAndMechanics: 20,
      chemistryAndMaterials: 10,
      biologyAndLifeSciences: 10,
      mathematicsAndModeling: 85,
      designAndInfrastructure: 65,
    },
  },
  {
    slug: "electronics-communication-engineering",
    code: "ECE",
    title: "Electronics and Communication Engineering (ECE)",
    category: "Electronics & Electrical",
    fitWeights: {
      programmingAndAlgorithms: 65,
      electronicsAndHardware: 98,
      physicsAndMechanics: 70,
      chemistryAndMaterials: 25,
      biologyAndLifeSciences: 15,
      mathematicsAndModeling: 85,
      designAndInfrastructure: 55,
    },
  },
  {
    slug: "chemical-engineering",
    code: "CHEM",
    title: "Chemical Engineering",
    category: "Process, Energy & Materials",
    fitWeights: {
      programmingAndAlgorithms: 35,
      electronicsAndHardware: 25,
      physicsAndMechanics: 75,
      chemistryAndMaterials: 98,
      biologyAndLifeSciences: 45,
      mathematicsAndModeling: 80,
      designAndInfrastructure: 60,
    },
  },
];

describe("recommendation engine", () => {
  it("normalizes 1..5 Likert answers into 0..100 dimension scores", () => {
    const allFives = Object.fromEntries(DISCOVERY_QUESTIONS.map((q) => [q.id, 5]));
    const scores = computeDimensionScores(allFives);
    expect(scores.programmingAndAlgorithms).toBe(100);
    expect(scores.chemistryAndMaterials).toBe(100);

    const allOnes = Object.fromEntries(DISCOVERY_QUESTIONS.map((q) => [q.id, 1]));
    expect(computeDimensionScores(allOnes).programmingAndAlgorithms).toBe(0);
  });

  it("ranks CSE first for a coding + math oriented student and produces an explanation", () => {
    const scores = computeDimensionScores({
      q_prog_1: 5,
      q_prog_2: 5,
      q_math_1: 5,
      q_math_2: 5,
      q_elec_1: 2,
      q_elec_2: 2,
      q_phys_1: 2,
      q_phys_2: 1,
      q_chem_1: 1,
      q_chem_2: 1,
      q_bio_1: 1,
      q_bio_2: 1,
      q_des_1: 3,
      q_des_2: 4,
    });

    const result = rankBranchesForStudent(scores, SAMPLE_CANDIDATES);
    expect(result.algorithmVersion).toBe(RECOMMENDATION_ALGORITHM_VERSION);
    expect(result.rankedBranches[0]?.branchCode).toBe("CSE");
    expect(result.rankedBranches[0]?.explanation).toContain("Matched because");
  });

  it("ranks Chemical Engineering first for a chemistry + physics oriented student", () => {
    const scores = computeDimensionScores({
      q_chem_1: 5,
      q_chem_2: 5,
      q_phys_1: 4,
      q_phys_2: 5,
      q_math_1: 4,
      q_math_2: 4,
      q_prog_1: 1,
      q_prog_2: 1,
      q_elec_1: 1,
      q_elec_2: 1,
      q_bio_1: 3,
      q_bio_2: 3,
      q_des_1: 3,
      q_des_2: 3,
    });

    const result = rankBranchesForStudent(scores, SAMPLE_CANDIDATES);
    expect(result.rankedBranches[0]?.branchCode).toBe("CHEM");
  });

  it("is 100% deterministic for identical inputs", () => {
    const scores = computeDimensionScores({ q_elec_1: 5, q_elec_2: 5, q_math_1: 5 });
    const run1 = rankBranchesForStudent(scores, SAMPLE_CANDIDATES);
    const run2 = rankBranchesForStudent(scores, SAMPLE_CANDIDATES);
    expect(run1).toEqual(run2);
  });
});
