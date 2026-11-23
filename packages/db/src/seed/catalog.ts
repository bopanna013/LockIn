import { sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  branches,
  branchTranslations,
  contentReleases,
  entranceExams,
  entranceExamTranslations,
  roadmapTemplates,
  type BranchFitWeights,
  type RoadmapTemplateMilestone,
} from "../schema";

interface ExamSeed {
  slug: string;
  shortName: string;
  level: string;
  conductingBody: string;
  typicalMonth: string;
  officialUrl: string;
  fullName: string;
  summary: string;
  eligibilitySummary: string;
}

const EXAMS: readonly ExamSeed[] = [
  {
    slug: "jee-main",
    shortName: "JEE Main",
    level: "National",
    conductingBody: "National Testing Agency (NTA)",
    typicalMonth: "January & April",
    officialUrl: "https://jeemain.nta.nic.in",
    fullName: "Joint Entrance Examination (Main)",
    summary:
      "National-level entrance exam for admission to NITs, IIITs, GFTIs, and the qualifying test for JEE Advanced.",
    eligibilitySummary:
      "Class 12 / 2nd PUC pass or appearing with Physics, Mathematics, and Chemistry/Computer Science.",
  },
  {
    slug: "jee-advanced",
    shortName: "JEE Advanced",
    level: "National",
    conductingBody: "Indian Institutes of Technology (IITs)",
    typicalMonth: "May",
    officialUrl: "https://jeeadv.ac.in",
    fullName: "Joint Entrance Examination (Advanced)",
    summary: "Gateway examination for B.Tech, BS, and Dual Degree admissions across all 23 IITs.",
    eligibilitySummary:
      "Top ~2,50,000 qualifiers of JEE Main Paper 1 meeting Class 12 percentile/marks criteria.",
  },
  {
    slug: "kcet",
    shortName: "KCET",
    level: "State (Karnataka)",
    conductingBody: "Karnataka Examinations Authority (KEA)",
    typicalMonth: "April",
    officialUrl: "https://cetonline.karnataka.gov.in/kea",
    fullName: "Karnataka Common Entrance Test",
    summary:
      "State-level entrance test for government-quota B.E./B.Tech seats across engineering colleges in Karnataka.",
    eligibilitySummary:
      "2nd PUC / Class 12 with Physics and Mathematics, meeting Karnataka domicile/study clauses.",
  },
  {
    slug: "comedk",
    shortName: "COMEDK UGET",
    level: "All-India Private (Karnataka)",
    conductingBody: "Consortium of Medical, Engineering and Dental Colleges of Karnataka",
    typicalMonth: "May",
    officialUrl: "https://www.comedk.org",
    fullName: "COMEDK Undergraduate Entrance Test",
    summary:
      "All-India computer-based entrance exam for private unaided engineering colleges in Karnataka.",
    eligibilitySummary:
      "Class 12 / 2nd PUC with Physics, Chemistry, and Mathematics (open to students across India).",
  },
  {
    slug: "bitsat",
    shortName: "BITSAT",
    level: "University (All-India)",
    conductingBody: "BITS Pilani",
    typicalMonth: "May & June",
    officialUrl: "https://www.bitsadmission.com",
    fullName: "BITS Admission Test",
    summary:
      "Online admission test for B.E. programmes at BITS Pilani, Goa, and Hyderabad campuses.",
    eligibilitySummary:
      "Class 12 with PCM and minimum 75% aggregate in Physics, Chemistry, and Mathematics.",
  },
];

interface BranchSeed {
  slug: string;
  code: string;
  category: string;
  displayOrder: number;
  entrySalaryMinInr: number;
  entrySalaryMaxInr: number;
  midCareerSalaryMaxInr: number;
  fitWeights: BranchFitWeights;
  entranceExamSlugs: string[];
  title: string;
  shortSummary: string;
  overview: string;
  whoItSuits: string;
  coreSubjects: string[];
  keySkills: string[];
  careerRoles: string[];
  topRecruitersIndia: string[];
  higherStudiesPaths: string[];
}

