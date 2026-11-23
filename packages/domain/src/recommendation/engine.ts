export const RECOMMENDATION_ALGORITHM_VERSION = "2026.11-v1.0.0";

export const FIT_DIMENSIONS = [
  "programmingAndAlgorithms",
  "electronicsAndHardware",
  "physicsAndMechanics",
  "chemistryAndMaterials",
  "biologyAndLifeSciences",
  "mathematicsAndModeling",
  "designAndInfrastructure",
] as const;

export type FitDimension = (typeof FIT_DIMENSIONS)[number];

export type DimensionVector = Readonly<Record<FitDimension, number>>;

export interface DiscoveryQuestion {
  id: string;
  dimension: FitDimension;
  prompt: string;
  helperText: string;
}

/**
 * 14-question engineering interest & aptitude questionnaire (2 questions per dimension,
 * answered on a 1–5 Likert scale: 1 = Not interested, 5 = Strongly enjoys / excels).
 */
export const DISCOVERY_QUESTIONS: readonly DiscoveryQuestion[] = [
  {
    id: "q_prog_1",
    dimension: "programmingAndAlgorithms",
    prompt: "Writing code, debugging logic puzzles, and automating tasks on a computer.",
    helperText:
      "Think of Python/C++ programming, competitive coding, or building apps and scripts.",
  },
  {
    id: "q_prog_2",
    dimension: "programmingAndAlgorithms",
    prompt: "Designing software systems, databases, or distributed cloud services.",
    helperText: "How data flows across networks, servers, APIs, and large software platforms.",
  },
  {
    id: "q_elec_1",
    dimension: "electronicsAndHardware",
    prompt:
      "Working with electronic circuits, microcontrollers (Arduino/ESP32), sensors, and PCBs.",
    helperText: "Hands-on hardware, embedded firmware, and digital logic gates.",
  },
  {
    id: "q_elec_2",
    dimension: "electronicsAndHardware",
    prompt:
      "Understanding how semiconductor chips (VLSI), wireless 5G/6G signals, or EV power systems work.",
    helperText:
      "Transistors, signal processing, communication waves, and electrical power conversion.",
  },
  {
    id: "q_phys_1",
    dimension: "physicsAndMechanics",
    prompt: "Applying classical mechanics, forces, motion, and kinematics to physical machines.",
    helperText:
      "How engines, robots, vehicles, aircraft, and mechanical linkages move and carry load.",
  },
  {
    id: "q_phys_2",
    dimension: "physicsAndMechanics",
    prompt: "Studying thermodynamics, heat transfer, fluid dynamics, or aerodynamics.",
    helperText: "Energy conversion, jet/rocket propulsion, HVAC, and fluid flow around structures.",
  },
  {
    id: "q_chem_1",
    dimension: "chemistryAndMaterials",
    prompt:
      "Exploring chemical reactions, reaction kinetics, and transforming raw materials at scale.",
    helperText:
      "Industrial process engineering, green hydrogen, refineries, polymers, and specialty chemicals.",
  },
  {
    id: "q_chem_2",
    dimension: "chemistryAndMaterials",
    prompt: "Developing advanced materials, battery electrochemistry, or composite alloys.",
    helperText: "Material science, energy storage cells, corrosion, and nano-materials.",
  },
  {
    id: "q_bio_1",
    dimension: "biologyAndLifeSciences",
    prompt: "Studying molecular biology, genetics, biochemistry, and living cellular systems.",
    helperText: "DNA/RNA, fermentation, bioprocess engineering, and medical diagnostics.",
  },
  {
    id: "q_bio_2",
    dimension: "biologyAndLifeSciences",
    prompt: "Combining computing or engineering with healthcare, vaccines, and bioinformatics.",
    helperText: "Genomic data analysis, biopharmaceuticals, and biomedical devices.",
  },
  {
    id: "q_math_1",
    dimension: "mathematicsAndModeling",
    prompt:
      "Solving calculus, linear algebra (matrices), differential equations, and optimization problems.",
    helperText: "Mathematical proofs, numerical methods, and quantitative modeling.",
  },
  {
    id: "q_math_2",
    dimension: "mathematicsAndModeling",
    prompt: "Working with probability, statistics, and data-driven predictive models.",
    helperText: "Statistical inference, machine learning foundations, and stochastic systems.",
  },
  {
    id: "q_des_1",
    dimension: "designAndInfrastructure",
    prompt:
      "Designing large-scale physical infrastructure, bridges, metro rail, or sustainable cities.",
    helperText:
      "Structural engineering, urban planning, geotechnical systems, and water resources.",
  },
  {
    id: "q_des_2",
    dimension: "designAndInfrastructure",
    prompt:
      "Using 3D CAD, structural simulation, or systems architecture to plan complex projects.",
    helperText: "Turning blueprints and specifications into reliable real-world systems.",
  },
];

