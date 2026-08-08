/**
 * Dry-run specificity diagnostics against knowledge base chapters.
 * Usage: npx tsx scripts/debug-specificity.ts
 * Optional: npx tsx scripts/debug-specificity.ts 10 5
 */
import { debugBuildLessonPlanPayload } from "../lib/groq";
import {
  listKnowledgeBaseEntries,
  getKnowledgeBaseEntry,
} from "../lib/knowledge-base-store";
import type { GenerateFromKbInput } from "../lib/types/knowledge-base";

async function findChapters(query: string) {
  const entries = await listKnowledgeBaseEntries();
  return entries.filter(
    (e) =>
      e.chapter.toLowerCase().includes(query.toLowerCase()) ||
      e.filename.toLowerCase().includes(query.toLowerCase())
  );
}

async function runForId(id: number, days = "1") {
  const entry = await getKnowledgeBaseEntry(id);
  if (!entry) {
    console.error(`No entry id=${id}`);
    return;
  }

  const input: GenerateFromKbInput = {
    chapterId: id,
    numberOfDays: days,
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
    `\n######## DEBUG CHAPTER id=${id} "${entry.chapter}" (${entry.filename}) ########`
  );
  const built = debugBuildLessonPlanPayload(entry, input);
  console.log(`Specificity terms: ${built.specificityTerms.join(", ")}`);
  console.log(`Pack: included=${built.packStats.included.join(" | ")}`);
  console.log(
    `Pack stats: truncated=[${built.packStats.truncated.join(", ")}] dropped=[${built.packStats.dropped.join(", ")}] userTokens≈${built.packStats.userTokens}`
  );

  const userLower = built.userPrompt.toLowerCase();
  const hits = built.specificityTerms.filter((t) =>
    userLower.includes(t.toLowerCase())
  );
  console.log(
    `Terms present in final USER prompt: ${hits.length}/${built.specificityTerms.length} — [${hits.slice(0, 12).join(", ")}]`
  );
}

async function main() {
  const args = process.argv
    .slice(2)
    .map(Number)
    .filter((n) => Number.isFinite(n));

  if (args.length) {
    for (const id of args) await runForId(id);
    return;
  }

  const footprints = await findChapters("footprints");
  const triumph = await findChapters("triumph");
  const anne = await findChapters("anne");
  const targets = [...anne, ...footprints, ...triumph].slice(0, 3);

  if (!targets.length) {
    console.log("No matching chapters. Available:");
    for (const e of await listKnowledgeBaseEntries()) {
      console.log(`  id=${e.id}  ${e.chapter}  (${e.filename})`);
    }
    return;
  }

  for (const e of targets) await runForId(e.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
