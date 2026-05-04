// Save Reagan's "Fake Blood Spider" story (May 4 2026) as a Writing turn-in:
// - Uploads the photo to S3
// - Creates a Writing block on today's plan if one doesn't exist
// - Inserts TWO assignmentSubmissions (original spelling + cleaned-up version)
// - Awards +10 Kiwi Coins via awardSticker
import {
  ensurePlanForDate,
  listBlocksForPlan,
  createBlock,
  createAssignmentSubmission,
  awardSticker,
} from "../server/db.ts";
import { storagePut } from "../server/storage.ts";
import { readFile } from "node:fs/promises";

const TODAY = "2026-05-04";
const PHOTO_PATH = "/home/ubuntu/upload/1000333566.jpg";
const REAGAN_USER_ID = 1;

const ORIGINAL = `At night I found
fake blood. I do not
know what to do about
this, so I decided to use it. I did
not think about the
promples that would come
So I triad to make
it look real. So I put
fake blood on my
forhand. I did not like
the war it look so I triad
agen and agen. Eventually
it was all over the place.
Then the splinder
come. The spirder came
nare I was siting, I
wint on top of the
cofer. The spirder left,
I pid not know were
the spirder went I
stand on the confer.
I pot more fake blood
on me.
I wint to bed me
sitll red.`;

const CLEAN = `At night I found fake blood. I did not know what to do about this, so I decided to use it. I did not think about the problems that would come.

So I tried to make it look real. So I put fake blood on my forehead. I did not like the way it looked, so I tried again and again. Eventually it was all over the place.

Then the spider came. The spider came near where I was sitting. I went on top of the cover. The spider left. I did not know where the spider went. I stood on the cover. I put more fake blood on me.

I went to bed, me still red.`;

async function main() {
  const photo = await readFile(PHOTO_PATH);
  console.log("photo bytes:", photo.length);

  const photoUpload = await storagePut(
    `reagan-stories/2026-05-04-fake-blood-spider.jpg`,
    photo,
    "image/jpeg",
  );
  console.log("photo:", photoUpload.url);

  const plan = await ensurePlanForDate(TODAY, "full", { allowWeekendAutoBuild: true });
  if (!plan) throw new Error("no plan");

  const blocks = await listBlocksForPlan(plan.id);
  let writing = blocks.find((b) => /fake blood|spider|writing.*reagan|reagan.*writ/i.test(b.title || ""));
  let blockId;
  if (!writing) {
    blockId = await createBlock({
      planId: plan.id,
      blockType: "custom",
      title: "📝 Writing — \"Fake Blood Spider\" (Reagan's story)",
      description: "Reagan wrote a short suspense story this morning before the planet video. Two versions saved (original spelling preserved + cleaned-up reader copy) plus a photo of the handwritten page.",
      durationMin: 30,
      startTime: "08:30",
      sortOrder: -1,
      status: "complete",
    });
    console.log("created writing block:", blockId);
  } else {
    blockId = writing.id;
    console.log("found existing writing block:", blockId);
  }

  const original = await createAssignmentSubmission({
    blockId,
    subjectSlug: "ela",
    title: "Fake Blood Spider — original (Reagan's spelling)",
    submissionType: "text",
    contentText: ORIGINAL,
    fileKey: photoUpload.key,
    fileUrl: photoUpload.url,
    fileMimeType: "image/jpeg",
    reviewStatus: "reviewed",
    rubricPick: "got_it",
    adultNotes: "Original handwritten page — spelling preserved exactly as Reagan wrote it. Strong narrative voice, clear cause-and-effect, ambitious 5th-grade vocabulary attempts (problems, eventually).",
    kidDifficulty: "just_right",
    submittedAt: new Date(`${TODAY}T08:45:00`),
    reviewedAt: new Date(`${TODAY}T08:45:00`),
    reviewedByUserId: REAGAN_USER_ID,
  });
  console.log("original submission id:", original?.id);

  const clean = await createAssignmentSubmission({
    blockId,
    subjectSlug: "ela",
    title: "Fake Blood Spider — cleaned-up reader copy",
    submissionType: "text",
    contentText: CLEAN,
    fileKey: photoUpload.key,
    fileUrl: photoUpload.url,
    fileMimeType: "image/jpeg",
    reviewStatus: "reviewed",
    rubricPick: "got_it",
    adultNotes: "Cleaned-up reader copy. Pair with the original to celebrate growth.",
    kidDifficulty: "just_right",
    submittedAt: new Date(`${TODAY}T08:46:00`),
    reviewedAt: new Date(`${TODAY}T08:46:00`),
    reviewedByUserId: REAGAN_USER_ID,
  });
  console.log("clean submission id:", clean?.id);

  await awardSticker({
    userId: REAGAN_USER_ID,
    reason: "adult_bonus",
    blockId,
    submissionId: original?.id ?? null,
    coins: 10,
    shortLyric: "Spooky-good story, Reagan! 🕷️ +10 Kiwi Coins for writing both versions.",
    addedByUserId: REAGAN_USER_ID,
  });
  console.log("awarded +10 kiwi coins");

  process.exit(0);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
