// Netlify Function: Strava API Proxy
// Schützt Client Secret vor dem Browser

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const { action, code, refresh_token, access_token } = JSON.parse(
    event.body || "{}"
  );

  try {
    // 1. Erster Login: Auth-Code gegen Token tauschen
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
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 2. Token erneuern wenn abgelaufen
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
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 3. Aktivitäten abrufen
    if (action === "activities") {
      const res = await fetch(
        "https://www.strava.com/api/v3/athlete/activities?per_page=20",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 4. Athleten-Profil
    if (action === "athlete") {
      const res = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Unknown action" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
