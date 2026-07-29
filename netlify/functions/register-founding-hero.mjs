const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const allowedFlavors = new Set(["Watermelon", "Strawberry", "Lemon Lime", "Passion Fruit"]);

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.split(/([-’'])/).map((piece) => {
      if (/^[-’']$/.test(piece) || !piece) return piece;
      return piece.charAt(0).toLocaleUpperCase() + piece.slice(1).toLocaleLowerCase();
    }).join(""))
    .join(" ");
}

export default async (request) => {
  if (request.method === "OPTIONS") return response(204, {});
  if (request.method !== "POST") return response(405, { message: "Method not allowed." });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret) {
    return response(503, { message: "The secure member database is not connected yet." });
  }

  let body;
  try { body = await request.json(); }
  catch { return response(400, { message: "Invalid request." }); }

  if (body.website) return response(400, { message: "Invalid submission." });

  const firstName = normalizeName(body.firstName);
  const email = String(body.email || "").normalize("NFKC").trim().toLocaleLowerCase();
  const flavor = String(body.favoriteFlavor || "");
  const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’ .-]*$/u;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (firstName.length < 2 || firstName.length > 50 || !namePattern.test(firstName)) {
    return response(422, { message: "Please enter a valid first name." });
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return response(422, { message: "Please enter a valid email address." });
  }
  if (!allowedFlavors.has(flavor)) {
    return response(422, { message: "Please choose a favorite flavor." });
  }
  if (body.marketingConsent !== true) {
    return response(422, { message: "Consent is required to join the program." });
  }

  const rpcPayload = {
    p_email: email,
    p_first_name: firstName,
    p_favorite_flavor: flavor,
    p_source: String(body.source || "packaging_insert").slice(0, 80),
    p_campaign: String(body.campaign || "founding_heroes_1000").slice(0, 100),
    p_utm_source: String(body.utmSource || "").slice(0, 100),
    p_utm_medium: String(body.utmMedium || "").slice(0, 100),
    p_utm_campaign: String(body.utmCampaign || "").slice(0, 120)
  };

  try {
    const upstream = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/reserve_founding_hero`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": supabaseSecret,
        "authorization": `Bearer ${supabaseSecret}`
      },
      body: JSON.stringify(rpcPayload)
    });
    const result = await upstream.json().catch(() => null);
    if (!upstream.ok || !result) {
      console.error("Supabase registration error", upstream.status, result);
      return response(502, { message: "We could not reserve your status. Please try again." });
    }
    return response(200, result);
  } catch (error) {
    console.error("Registration function error", error);
    return response(502, { message: "We could not reserve your status. Please try again." });
  }
};
