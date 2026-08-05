const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const { action, code, refresh_token, access_token, run } = body || {};

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
        headers: { Authorization: 'Bearer ' + access_token },
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'athlete') {
      const r = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: 'Bearer ' + access_token },
      });
      return res.status(200).json(await r.json());
    }

    if (action === 'analyse') {
      const prompt = 'Du bist ein Laufcoach. Analysiere diesen Lauf von Marius in genau 5 Zeilen auf Deutsch. Jede Zeile beginnt mit einem Emoji. Maximal 12 Woerter pro Zeile. Nur die 5 Zeilen, kein Intro.\n\n'
        + 'Datum: ' + run.date + '\n'
        + 'Geplant: ' + run.plannedType + '\n'
        + 'Distanz: ' + run.distance + ' km\n'
        + 'Zeit: ' + run.time + '\n'
        + 'Pace: ' + run.pace + '/km\n'
        + 'Herzfrequenz: ' + run.avgHR + ' bpm (Max: ' + run.maxHR + ' bpm)\n'
        + 'Tage seit letztem Lauf: ' + run.daysSinceLast + '\n'
        + 'PRs: ' + (run.prCount > 0 ? run.prCount + ' neue Bestzeiten' : 'keine') + '\n'
        + 'Trainingsplan: Mo Easy, Mi Tempo 5-6km, Fr Easy, So Long Run 15-21km\n'
        + 'Ziel: Halbmarathon 2:20-2:30h';

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
      const text = data.content && data.content[0] && data.content[0].text
        ? data.content[0].text
        : 'Fehler: ' + JSON.stringify(data);
      return res.status(200).json({ analysis: text });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