function buildStandardRoadmapMilestones(
  branchCode: string,
  coreSubjectFocus: string,
): RoadmapTemplateMilestone[] {
  return [
    {
      code: `${branchCode}-S1-FOUND`,
      semester: 1,
      category: "academics",
      title: "Engineering Mathematics I, Physics/Chemistry & Programming Foundations",
      description:
        "Build strong first-year fundamentals in calculus, linear algebra, and structured programming in C/Python.",
      estimatedHours: 60,
    },
    {
      code: `${branchCode}-S2-TOOLS`,
      semester: 2,
      category: "skills",
      title: "Git, Linux CLI, CAD/Simulation & Technical Documentation",
      description:
        "Master version control, command-line workflows, and foundational lab/simulation tools for your branch.",
      estimatedHours: 40,
    },
    {
      code: `${branchCode}-S3-CORE`,
      semester: 3,
      category: "academics",
      title: `Core Department Immersion: ${coreSubjectFocus}`,
      description:
        "Transition from common first-year courses into core departmental theory and laboratory problem solving.",
      estimatedHours: 80,
    },
    {
      code: `${branchCode}-S4-MINI`,
      semester: 4,
      category: "projects",
      title: "End-to-End Sophmore Mini-Project & Open-Source / Lab Contribution",
      description:
        "Design, build, test, and document a working prototype or software/hardware system solving a real problem.",
      estimatedHours: 65,
    },
    {
      code: `${branchCode}-S5-COMP`,
      semester: 5,
      category: "competitions",
      title: "National Hackathon / Smart India Hackathon / SAE / IEEE Technical Contest",
      description:
        "Compete in a national engineering challenge or publish a technical working paper with faculty mentorship.",
      estimatedHours: 55,
    },
    {
      code: `${branchCode}-S6-INTERN`,
      semester: 6,
      category: "internships",
      title: "Summer Industry or Research Internship (8–10 Weeks)",
      description:
        "Secure and complete an internship at an Indian R&D lab (IISc/IIT/CSIR/DRDO) or industry engineering team.",
      estimatedHours: 240,
    },
    {
      code: `${branchCode}-S7-CAPSTONE`,
      semester: 7,
      category: "higher_studies",
      title: "Campus Placement Prep / GATE Exam Readiness & Capstone Phase I",
      description:
        "Execute mock technical interviews or full-length GATE mock tests while completing Capstone architecture.",
      estimatedHours: 100,
    },
    {
      code: `${branchCode}-S8-LAUNCH`,
      semester: 8,
      category: "projects",
      title: "Final B.E./B.Tech Capstone Defense & Industry Transition",
      description:
        "Deliver production-grade final year project defense, technical thesis, and transition to full-time role or M.Tech/MS.",
      estimatedHours: 120,
    },
  ];
}