export const DIMENSION_LABELS: Readonly<Record<FitDimension, string>> = {
  programmingAndAlgorithms: "Programming & Software Systems",
  electronicsAndHardware: "Electronics, VLSI & Hardware",
  physicsAndMechanics: "Physics, Mechanics & Thermal Sciences",
  chemistryAndMaterials: "Chemistry, Process & Materials",
  biologyAndLifeSciences: "Biology, Bioprocess & Life Sciences",
  mathematicsAndModeling: "Mathematics, Statistics & Modeling",
  designAndInfrastructure: "Systems Design & Infrastructure",
};

/**
 * Convert raw 1–5 Likert answers keyed by question ID into a normalized 0–100 score
 * for each of the 7 engineering dimensions.
 */
export function computeDimensionScores(answers: Readonly<Record<string, number>>): DimensionVector {
  const sums: Record<FitDimension, { total: number; count: number }> = {
    programmingAndAlgorithms: { total: 0, count: 0 },
    electronicsAndHardware: { total: 0, count: 0 },
    physicsAndMechanics: { total: 0, count: 0 },
    chemistryAndMaterials: { total: 0, count: 0 },
    biologyAndLifeSciences: { total: 0, count: 0 },
    mathematicsAndModeling: { total: 0, count: 0 },
    designAndInfrastructure: { total: 0, count: 0 },
  };

  for (const q of DISCOVERY_QUESTIONS) {
    const raw = answers[q.id];
    const clamped =
      typeof raw === "number" && Number.isFinite(raw) ? Math.min(5, Math.max(1, raw)) : 3;
    // Map 1..5 -> 0..100
    const normalized = ((clamped - 1) / 4) * 100;
    sums[q.dimension].total += normalized;
    sums[q.dimension].count += 1;
  }

  const vector = {} as Record<FitDimension, number>;
  for (const dim of FIT_DIMENSIONS) {
    const { total, count } = sums[dim];
    vector[dim] = count > 0 ? Math.round(total / count) : 50;
  }
  return vector;
}

export interface BranchCandidate {
  slug: string;
  code: string;
  title: string;
  category: string;
  fitWeights: DimensionVector;
}

export interface RankedBranchRecommendation {
  rank: number;
  branchSlug: string;
  branchCode: string;
  branchTitle: string;
  category: string;
  fitScore: number; // 0..100
  topMatchingDimensions: {
    dimension: FitDimension;
    label: string;
    studentScore: number;
    branchWeight: number;
  }[];
  explanation: string;
}

export interface RecommendationResult {
  algorithmVersion: string;
  dimensionScores: DimensionVector;
  rankedBranches: RankedBranchRecommendation[];
}

/**
 * Pure, deterministic, explainable branch-fit recommendation algorithm.
 *
 * Combines weighted affinity (how strongly the student scored on the branch's primary
 * dimensions) with cosine similarity (overall shape alignment across all 7 dimensions)
 * so both high-intensity specialists and balanced generalists get accurate rankings.
 */
export function rankBranchesForStudent(
  dimensionScores: DimensionVector,
  candidates: readonly BranchCandidate[],
): RecommendationResult {
  const scored = candidates.map((branch) => {
    let weightedDot = 0;
    let branchWeightSum = 0;
    let studentMagSq = 0;
    let branchMagSq = 0;

    const contributions: {
      dimension: FitDimension;
      label: string;
      studentScore: number;
      branchWeight: number;
      product: number;
    }[] = [];

    for (const dim of FIT_DIMENSIONS) {
      const s = dimensionScores[dim];
      const w = branch.fitWeights[dim];
      weightedDot += s * w;
      branchWeightSum += w;
      studentMagSq += s * s;
      branchMagSq += w * w;
      contributions.push({
        dimension: dim,
        label: DIMENSION_LABELS[dim],
        studentScore: s,
        branchWeight: w,
        product: s * w,
      });
    }

    const weightedAverage = branchWeightSum > 0 ? weightedDot / branchWeightSum : 50;
    const cosine =
      studentMagSq > 0 && branchMagSq > 0
        ? (weightedDot / (Math.sqrt(studentMagSq) * Math.sqrt(branchMagSq))) * 100
        : 50;

    // 65% weighted affinity on what the branch cares about most + 35% directional cosine alignment
    const rawFit = 0.65 * weightedAverage + 0.35 * cosine;
    const fitScore = Math.max(0, Math.min(100, Math.round(rawFit)));

    contributions.sort((a, b) => b.product - a.product);
    const topMatchingDimensions = contributions
      .slice(0, 3)
      .map(({ dimension, label, studentScore, branchWeight }) => ({
        dimension,
        label,
        studentScore,
        branchWeight,
      }));

    const topLabels = topMatchingDimensions
      .slice(0, 2)
      .map((d) => `${d.label} (${d.studentScore}%)`);
    const explanation = `Matched because your strongest alignment is in ${topLabels.join(" and ")}, which are core pillars of ${branch.title}.`;

    return {
      branchSlug: branch.slug,
      branchCode: branch.code,
      branchTitle: branch.title,
      category: branch.category,
      fitScore,
      topMatchingDimensions,
      explanation,
    };
  });

  scored.sort((a, b) => b.fitScore - a.fitScore || a.branchCode.localeCompare(b.branchCode));

  return {
    algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    dimensionScores,
    rankedBranches: scored.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    })),
  };
}
