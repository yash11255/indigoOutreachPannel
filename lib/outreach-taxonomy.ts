/**
 * Fixed reference data for the outreach form — Pillar -> Channel taxonomy,
 * Outreach Mode, and the curated Activity list. Static because this is
 * agreed-upon reference data, not something admins edit at runtime; keeping
 * it in code avoids a lookup table + fetch for values that never change.
 */

const RAW_PILLAR_CHANNELS: Record<string, string[]> = {
  "Government Institutions": [
    "Ministry/Department of Education",
    "Directorate of Technical Education",
    "RTO Centre",
    "State Rural Livelihood Mission (NRLM/SRLM)",
    "Women & Child Development Department",
    "District Collector / DM Office",
    "Skill Development Department",
    "National Skill Development Corporation (NSDC) ecosystem",
    "Rural Self Employment Training Institutes (RSETI)",
    "Health department",
    "Social welfare department",
    "Tribal welfare department",
    "Minority welfare department",
    "Backward classes welfare department",
    "Zilla Parishad / district panchayat",
    "Gram Panchayat network",
    "Employment exchange",
    "Model Career Centres",
    "Directorate of higher education",
    "Municipality / Corporations",
  ],
  "Educational Institutions": [
    "School - (CBSE/ICSE)",
    "School - State Board",
    "School - Kendriya Vidyalaya",
    "School - Jawahar Navodaya Vidyalaya",
    "School - Sainik school",
    "School - Eklavya Model Residential School (EMRS)",
    "School - Kasturba Gandhi Balika Vidyalaya (KGBV)",
    "School - Government residential school",
    "School - Girls school",
    "School - Private school",
    "School - Aided school",
    "Pre-university college (PUC) / junior college",
    "Government degree college",
    "Private degree college",
    "Women's college",
    "Engineering college",
    "Vocational training institute",
    "Skill training institute",
    "Medical & allied science college",
    "University - Central university",
    "University - State university",
    "University - Private university",
    "University - Deemed university",
    "Open university",
    "Distance education institution",
    "Coaching institute - competitive exams",
    "Coaching institute - aviation",
    "Career counselling centre",
    "Student clubs/associations",
  ],
  "Community & Development Institutions": [
    "SHG Network (NRLM/Sanjeevini Cluster)",
    "Anganwadi Centre (AWC)",
    "Panchayat / Gram Sabha",
    "NGO / CBO",
    "Common Service Centre (CSC)",
    "Field Functionary Network (ASHA/AWW/CRP)",
    "Adolescent girls groups",
    "Community resource person (CRP) network",
    "Rotary club",
    "Lions club",
    "Youth associations",
    "Professional volunteer networks",
    "Faith-based/community organisations",
    "SHG network - CLF/GPLF federation network",
    "Alumni volunteer groups",
  ],
  "Strategic Networks": [
    "Women Pilot Association",
    "Aviation Training Academy",
    "CSR / Corporate Partner Network",
    "Industry Body",
    "Sector Skill Council",
  ],
  "Digital Outreach": [
    "Bulk WhatsApp",
    "Bulk Email",
    "Social Media - Instagram",
    "Social Media - Facebook",
    "Social Media - LinkedIn",
    "Digital Influencer Network",
    "Paid Digital Ads",
    "Programme Website / Microsite",
    "Scholarship & Career Platform",
    "SMS Gateway",
  ],
  "Media & Public Relations": [
    "Online News Platform / Digital News Portal",
    "Print Newspaper / Magazine",
    "Television",
    "Radio",
  ],
};

// Dropdown options are sorted ascending (A→Z) here so every Select built from
// these lists shows options in the same predictable order, rather than the
// original mockup's arbitrary curated order.
export const PILLAR_CHANNELS: Record<string, string[]> = Object.fromEntries(
  Object.entries(RAW_PILLAR_CHANNELS).map(([pillar, channels]) => [
    pillar,
    [...channels].sort((a, b) => a.localeCompare(b)),
  ]),
);

export const OUTREACH_PILLARS = Object.keys(PILLAR_CHANNELS).sort((a, b) => a.localeCompare(b));

export const OUTREACH_MODES = ["Digital", "Hybrid", "Media", "Physical", "Virtual"];

export const OUTREACH_ACTIVITIES = [
  "Awareness Session - Students",
  "Awareness session - Faculty",
  "Community awareness meeting",
  "Digital news coverage",
  "Email circulation",
  "Flyer distribution",
  "Institutional network cascade",
  "Media interview",
  "MoU/LoU signing",
  "Newspaper article",
  "Notice board display",
  "Official circular dissemination",
  "Official email",
  "Official meeting",
  "Press release",
  "Radio spot",
  "Social media posting",
  "Social media promotion/ Posting",
  "Story/reel posting",
  "Student WhatsApp circulation",
  "Telephonic Discussion",
  "Television interview",
  "Webinar session",
  "WhatsApp circulation",
  "Website listing",
].sort((a, b) => a.localeCompare(b));

/** The subset of OUTREACH_ACTIVITIES that count as an actual awareness
 * session (offline or online) at the institution, as opposed to a
 * lower-touch outreach step like a flyer, email, or WhatsApp message. A
 * lead should only be marked "Activity Completed" once one of these has
 * happened in some round. */
export const AWARENESS_SESSION_ACTIVITIES = [
  "Awareness Session - Students",
  "Awareness session - Faculty",
  "Community awareness meeting",
  "Webinar session",
];

/** Matches AWARENESS_SESSION_ACTIVITIES fuzzily — robust to typos ("Awarness
 * Session") and to activity_undertaken being a comma-joined multi-value
 * string ("Flyer distribution, Awareness Session - Students") rather than
 * one exact taxonomy value. */
const AWARENESS_SESSION_PATTERN =
  /aware?ness\s*session|community\s*awareness\s*meeting|webinar\s*session|physical(ly)?\s*session/i;

/** True if any of the given activity_undertaken values (this round's plus
 * every prior round's) represents a genuine awareness session. */
export function hasAwarenessSession(
  activities: (string | null | undefined)[],
): boolean {
  return activities.some((a) => !!a && AWARENESS_SESSION_PATTERN.test(a));
}

/** Shared Google Drive folder where session photos/evidence get uploaded, before pasting the resulting link into the "Google Drive link" field. */
export const OUTREACH_PHOTOS_FOLDER_URL =
  "https://drive.google.com/drive/u/0/folders/1Q4BVyUoQ3e8z1iDTSBbdP4xbu--YoGAJ";

/** Sentinel value used by "Other (specify)" options to reveal a free-text fallback input. */
export const OTHER_VALUE = "__other__";
