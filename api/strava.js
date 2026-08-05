
// Vercel Serverless Function: Strava API Proxy + Claude Analyse
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  const { action, code, refresh_token, access_token, run } = req.body;

  try {
    if (action === 'exchange') {
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, grant_type: 'authorization_code' }),
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'refresh') {
      const r = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token, grant_type: 'refresh_token' }),
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'activities') {
      const r = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=20', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'athlete') {
      const r = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'analyse') {
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

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await r.json();
      const text = data.content?.[0]?.text || 'Analyse nicht verfügbar.';
      return res.status(200).json({ analysis: text });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