const BRANCHES: readonly BranchSeed[] = [
  {
    slug: "computer-science-engineering",
    code: "CSE",
    category: "Computing & Information",
    displayOrder: 10,
    entrySalaryMinInr: 600000,
    entrySalaryMaxInr: 1800000,
    midCareerSalaryMaxInr: 4200000,
    fitWeights: {
      programmingAndAlgorithms: 95,
      electronicsAndHardware: 40,
      physicsAndMechanics: 20,
      chemistryAndMaterials: 10,
      biologyAndLifeSciences: 10,
      mathematicsAndModeling: 85,
      designAndInfrastructure: 65,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Computer Science and Engineering (CSE)",
    shortSummary:
      "Algorithms, software systems, operating systems, databases, computer networks, and distributed computing.",
    overview:
      "Computer Science and Engineering focuses on the mathematical foundations of computation and the engineering of reliable, high-performance software and distributed systems.",
    whoItSuits:
      "Students who enjoy logical problem-solving, discrete mathematics, building software applications, and understanding how computers and networks work under the hood.",
    coreSubjects: [
      "Data Structures & Algorithms",
      "Operating Systems",
      "Database Management Systems",
      "Computer Networks",
      "Computer Architecture",
      "Compiler Design",
    ],
    keySkills: [
      "Algorithms & Problem Solving",
      "System Design",
      "Backend & Cloud Engineering",
      "Databases & SQL",
    ],
    careerRoles: [
      "Software Development Engineer (SDE)",
      "Systems Architect",
      "Site Reliability Engineer",
      "Security Engineer",
    ],
    topRecruitersIndia: [
      "Google India",
      "Microsoft IDC",
      "Flipkart",
      "Zoho",
      "Razorpay",
      "TCS Research",
      "Infosys",
    ],
    higherStudiesPaths: [
      "GATE CS -> M.Tech at IITs/IISc",
      "MS in Computer Science",
      "Direct PhD in Computing",
    ],
  },
  {
    slug: "information-science-engineering",
    code: "ISE",
    category: "Computing & Information",
    displayOrder: 20,
    entrySalaryMinInr: 550000,
    entrySalaryMaxInr: 1600000,
    midCareerSalaryMaxInr: 3800000,
    fitWeights: {
      programmingAndAlgorithms: 90,
      electronicsAndHardware: 25,
      physicsAndMechanics: 15,
      chemistryAndMaterials: 10,
      biologyAndLifeSciences: 15,
      mathematicsAndModeling: 80,
      designAndInfrastructure: 75,
    },
    entranceExamSlugs: ["jee-main", "kcet", "comedk"],
    title: "Information Science and Engineering (ISE / IT)",
    shortSummary:
      "Enterprise software engineering, information systems, cloud infrastructure, data engineering, and cybersecurity.",
    overview:
      "Information Science and Engineering (popular across VTU/Karnataka and as IT nationally) bridges core computer science with large-scale information storage, retrieval, enterprise architecture, and cloud platforms.",
    whoItSuits:
      "Students who love building full-stack products, designing data pipelines, securing enterprise networks, and translating business problems into software systems.",
    coreSubjects: [
      "Data Structures & Algorithms",
      "Software Engineering & Architecture",
      "Database & Data Warehousing",
      "Cloud Computing & Distributed Systems",
      "Information & Network Security",
      "Web & API Engineering",
    ],
    keySkills: [
      "Full-Stack Software Engineering",
      "Cloud & DevOps",
      "Data Engineering",
      "Information Security",
    ],
    careerRoles: [
      "Full-Stack Engineer",
      "Cloud Platform Engineer",
      "Data Engineer",
      "Cybersecurity Analyst",
    ],
    topRecruitersIndia: [
      "Atlassian Bengaluru",
      "Cisco",
      "Walmart Global Tech",
      "PhonePe",
      "Wipro",
      "Cognizant",
    ],
    higherStudiesPaths: [
      "GATE CS/DA -> M.Tech in Software/Data Systems",
      "MS in Information Systems",
      "MBA in Tech Management",
    ],
  },
  {
    slug: "artificial-intelligence-machine-learning",
    code: "AIML",
    category: "Computing & Information",
    displayOrder: 30,
    entrySalaryMinInr: 650000,
    entrySalaryMaxInr: 2000000,
    midCareerSalaryMaxInr: 4500000,
    fitWeights: {
      programmingAndAlgorithms: 90,
      electronicsAndHardware: 30,
      physicsAndMechanics: 25,
      chemistryAndMaterials: 10,
      biologyAndLifeSciences: 25,
      mathematicsAndModeling: 98,
      designAndInfrastructure: 55,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk"],
    title: "Artificial Intelligence & Machine Learning (AI & ML / Data Science)",
    shortSummary:
      "Probability, linear algebra, statistical learning, deep neural networks, computer vision, and NLP.",
    overview:
      "AI & ML combines core computer science with deep mathematical foundations in linear algebra, probability, optimization, and statistical modeling to build intelligent systems.",
    whoItSuits:
      "Students who genuinely enjoy mathematics (calculus, matrices, probability) alongside Python/C++ programming and data experimentation.",
    coreSubjects: [
      "Linear Algebra & Optimization",
      "Probability & Statistical Inference",
      "Machine Learning",
      "Deep Learning & Neural Networks",
      "Natural Language Processing",
      "Computer Vision",
    ],
    keySkills: [
      "PyTorch / TensorFlow",
      "Statistical Modeling",
      "MLOps & Model Deployment",
      "Data Structures & Algorithms",
    ],
    careerRoles: [
      "Machine Learning Engineer",
      "Applied AI Scientist",
      "Data Scientist",
      "MLOps Engineer",
    ],
    topRecruitersIndia: [
      "Sarvam AI",
      "Krutrim",
      "Google DeepMind India",
      "Microsoft Research India",
      "Amazon",
      "Swiggy",
    ],
    higherStudiesPaths: [
      "GATE DA -> M.Tech AI at IISc/IITs",
      "MS/PhD in Machine Learning & Data Science",
    ],
  },
  {
    slug: "electronics-communication-engineering",
    code: "ECE",
    category: "Electronics & Electrical",
    displayOrder: 40,
    entrySalaryMinInr: 550000,
    entrySalaryMaxInr: 1800000,
    midCareerSalaryMaxInr: 4000000,
    fitWeights: {
      programmingAndAlgorithms: 65,
      electronicsAndHardware: 98,
      physicsAndMechanics: 70,
      chemistryAndMaterials: 25,
      biologyAndLifeSciences: 15,
      mathematicsAndModeling: 85,
      designAndInfrastructure: 55,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Electronics and Communication Engineering (ECE)",
    shortSummary:
      "VLSI chip design, embedded systems, digital signal processing, wireless 5G/6G communications, and IoT.",
    overview:
      "ECE powers India's rapidly growing semiconductor and hardware ecosystem — spanning transistor-level VLSI chip design, embedded firmware, signal processing, and high-speed communication networks.",
    whoItSuits:
      "Students curious about how microchips, smartphones, satellites, and embedded sensors work, and who want flexibility across hardware, VLSI, and embedded software.",
    coreSubjects: [
      "Analog & Digital Electronics",
      "Signals and Systems",
      "VLSI Design & CMOS Technology",
      "Microcontrollers & Embedded Systems",
      "Digital Signal Processing",
      "Electromagnetics & Communication Systems",
    ],
    keySkills: [
      "Verilog / SystemVerilog & RTL Design",
      "Embedded C & RTOS",
      "Circuit Analysis & PCB Design",
      "Signal Processing",
    ],
    careerRoles: [
      "VLSI / ASIC Design Engineer",
      "Embedded Firmware Engineer",
      "RF & Wireless Engineer",
      "Hardware Verification Engineer",
    ],
    topRecruitersIndia: [
      "Texas Instruments India",
      "Qualcomm",
      "Intel",
      "MediaTek",
      "Nvidia",
      "BEL",
      "ISRO",
    ],
    higherStudiesPaths: [
      "GATE EC -> M.Tech in Microelectronics & VLSI",
      "MS in Electrical & Computer Engineering",
    ],
  },
  {
    slug: "electrical-electronics-engineering",
    code: "EEE",
    category: "Electronics & Electrical",
    displayOrder: 50,
    entrySalaryMinInr: 500000,
    entrySalaryMaxInr: 1400000,
    midCareerSalaryMaxInr: 3200000,
    fitWeights: {
      programmingAndAlgorithms: 50,
      electronicsAndHardware: 90,
      physicsAndMechanics: 80,
      chemistryAndMaterials: 25,
      biologyAndLifeSciences: 10,
      mathematicsAndModeling: 80,
      designAndInfrastructure: 65,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Electrical and Electronics Engineering (EEE)",
    shortSummary:
      "Power electronics, electric vehicle (EV) drivetrains, renewable energy grids, control systems, and machines.",
    overview:
      "EEE combines high-power electrical systems, smart renewable grids, and electric vehicle powertrains with modern analog/digital electronics and automated control systems.",
    whoItSuits:
      "Students drawn to electromagnetism, EVs, renewable solar/wind grids, robotics control, and core public-sector or industrial engineering.",
    coreSubjects: [
      "Electrical Machines",
      "Power Systems & Smart Grids",
      "Power Electronics & EV Drives",
      "Control Systems Engineering",
      "Analog & Digital Circuits",
      "High Voltage & Instrumentation",
    ],
    keySkills: [
      "MATLAB / Simulink",
      "Power Electronics & BMS",
      "PLC & Industrial Control",
      "Embedded Microcontrollers",
    ],
    careerRoles: [
      "EV Powertrain & Battery Engineer",
      "Power Systems Engineer",
      "Control & Automation Engineer",
      "PSU Executive Trainee",
    ],
    topRecruitersIndia: [
      "Ather Energy",
      "Ola Electric",
      "Tata Power",
      "Schneider Electric",
      "ABB",
      "Siemens",
      "NTPC",
      "PGCIL",
    ],
    higherStudiesPaths: [
      "GATE EE -> PSU Recruitment or M.Tech Power Electronics",
      "MS in Sustainable Energy & e-Mobility",
    ],
  },
  {
    slug: "mechanical-engineering",
    code: "MECH",
    category: "Core & Manufacturing",
    displayOrder: 60,
    entrySalaryMinInr: 450000,
    entrySalaryMaxInr: 1300000,
    midCareerSalaryMaxInr: 3000000,
    fitWeights: {
      programmingAndAlgorithms: 40,
      electronicsAndHardware: 55,
      physicsAndMechanics: 98,
      chemistryAndMaterials: 60,
      biologyAndLifeSciences: 15,
      mathematicsAndModeling: 80,
      designAndInfrastructure: 85,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Mechanical Engineering",
    shortSummary:
      "Thermodynamics, robotics & mechatronics, automotive systems, CAD/FEA simulation, and advanced manufacturing.",
    overview:
      "Mechanical Engineering is the broadest physical engineering discipline — covering mechanics, thermal sciences, robotics, fluid dynamics, and computer-aided manufacturing.",
    whoItSuits:
      "Students who love classical physics (mechanics, heat, motion), designing physical machines in 3D CAD, automotive/robotics systems, and hands-on prototyping.",
    coreSubjects: [
      "Engineering Mechanics & Strength of Materials",
      "Thermodynamics & Heat Transfer",
      "Fluid Mechanics",
      "Theory of Machines & Kinematics",
      "CAD/CAM & Finite Element Analysis (FEA)",
      "Robotics & Mechatronics",
    ],
    keySkills: [
      "SolidWorks / CATIA / AutoCAD",
      "ANSYS FEA & CFD Simulation",
      "Thermodynamics & HVAC",
      "Manufacturing & Robotics",
    ],
    careerRoles: [
      "Mechanical Design Engineer",
      "CAE / CFD Simulation Engineer",
      "Robotics & Mechatronics Engineer",
      "Automotive R&D Engineer",
    ],
    topRecruitersIndia: [
      "Tata Motors",
      "Mahindra & Mahindra",
      "L&T",
      "Bajaj Auto",
      "Bosch India",
      "DRDO",
      "BHEL",
      "GE Aerospace",
    ],
    higherStudiesPaths: [
      "GATE ME -> PSUs (ONGC, IOCL, BHEL) or M.Tech Thermal/Design",
      "MS in Robotics or Automotive Engineering",
    ],
  },
  {
    slug: "civil-engineering",
    code: "CIVIL",
    category: "Infrastructure & Environment",
    displayOrder: 70,
    entrySalaryMinInr: 420000,
    entrySalaryMaxInr: 1100000,
    midCareerSalaryMaxInr: 2800000,
    fitWeights: {
      programmingAndAlgorithms: 25,
      electronicsAndHardware: 20,
      physicsAndMechanics: 90,
      chemistryAndMaterials: 55,
      biologyAndLifeSciences: 20,
      mathematicsAndModeling: 75,
      designAndInfrastructure: 98,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Civil Engineering",
    shortSummary:
      "Structural engineering, metro/highway transportation, geotechnical mechanics, water resources, and smart cities.",
    overview:
      "Civil Engineering designs, analyzes, and builds the physical backbone of society — bridges, metro rail corridors, earthquake-resistant high-rises, dams, and sustainable water infrastructure.",
    whoItSuits:
      "Students excited by large-scale infrastructure, structural mechanics, urban planning, and prestigious engineering services (IES / State PWD / Metro projects).",
    coreSubjects: [
      "Structural Analysis & RCC Design",
      "Geotechnical & Foundation Engineering",
      "Transportation & Metro Engineering",
      "Fluid Mechanics & Water Resources",
      "Environmental Engineering",
      "Building Information Modeling (BIM) & Surveying",
    ],
    keySkills: [
      "STAAD.Pro / ETABS Structural Analysis",
      "BIM (Revit) & AutoCAD",
      "Project & Construction Management",
      "Geotechnical Design",
    ],
    careerRoles: [
      "Structural Design Engineer",
      "Transportation & Infrastructure Planner",
      "BIM Coordinator",
      "IES / CPWD / PSU Civil Engineer",
    ],
    topRecruitersIndia: [
      "L&T Construction",
      "Afcons",
      "Tata Projects",
      "WSP",
      "AECOM",
      "NHAI",
      "RITES",
      "NBCC",
    ],
    higherStudiesPaths: [
      "GATE CE / UPSC ESE (IES)",
      "M.Tech in Structural or Transportation Engineering",
      "NICMAR Construction Management",
    ],
  },
  {
    slug: "chemical-engineering",
    code: "CHEM",
    category: "Process, Energy & Materials",
    displayOrder: 80,
    entrySalaryMinInr: 500000,
    entrySalaryMaxInr: 1400000,
    midCareerSalaryMaxInr: 3200000,
    fitWeights: {
      programmingAndAlgorithms: 35,
      electronicsAndHardware: 25,
      physicsAndMechanics: 75,
      chemistryAndMaterials: 98,
      biologyAndLifeSciences: 45,
      mathematicsAndModeling: 80,
      designAndInfrastructure: 60,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk", "bitsat"],
    title: "Chemical Engineering",
    shortSummary:
      "Process engineering, reaction kinetics, green hydrogen & battery materials, pharmaceuticals, and petrochemicals.",
    overview:
      "Chemical Engineering transforms raw materials into clean energy, battery cells, pharmaceuticals, polymers, and specialty chemicals at industrial scale using thermodynamics, transport phenomena, and reaction engineering.",
    whoItSuits:
      "Students who enjoy chemistry combined with physics, differential equations, industrial process simulation, and green energy/sustainability.",
    coreSubjects: [
      "Chemical Reaction Engineering",
      "Mass & Heat Transfer Operations",
      "Chemical Engineering Thermodynamics",
      "Fluid Mechanics & Particle Technology",
      "Process Dynamics & Control",
      "Plant Design & Process Economics",
    ],
    keySkills: [
      "Aspen Plus / HYSYS Process Simulation",
      "Reaction & Process Safety Design",
      "Thermodynamics & Transport Modeling",
    ],
    careerRoles: [
      "Process Design Engineer",
      "Green Energy & Battery Materials Engineer",
      "Pharmaceutical Process Engineer",
      "PSU Refinery Engineer",
    ],
    topRecruitersIndia: [
      "Reliance Industries",
      "IOCL",
      "BPCL",
      "ONGC",
      "Dr. Reddy's",
      "Asian Paints",
      "Hindustan Unilever",
      "Shell",
    ],
    higherStudiesPaths: [
      "GATE CH -> Oil & Gas PSUs or M.Tech Chemical/Materials",
      "MS/PhD in Battery & Sustainable Energy Systems",
    ],
  },
  {
    slug: "biotechnology-engineering",
    code: "BIOTECH",
    category: "Bioengineering & Life Sciences",
    displayOrder: 90,
    entrySalaryMinInr: 420000,
    entrySalaryMaxInr: 1200000,
    midCareerSalaryMaxInr: 2800000,
    fitWeights: {
      programmingAndAlgorithms: 45,
      electronicsAndHardware: 20,
      physicsAndMechanics: 30,
      chemistryAndMaterials: 80,
      biologyAndLifeSciences: 98,
      mathematicsAndModeling: 65,
      designAndInfrastructure: 40,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk"],
    title: "Biotechnology & Bioengineering",
    shortSummary:
      "Bioprocess engineering, bioinformatics, genomics, biopharmaceuticals, and medical diagnostics.",
    overview:
      "Biotechnology Engineering applies engineering design, bioprocess technology, and computational bioinformatics to molecular biology, vaccine production, genomics, and healthcare.",
    whoItSuits:
      "Students fascinated by biology, genetics, pharmaceuticals, and computational biology who want an engineering degree with strong R&D and healthcare impact.",
    coreSubjects: [
      "Molecular Biology & Genetic Engineering",
      "Bioprocess & Fermentation Engineering",
      "Bioinformatics & Computational Biology",
      "Downstream Processing & Purification",
      "Immunology & Biopharmaceuticals",
      "Biochemistry & Enzyme Technology",
    ],
    keySkills: [
      "Bioprocess & Bioreactor Control",
      "Bioinformatics (Python / R)",
      "Molecular Diagnostics & Analytical Techniques",
    ],
    careerRoles: [
      "Bioprocess Engineer",
      "Bioinformatics Scientist",
      "Biopharma R&D Associate",
      "Clinical & Regulatory Analyst",
    ],
    topRecruitersIndia: [
      "Biocon",
      "Serum Institute of India",
      "Bharat Biotech",
      "Syngene",
      "Novozymes",
      "Strand Life Sciences",
    ],
    higherStudiesPaths: [
      "GATE BT / GAT-B -> M.Tech at IITs/IISc",
      "MS/PhD in Bioinformatics, Genomics or Biomedical Engineering",
    ],
  },
  {
    slug: "aerospace-engineering",
    code: "AERO",
    category: "Core & Manufacturing",
    displayOrder: 100,
    entrySalaryMinInr: 550000,
    entrySalaryMaxInr: 1600000,
    midCareerSalaryMaxInr: 3600000,
    fitWeights: {
      programmingAndAlgorithms: 55,
      electronicsAndHardware: 65,
      physicsAndMechanics: 98,
      chemistryAndMaterials: 55,
      biologyAndLifeSciences: 10,
      mathematicsAndModeling: 92,
      designAndInfrastructure: 80,
    },
    entranceExamSlugs: ["jee-main", "jee-advanced", "kcet", "comedk"],
    title: "Aerospace Engineering",
    shortSummary:
      "Aerodynamics, jet & rocket propulsion, flight mechanics, UAV/drone systems, and spacecraft structures.",
    overview:
      "Aerospace Engineering powers aircraft, drones (UAVs), launch vehicles, and satellites — combining fluid aerodynamics, propulsion, lightweight composite structures, and flight guidance control.",
    whoItSuits:
      "Students passionate about aviation, space exploration, ISRO/DRDO missions, private space-tech startups, and advanced fluid/structural physics.",
    coreSubjects: [
      "Aerodynamics & Gas Dynamics",
      "Aircraft & Rocket Propulsion",
      "Aerospace Structures & Composite Materials",
      "Flight Mechanics & Stability Control",
      "Avionics & Navigation Systems",
      "Computational Fluid Dynamics (CFD)",
    ],
    keySkills: [
      "CFD & Wind-Tunnel Analysis",
      "Flight Dynamics & Control (MATLAB)",
      "Aerospace Structural FEA",
      "UAV Systems Design",
    ],
    careerRoles: [
      "Aerodynamics & CFD Engineer",
      "Propulsion Systems Engineer",
      "Flight Control & Avionics Engineer",
      "UAV Systems Engineer",
    ],
    topRecruitersIndia: [
      "ISRO",
      "HAL",
      "DRDO (ADA/ADE)",
      "Skyroot Aerospace",
      "Agnikul Cosmos",
      "Airbus India",
      "Boeing India",
    ],
    higherStudiesPaths: [
      "GATE AE -> M.Tech Aerospace at IITs/IISc",
      "MS in Aeronautics & Astronautics",
    ],
  },
];

export interface SeedContentSummary {
  releaseVersion: number;
  examsCount: number;
  branchesCount: number;
  roadmapsCount: number;
}

/**
 * Idempotently seed the Phase 2 India engineering catalog (release v1, 5 entrance exams,
 * 10 B.E./B.Tech branches, translations, and 8-semester roadmap templates).
 */
export async function seedCatalogContent(db: Database): Promise<SeedContentSummary> {
  const [release] = await db
    .insert(contentReleases)
    .values({
      versionNumber: 1,
      label: "2026.11 Initial India B.E./B.Tech Catalog",
      notes:
        "10 core Indian engineering branches, 5 entrance exams, and 8-semester roadmap templates.",
      publishedByEmail: "system@lockin.home.arpa",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: contentReleases.versionNumber,
      set: {
        label: sql`excluded.label`,
        isActive: true,
      },
    })
    .returning();

  for (const exam of EXAMS) {
    const [examRow] = await db
      .insert(entranceExams)
      .values({
        slug: exam.slug,
        shortName: exam.shortName,
        level: exam.level,
        conductingBody: exam.conductingBody,
        typicalMonth: exam.typicalMonth,
        officialUrl: exam.officialUrl,
        status: "published",
      })
      .onConflictDoUpdate({
        target: entranceExams.slug,
        set: {
          shortName: sql`excluded.short_name`,
          level: sql`excluded.level`,
          conductingBody: sql`excluded.conducting_body`,
          typicalMonth: sql`excluded.typical_month`,
          officialUrl: sql`excluded.official_url`,
          status: sql`excluded.status`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    await db
      .insert(entranceExamTranslations)
      .values({
        examId: examRow!.id,
        locale: "en",
        fullName: exam.fullName,
        summary: exam.summary,
        eligibilitySummary: exam.eligibilitySummary,
      })
      .onConflictDoUpdate({
        target: [entranceExamTranslations.examId, entranceExamTranslations.locale],
        set: {
          fullName: sql`excluded.full_name`,
          summary: sql`excluded.summary`,
          eligibilitySummary: sql`excluded.eligibility_summary`,
          updatedAt: sql`now()`,
        },
      });
  }

  for (const branch of BRANCHES) {
    const [branchRow] = await db
      .insert(branches)
      .values({
        slug: branch.slug,
        code: branch.code,
        category: branch.category,
        displayOrder: branch.displayOrder,
        entrySalaryMinInr: branch.entrySalaryMinInr,
        entrySalaryMaxInr: branch.entrySalaryMaxInr,
        midCareerSalaryMaxInr: branch.midCareerSalaryMaxInr,
        fitWeights: branch.fitWeights,
        entranceExamSlugs: branch.entranceExamSlugs,
        status: "published",
      })
      .onConflictDoUpdate({
        target: branches.slug,
        set: {
          code: sql`excluded.code`,
          category: sql`excluded.category`,
          displayOrder: sql`excluded.display_order`,
          entrySalaryMinInr: sql`excluded.entry_salary_min_inr`,
          entrySalaryMaxInr: sql`excluded.entry_salary_max_inr`,
          midCareerSalaryMaxInr: sql`excluded.mid_career_salary_max_inr`,
          fitWeights: sql`excluded.fit_weights`,
          entranceExamSlugs: sql`excluded.entrance_exam_slugs`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    await db
      .insert(branchTranslations)
      .values({
        branchId: branchRow!.id,
        locale: "en",
        title: branch.title,
        shortSummary: branch.shortSummary,
        overview: branch.overview,
        whoItSuits: branch.whoItSuits,
        coreSubjects: branch.coreSubjects,
        keySkills: branch.keySkills,
        careerRoles: branch.careerRoles,
        topRecruitersIndia: branch.topRecruitersIndia,
        higherStudiesPaths: branch.higherStudiesPaths,
        status: "published",
      })
      .onConflictDoUpdate({
        target: [branchTranslations.branchId, branchTranslations.locale],
        set: {
          title: sql`excluded.title`,
          shortSummary: sql`excluded.short_summary`,
          overview: sql`excluded.overview`,
          whoItSuits: sql`excluded.who_it_suits`,
          coreSubjects: sql`excluded.core_subjects`,
          keySkills: sql`excluded.key_skills`,
          careerRoles: sql`excluded.career_roles`,
          topRecruitersIndia: sql`excluded.top_recruiters_india`,
          higherStudiesPaths: sql`excluded.higher_studies_paths`,
          updatedAt: sql`now()`,
        },
      });

    const milestones = buildStandardRoadmapMilestones(
      branch.code,
      branch.coreSubjects.slice(0, 3).join(", "),
    );

    await db
      .insert(roadmapTemplates)
      .values({
        branchId: branchRow!.id,
        locale: "en",
        releaseId: release!.id,
        title: `${branch.title} — 4-Year (8-Semester) B.E./B.Tech Roadmap`,
        milestones,
        status: "published",
      })
      .onConflictDoUpdate({
        target: [roadmapTemplates.branchId, roadmapTemplates.locale],
        set: {
          releaseId: sql`excluded.release_id`,
          title: sql`excluded.title`,
          milestones: sql`excluded.milestones`,
          updatedAt: sql`now()`,
        },
      });
  }

  return {
    releaseVersion: release!.versionNumber,
    examsCount: EXAMS.length,
    branchesCount: BRANCHES.length,
    roadmapsCount: BRANCHES.length,
  };
}
