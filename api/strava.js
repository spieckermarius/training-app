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
      const { date, plannedType, distance, time, pace, avgHR, maxHR, daysSinceLast, prCount } = run;

      const lines = [];
      const dist = parseFloat(distance);
      const hr = parseInt(avgHR);
      const paceMin = parseInt(pace.split(':')[0]);
      const paceSec = parseInt(pace.split(':')[1]);
      const paceTotalSec = paceMin * 60 + paceSec;
      const days = parseInt(daysSinceLast) || 0;

      // 1. Lauftyp & Planeinhalten
      if (plannedType.includes('Tempolauf')) {
        if (hr >= 170 && hr <= 190) {
          lines.push('⚡ Tempolauf perfekt — HR im Zielbereich 170-185 bpm');
        } else if (hr < 170) {
          lines.push('⚡ Tempolauf etwas locker — HR unter 170 bpm, gerne mehr Gas geben');
        } else {
          lines.push('⚡ Tempolauf sehr intensiv — HR über 190 bpm, Erholung wichtig');
        }
      } else if (plannedType.includes('Long Run')) {
        if (hr <= 145) {
          lines.push('🏃 Long Run gut kontrolliert — HR im Zielbereich unter 145 bpm');
        } else if (hr <= 155) {
          lines.push('🏃 Long Run etwas zu intensiv — HR über 145 bpm, lockerer bleiben');
        } else {
          lines.push('🏃 Long Run zu schnell gelaufen — HR deutlich über Ziel von 145 bpm');
        }
      } else if (plannedType.includes('Easy')) {
        if (hr <= 135) {
          lines.push('✅ Easy Run perfekt — HR unter 135 bpm, Grundlage wird aufgebaut');
        } else if (hr <= 143) {
          lines.push('⚠️ Easy Run grenzwertig — HR über 135 bpm, etwas langsamer wäre besser');
        } else {
          lines.push('❌ Easy Run zu intensiv — HR über 143 bpm, kein echter Grundlagenreiz');
        }
      } else {
        lines.push('📋 Kein Lauftag geplant — ungeplanter Lauf, gut für Flexibilität');
      }

      // 2. Herzfrequenz Detail
      if (hr <= 135) {
        lines.push('❤️ Herzfrequenz ' + avgHR + ' bpm — sehr gut, aerobe Basis wird gestärkt');
      } else if (hr <= 145) {
        lines.push('❤️ Herzfrequenz ' + avgHR + ' bpm — grenzwertig, Ziel ist unter 135 bpm');
      } else if (hr <= 160) {
        lines.push('❤️ Herzfrequenz ' + avgHR + ' bpm — zu hoch für Easy, passt für Long Run');
      } else {
        lines.push('❤️ Herzfrequenz ' + avgHR + ' bpm — Tempobereich, Max war ' + maxHR + ' bpm');
      }

      // 3. Pace Einschätzung
      if (paceTotalSec <= 340) {
        lines.push('⚡ Pace ' + pace + '/km — schnell, Temponiveau sehr gut');
      } else if (paceTotalSec <= 420) {
        lines.push('🏃 Pace ' + pace + '/km — solides Easy-Tempo, passt zur HR');
      } else if (paceTotalSec <= 480) {
        lines.push('🐢 Pace ' + pace + '/km — bewusst langsam, gut für Grundlage');
      } else {
        lines.push('🐢 Pace ' + pace + '/km — sehr langsam, Fokus auf HR-Kontrolle');
      }

      // 4. Distanz & PRs
      if (prCount > 0) {
        lines.push('🏆 ' + prCount + ' neue Bestzeit(en) — starke Leistung heute!');
      } else if (dist >= 15) {
        lines.push('📏 ' + distance + ' km — guter Long Run, Ausdauer wird aufgebaut');
      } else if (dist >= 7) {
        lines.push('📏 ' + distance + ' km — solide Distanz, im Plan');
      } else {
        lines.push('📏 ' + distance + ' km — kurze Einheit, reicht für Reiz');
      }

      // 5. Erholung
      if (days === 0 || days === 1) {
        lines.push('😴 Wenig Pause seit letztem Lauf — morgen Erholung einplanen');
      } else if (days === 2) {
        lines.push('😴 2 Tage Pause — gute Erholung, Beine sollten frisch sein');
      } else if (days === 3) {
        lines.push('😴 3 Tage Pause — sehr gut erholt, volle Leistung möglich');
      } else {
        lines.push('😴 ' + days + ' Tage Pause — lange Pause, Laufrhythmus wieder aufbauen');
      }

      return res.status(200).json({ analysis: lines.join('\n') });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
