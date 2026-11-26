import { Claim, Report, Run, RunEvent, Source, SourceSnapshot, Workspace } from "../types";

export const DEMO_WORKSPACE: Workspace = {
  _id: "demo-ws-1",
  name: "Sample B2B Competitor Watch (Demo Data)",
  description: "Demonstration workspace showing how Evidence Desk monitors official pricing pages, release notes, and documentation.",
  competitors: [
    { _id: "dc1", name: "Espressif IoT", domain: "espressif.com", notes: "Hardware SoC & SDK documentation" },
  ],
  approvedSources: [
    {
      _id: "ds1",
      label: "ESP32 Official Product Page",
      publisher: "Espressif Systems",
      url: "https://www.espressif.com/en/products/socs/esp32",
      canonicalUrl: "https://espressif.com/en/products/socs/esp32",
      domain: "espressif.com",
      sourceType: "official_page",
      isOfficial: true,
      enabled: true,
      addedAt: new Date().toISOString(),
    },
    {
      _id: "ds2",
      label: "ESP-IDF Power Docs",
      publisher: "Espressif Docs",
      url: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/power_management.html",
      canonicalUrl: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/power_management.html",
      domain: "docs.espressif.com",
      sourceType: "documentation",
      isOfficial: true,
      enabled: true,
      addedAt: new Date().toISOString(),
    },
  ],
  schedule: {
    cadence: "weekly",
    defaultQuestion: "What changed in competitor product specs, SDK release notes, or documentation?",
    lastRunAt: new Date().toISOString(),
    nextRunAt: new Date(Date.now() + 7 * 864e5).toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_SNAPSHOTS: SourceSnapshot[] = [
  {
    _id: "snap1",
    workspaceId: "demo-ws-1",
    runId: "demo-esp32",
    canonicalUrl: "https://espressif.com/en/products/socs/esp32",
    url: "https://www.espressif.com/en/products/socs/esp32",
    domain: "espressif.com",
    publisher: "Espressif Systems",
    title: "ESP32 Series Datasheet",
    sourceType: "official_page",
    publishedAt: "2024-01-15",
    retrievedAt: new Date().toISOString(),
    contentHash: "demo-hash-1",
    fetchStatus: "ok",
    changeStatus: "changed",
    diffSummary: "Detected 1 new/updated statement(s) and 1 removed statement(s).",
    addedLines: ["Updated SDK support notice for ESP-IDF v5.x release cycle."],
    removedLines: ["Legacy ESP-IDF v4.4 maintenance reference."],
  },
];

export const DEMO_ESP32_RUN: Run = {
  _id: "demo-esp32",
  question: "ESP32 microcontroller technical architecture, memory, and wireless capabilities",
  status: "completed",
  currentStage: "completed",
  scope: { depth: "balanced", maxSources: 10 },
  searchQueries: [
    "ESP32 datasheet architecture",
    "ESP32 power consumption deep sleep",
    "ESP32 vs STM32 real time interrupt latency",
  ],
  sourceCount: 10,
  warnings: [],
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

export const DEMO_ESP32_SOURCES: Source[] = [
  {
    _id: "s1",
    label: "S1",
    title: "ESP32 Series Datasheet - Espressif Systems",
    url: "https://www.espressif.com/en/products/socs/esp32",
    domain: "espressif.com",
    publishedAt: "2024",
    retrievedAt: new Date().toISOString(),
    excerpt: "The ESP32 is a dual-core 32-bit Xtensa LX6 microprocessor operating up to 240 MHz with 520 KB SRAM and integrated 802.11 b/g/n Wi-Fi and Bluetooth 4.2 BR/EDR and BLE.",
    contentType: "text/html",
  },
  {
    _id: "s2",
    label: "S2",
    title: "ESP-IDF Power Management & Deep Sleep Guide",
    url: "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/power_management.html",
    domain: "espressif.com",
    publishedAt: "2024",
    retrievedAt: new Date().toISOString(),
    excerpt: "In Deep-sleep mode, CPU and memory are powered down while the RTC memory and coprocessor remain active, drawing as low as 10 to 15 microamps in bare SoC configurations.",
    contentType: "text/html",
  },
  {
    _id: "s3",
    label: "S3",
    title: "Comparative Benchmarking of ESP32 and STM32 Microcontrollers in Industrial IoT",
    url: "https://ieeexplore.ieee.org/document/8934521",
    domain: "ieeexplore.ieee.org",
    publishedAt: "2023",
    retrievedAt: new Date().toISOString(),
    excerpt: "While ESP32 provides superior onboard wireless networking, interrupt latency tests reveal jitter introduced by the Wi-Fi stack background tasks, rendering STM32 superior for hard real-time motor control.",
    contentType: "text/html",
  },
];

export const DEMO_ESP32_CLAIMS: Claim[] = [
  {
    _id: "c1",
    claimId: "clm_001",
    text: "The ESP32 is powered by a dual-core 32-bit Xtensa LX6 microprocessor operating up to 240 MHz with 520 KB SRAM.",
    theme: "Core Architecture",
    status: "supported",
    evidence: [
      {
        sourceLabel: "S1",
        sourceId: "s1",
        supportType: "supports",
        excerpt: "The ESP32 is a dual-core 32-bit Xtensa LX6 microprocessor operating up to 240 MHz with 520 KB SRAM.",
      },
    ],
    reasoning: "Corroborated by primary manufacturer datasheet specifications.",
    limitations: [],
  },
  {
    _id: "c2",
    claimId: "clm_002",
    text: "ESP32 includes integrated 802.11 b/g/n Wi-Fi and dual-mode Bluetooth (Classic and BLE 4.2).",
    theme: "Wireless Connectivity",
    status: "supported",
    evidence: [
      {
        sourceLabel: "S1",
        sourceId: "s1",
        supportType: "supports",
        excerpt: "integrated 802.11 b/g/n Wi-Fi and Bluetooth 4.2 BR/EDR and BLE.",
      },
    ],
    reasoning: "Confirmed by official Espressif hardware specs.",
    limitations: [],
  },
  {
    _id: "c3",
    claimId: "clm_003",
    text: "Bare ESP32 SoC consumes approximately 10-15 µA in deep sleep mode with RTC memory active.",
    theme: "Power Consumption",
    status: "supported",
    evidence: [
      {
        sourceLabel: "S2",
        sourceId: "s2",
        supportType: "supports",
        excerpt: "drawing as low as 10 to 15 microamps in bare SoC configurations.",
      },
    ],
    reasoning: "Verified via ESP-IDF power management technical documentation.",
    limitations: ["Development boards with USB-UART chips consume higher quiescent current (~6.5 mA)."],
  },
  {
    _id: "c4",
    claimId: "clm_004",
    text: "ESP32 Wi-Fi stack background tasks can introduce interrupt jitter, making STM32 preferable for hard real-time determinism.",
    theme: "Real-Time Limitations",
    status: "contradicted",
    evidence: [
      {
        sourceLabel: "S3",
        sourceId: "s3",
        supportType: "supports",
        excerpt: "interrupt latency tests reveal jitter introduced by the Wi-Fi stack background tasks, rendering STM32 superior for hard real-time motor control.",
      },
      {
        sourceLabel: "S1",
        sourceId: "s1",
        supportType: "contradicts",
        excerpt: "ESP32 features dual-core processing designed to run application tasks on one core and wireless protocol stacks concurrently on the other.",
      },
    ],
    reasoning: "Contradiction exists: Vendor documentation states dual-core separation isolates wireless tasks, but empirical IEEE benchmark finds jitter persists under heavy RF traffic.",
    limitations: ["Testing was conducted under continuous 802.11 throughput."],
  },
];

export const DEMO_ESP32_REPORT: Report = {
  title: "ESP32 Microcontroller Technical Overview & Architectural Analysis",
  summary: "The ESP32 is a versatile 32-bit microcontroller family featuring dual-core processing, integrated Wi-Fi, and dual-mode Bluetooth [S1]. It is widely adopted for IoT applications due to hardware encryption and low-power sleep modes [S2], though empirical testing shows wireless stack background tasks can affect hard real-time interrupt determinism compared to STM32 [S3].",
  sections: [
    {
      heading: "Core Architecture and Memory",
      claimIds: ["clm_001"],
      body: "The standard ESP32 is powered by a dual-core 32-bit Xtensa LX6 microprocessor [S1]. The clock frequency is adjustable between 80 MHz and 240 MHz. Internal memory includes 520 KB of SRAM and 448 KB of ROM [S1].",
    },
    {
      heading: "Wireless Connectivity and Peripherals",
      claimIds: ["clm_002"],
      body: "Connectivity is a primary feature, with integrated 802.11 b/g/n Wi-Fi and dual-mode Bluetooth (Classic BR/EDR and BLE 4.2) [S1]. The chip provides up to 16 channels of LED PWM and extensive GPIO pins.",
    },
    {
      heading: "Power Consumption and Security",
      claimIds: ["clm_003"],
      body: "The ESP32 includes hardware-based cryptographic acceleration (AES, SHA-2, RSA) and secure boot. It consumes as little as 10-15 µA in deep sleep mode when only the RTC timer and memory are active [S2].",
    },
    {
      heading: "Real-Time Performance and Limitations",
      claimIds: ["clm_004"],
      body: "Peer-reviewed benchmarking reveals that the Wi-Fi and TCP/IP stack can introduce latency jitter on high-frequency interrupts [S3]. For hard real-time control applications like industrial robotics, developers frequently pair it with an STM32 coprocessor [S3].",
    },
  ],
  themes: [
    { name: "Core Architecture", summary: "Dual-core 32-bit Xtensa LX6 running up to 240 MHz." },
    { name: "Wireless Networking", summary: "Integrated Wi-Fi and dual-mode Bluetooth." },
    { name: "Power Management", summary: "Ultra-low power deep sleep down to 10-15 µA." },
  ],
  disagreements: [
    "Espressif documentation highlights dual-core concurrent processing [S1], whereas IEEE benchmarks highlight interrupt jitter induced by Wi-Fi RTOS tasks [S3].",
  ],
  limitations: [
    "Development boards with linear voltage regulators consume more standby power than the bare SoC.",
  ],
  referenceSourceIds: ["s1", "s2", "s3"],
};

export const DEMO_ESP32_EVENTS: RunEvent[] = [
  { _id: "e1", stage: "plan_queries", message: "Planner generated 4 focused search queries", level: "info", timestamp: new Date().toISOString() },
  { _id: "e2", stage: "search_web", message: "Retrieved 10 authoritative web sources via Tavily", level: "info", timestamp: new Date().toISOString() },
  { _id: "e3", stage: "analyse_evidence", message: "Extracted 18 atomic testable claims", level: "info", timestamp: new Date().toISOString() },
  { _id: "e4", stage: "verify_claims", message: "Verified claims with dual-judge entailment check (94.2% support)", level: "info", timestamp: new Date().toISOString() },
  { _id: "e5", stage: "write_report", message: "Synthesized grounded technical dossier with citations", level: "info", timestamp: new Date().toISOString() },
];
