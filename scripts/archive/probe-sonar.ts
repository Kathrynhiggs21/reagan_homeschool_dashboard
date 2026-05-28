/**
 * One-shot: hit Perplexity Sonar with the exact query the finder uses and
 * print the raw response so we can see whether the empty result is the API,
 * the prompt, or the parser.
 */
(async () => {
  const apiKey = process.env.SONAR_API_KEY;
  if (!apiKey) {
    console.log("SONAR_API_KEY not set in env");
    process.exit(1);
  }

  const query = "Math Make Line Plots";
  const sysPrompt = `You are an educational research assistant for a 5th-grade homeschooler.
Restrict results to content explicitly safe and appropriate for a 10-year-old (5th grade). No ads, no gambling, no graphic content, no social-media platforms. Prefer Khan Academy, IXL, ReadWorks, PBS Kids, NASA Kids, National Geographic Kids, Common Sense Media-approved sources, and educational YouTube channels (SciShow Kids, Mark Rober, Crash Course Kids).
For the user's query, return up to 6 specific assignments / videos / activities they could drop into today's schedule.
Output a JSON object: { "items": [ { "title": string, "url": string, "type": "worksheet"|"video"|"lesson_plan"|"quiz"|"project"|"app_activity"|"reading"|"other", "snippet": string, "estimated_minutes": number, "subject_slug": "math"|"ela"|"reading"|"writing"|"science"|"ss"|"art"|"music"|"other", "topic_code": string } ] }
"topic_code" should be the closest 5th-grade Common Core / Ohio Learning Standard code (e.g. "5.OA.1", "5.RL.5.2", "5.NBT.3"). If you genuinely cannot identify one, use null.`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: query },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    console.log("HTTP status:", res.status);
    const text = await res.text();
    console.log("Body length:", text.length);
    console.log("Body (first 2000 chars):");
    console.log(text.slice(0, 2000));
  } catch (e: any) {
    console.log("Error:", e?.message ?? e);
  }
  process.exit(0);
})();
