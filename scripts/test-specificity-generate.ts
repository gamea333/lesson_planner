/**
 * Live Groq generation + specificity scores.
 * Usage: npx tsx scripts/test-specificity-generate.ts [id ...]
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { generateLessonPlanFromKnowledgeBase } from "../lib/groq";
import {
  getKnowledgeBaseEntry,
  listKnowledgeBaseEntries,
  updateKnowledgeBaseEntry,
} from "../lib/knowledge-base-store";
import { resolveChapterTitle } from "../lib/grounding";
import type { GenerateFromKbInput } from "../lib/types/knowledge-base";

async function fixFootprintsMetadata() {
  const entry = await getKnowledgeBaseEntry(10);
  if (!entry) return;
  if (/delhi public school/i.test(entry.chapter)) {
    const fixed = resolveChapterTitle(
      entry.chapter,
      entry.raw_text,
      entry.filename
    );
    await updateKnowledgeBaseEntry(10, { chapter: fixed });
    console.log(`[fix] Fixed chapter id=10 title → "${fixed}"`);
  }
}

async function runForId(id: number) {
  const entry = await getKnowledgeBaseEntry(id);
  if (!entry) {
    console.error(`No entry id=${id}`);
    return;
  }

  const input: GenerateFromKbInput = {
    chapterId: id,
    numberOfDays: "1",
    customization: {
      shortenWarmUp: false,
      extraPractice: false,
      simplifyLanguage: false,
      realWorldExamples: false,
      customText: "",
    },
    source: "knowledge_base",
  };

  console.log(
    `\n######## LIVE GENERATE id=${id} "${entry.chapter}" (${entry.filename}) ########`
  );
  const plan = await generateLessonPlanFromKnowledgeBase(entry, input);
  console.log(`\n--- Generated plan summary ---`);
  console.log(`Chapter: ${plan.chapter}`);
  console.log(`Warm-up: ${plan.teachingMethodology.warmUp.slice(0, 200)}…`);
  console.log(
    `Citation warmUp: ${plan.teachingMethodology.warmUpCitation ?? "(none)"}`
  );
  console.log(
    `Assessment[0]: ${plan.teachingMethodology.assessment[0]?.slice(0, 160) ?? "(none)"}…`
  );
}

async function main() {
  await fixFootprintsMetadata();

  const args = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isFinite(n));

  let ids = args;
  if (!ids.length) {
    const footprints = (await listKnowledgeBaseEntries()).filter(
      (e) =>
        /footprints/i.test(e.chapter) || /footprints/i.test(e.filename)
    );
    const triumph = (await listKnowledgeBaseEntries()).filter(
      (e) =>
        /triumph|surgery/i.test(e.chapter) ||
        /triumph|surgery/i.test(e.filename)
    );
    const anne = (await listKnowledgeBaseEntries()).filter(
      (e) =>
        /anne|frank|diary/i.test(e.chapter) || /anne|frank/i.test(e.filename)
    );
    ids = [...anne, ...footprints, ...triumph].map((e) => e.id).slice(0, 2);
    if (!ids.length) {
      console.log("No matching chapters. Available:");
      for (const e of await listKnowledgeBaseEntries()) {
        console.log(`  id=${e.id}  ${e.chapter}  (${e.filename})`);
      }
      process.exit(1);
    }
    if (!anne.length) {
      console.warn(
        "[fix] Anne Frank chapter not in KB — testing Footprints + Triumph of Surgery instead."
      );
    }
  }

  for (const id of ids) await runForId(id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
