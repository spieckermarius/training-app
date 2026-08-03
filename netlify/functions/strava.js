// Netlify Function: Strava API Proxy + Claude Analyse
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const body = JSON.parse(event.body || "{}");
  const { action, code, refresh_token, access_token, run } = body;

  try {
    // 1. Auth Code Exchange
    if (action === "exchange") {
      const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 2. Token Refresh
    if (action === "refresh") {
      const res = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token,
          grant_type: "refresh_token",
        }),
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 3. Aktivitäten
    if (action === "activities") {
      const res = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=20",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 4. Athleten-Profil
    if (action === "athlete") {
      const res = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      return { statusCode: 200, headers, body: JSON.stringify(await res.json()) };
    }

    // 5. Claude Lauf-Analyse
    if (action === "analyse") {
      const prompt = `Du bist ein präziser Laufcoach. Analysiere diesen Lauf von Marius in 5 kurzen Punkten auf Deutsch.

LAUFDATEN:
- Datum: ${run.date}
- Typ laut Plan: ${run.plannedType}
- Distanz: ${run.distance} km
- Zeit: ${run.time}
- Pace: ${run.pace}/km
- Ø Herzfrequenz: ${run.avgHR} bpm
- Max Herzfrequenz: ${run.maxHR} bpm
- Tage seit letztem Lauf: ${run.daysSinceLast}
- PRs: ${run.prCount > 0 ? run.prCount + ' neue Bestzeiten' : 'keine'}

TRAININGSPLAN:
- Montag: Push + Easy Run (7-10km, <140 bpm)
- Mittwoch: Tempolauf (5-6km, 170-185 bpm)
- Freitag: Pull + Easy Run (7-10km, <140 bpm)
- Sonntag: Long Run (15-21km, <145 bpm)
- Ziel Halbmarathon: 2:20-2:30h

Gib genau 5 Zeilen zurück, jede beginnt mit einem Emoji, maximal 12 Wörter pro Zeile. Kein Intro, kein Outro, nur die 5 Zeilen.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "Analyse nicht verfügbar.";
      return { statusCode: 200, headers, body: JSON.stringify({ analysis: text }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
