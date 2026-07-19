import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CHALLENGE_DATE,
  EFFECTIVE_DATE,
  RULE_VERSION,
  findRuleSnippets,
  ruleById,
  type RuleSnippet,
} from "./corpus";

const Input = z.object({
  question: z.string().trim().min(1).max(600),
});

export type RefusalCategory =
  "DECISION" | "PRIORITIZATION" | "PROTECTED_TRAIT" | "CROSS_USER" | "VACANCY";

const REQUEST =
  "(?:can|could|would|will|should|do|does|did|is|are|am|tell|show|give|decide|determine|check|say|pick|choose|find|which|who|please|just)";
const DECISION_TERM =
  "(?:decid(?:e|es|ed|ing)?|determin(?:e|es|ed|ing)?|qualif(?:y|ies|ied|ication)?|eligib(?:le|ility)|approv(?:e|es|ed|al|ing)?|den(?:y|ies|ied|ial)|accept(?:s|ed|ance|ing)?|reject(?:s|ed|ion|ing)?)";

const REFUSAL_PATTERNS: ReadonlyArray<{ category: RefusalCategory; patterns: readonly RegExp[] }> =
  [
    {
      category: "VACANCY",
      patterns: [
        /\b(vacan(?:cy|cies|t)|available units?|units? available|open units?|current availability|waitlist openings?|accepting applications?|rent(?:al)? availability)\b/i,
        /\b(?:find|show|tell|which|where|does|is|are)\b.{0,50}\b(?:property|properties|apartment|unit|building)\b.{0,30}\b(?:available|open|vacan|accepting)\b/i,
      ],
    },
    {
      category: "CROSS_USER",
      patterns: [
        /\b(other|another|different|previous|all)\s+(?:applicant|tenant|household|user|person|client)s?\b/i,
        /\b(?:compare|show|reveal|access|retrieve|rank)\b.{0,50}\b(?:applicants?|households?|users?|tenants?)\b/i,
        /\b(?:their|someone else(?:'s)?)\s+(?:application|income|documents?|data|record|status)\b/i,
      ],
    },
    {
      category: "PROTECTED_TRAIT",
      patterns: [
        /\b(?:infer|guess|identify|screen|exclude|prefer|favor|favour|penalize|filter|rank|prioriti[sz]e|decide)\b.{0,70}\b(?:race|color|colour|religion|sex|gender|sexual orientation|national origin|citizenship|immigration status|disabilit(?:y|ies)|health|medical|familial status|pregnan(?:t|cy)|age|ethnicity)\b/i,
        /\b(?:race|color|colour|religion|sex|gender|sexual orientation|national origin|citizenship|immigration status|disabilit(?:y|ies)|health|medical|familial status|pregnan(?:t|cy)|ethnicity)\b.{0,70}\b(?:qualif|eligib|approv|deny|accept|reject|rank|prioriti[sz]|prefer|decision)\w*/i,
        /\b(?:what|which|who|tell|show|is|are|does|can)\b.{0,45}\b(?:race|religion|sex|gender|sexual orientation|national origin|citizenship|immigration status|disabilit(?:y|ies)|health|medical|familial status|pregnan(?:t|cy)|ethnicity)\b/i,
      ],
    },
    {
      category: "PRIORITIZATION",
      patterns: [
        /\b(?:rank|ranking|prioriti[sz](?:e|es|ed|ing|ation)?|score|pick|choose|prefer)\b.{0,60}\b(?:applicant|tenant|household|person|people|application)s?\b/i,
        /\b(?:who|which applicant|which household)\b.{0,50}\b(?:first|ahead|priority|prefer|pick|choose|rank)\b/i,
        /^\s*(?:please\s+|just\s+)*(?:rank|prioriti[sz]e|score|pick|choose)\b/i,
      ],
    },
    {
      category: "DECISION",
      patterns: [
        new RegExp(`\\b${REQUEST}\\b.{0,55}\\b${DECISION_TERM}\\b`, "i"),
        new RegExp(
          `\\b${DECISION_TERM}\\b.{0,35}\\b(?:me|my|i|us|our|applicant|application|household|person|tenant)\\b`,
          "i",
        ),
        new RegExp(`^\\s*(?:please\\s+|just\\s+)*${DECISION_TERM}\\b`, "i"),
        /\b(?:am i|are we|is (?:this|my|our)|does this mean|good to (?:apply|go|submit))\b.{0,60}\b(?:in|out|okay|ok|pass|fail|qualified|eligible|approved|accepted|denied|rejected)\b/i,
        /\b(?:final|make|give|issue)\s+(?:a\s+)?(?:decision|verdict|determination)\b/i,
      ],
    },
  ];

const REFUSALS: Readonly<Record<RefusalCategory, { message: string; ruleIds: readonly string[] }>> =
  {
    DECISION: {
      message:
        "I can compare documented amounts with the frozen threshold and identify evidence gaps, but a human reviewer must make any final program decision.",
      ruleIds: ["CH-DECISION-001", "FED-MONITOR-001"],
    },
    PRIORITIZATION: {
      message:
        "I cannot rank or prioritize people. I can only provide calculations, evidence gaps, and citations for human review.",
      ruleIds: ["CH-DECISION-001"],
    },
    PROTECTED_TRAIT: {
      message:
        "I cannot infer protected traits or use them to screen, rank, or make housing decisions.",
      ruleIds: ["CH-INCOME-001", "CH-DECISION-001"],
    },
    CROSS_USER: {
      message:
        "I cannot reveal, compare, or act on another applicant's data. I can explain the frozen rules without exposing private records.",
      ruleIds: ["CH-SAFETY-001"],
    },
    VACANCY: {
      message:
        "The supplied property data cannot establish current vacancies, waitlists, rents, or application status. Confirm availability directly with the property.",
      ruleIds: ["HUD-DATA-001"],
    },
  };

export function classifyRulesRequest(question: string): RefusalCategory | null {
  for (const group of REFUSAL_PATTERNS) {
    if (group.patterns.some((pattern) => pattern.test(question))) return group.category;
  }
  return null;
}

export function refusalFor(category: RefusalCategory): {
  refusal: true;
  abstained: false;
  category: RefusalCategory;
  message: string;
  snippets: RuleSnippet[];
  ruleVersion: string;
  effectiveDate: string;
  challengeDate: string;
} {
  const refusal = REFUSALS[category];
  return {
    refusal: true,
    abstained: false,
    category,
    message: refusal.message,
    snippets: refusal.ruleIds.map(ruleById).filter((rule): rule is RuleSnippet => rule !== null),
    ruleVersion: RULE_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    challengeDate: CHALLENGE_DATE,
  };
}

export const answerRulesQuestion = createServerFn({ method: "POST" })
  .validator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const category = classifyRulesRequest(data.question);
    if (category) return refusalFor(category);

    if (
      /\b(?:what|who)\s+counts?\s+as\s+(?:a\s+)?household|household composition\b/i.test(
        data.question,
      )
    ) {
      return {
        refusal: false as const,
        abstained: true as const,
        message:
          "The frozen corpus supplies household-size thresholds but does not define who belongs in a household. Confirm household composition with a qualified program reviewer.",
        snippets: [],
        ruleVersion: RULE_VERSION,
        effectiveDate: EFFECTIVE_DATE,
        challengeDate: CHALLENGE_DATE,
      };
    }

    const snippets = findRuleSnippets(data.question);
    if (snippets.length === 0) {
      return {
        refusal: false as const,
        abstained: true as const,
        message:
          "The frozen corpus does not cover this question. Confirm it with the property, agency, or a qualified human reviewer.",
        snippets: [],
        ruleVersion: RULE_VERSION,
        effectiveDate: EFFECTIVE_DATE,
        challengeDate: CHALLENGE_DATE,
      };
    }
    return {
      refusal: false as const,
      abstained: false as const,
      message:
        "These frozen rules are relevant to the question. They support cited calculations and readiness review only; final determinations remain with a human reviewer.",
      snippets,
      ruleVersion: RULE_VERSION,
      effectiveDate: EFFECTIVE_DATE,
      challengeDate: CHALLENGE_DATE,
    };
  });
