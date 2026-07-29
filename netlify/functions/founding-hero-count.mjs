const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=0, s-maxage=20, stale-while-revalidate=40"
};

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export default async (request) => {
  if (request.method !== "GET") return response(405, { message: "Method not allowed." });
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret) return response(503, { message: "Member database not connected." });

  try {
    const upstream = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_founding_hero_count`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": supabaseSecret,
        "authorization": `Bearer ${supabaseSecret}`
      },
      body: "{}"
    });
    const result = await upstream.json().catch(() => null);
    if (!upstream.ok || !result) return response(502, { message: "Count unavailable." });
    return response(200, result);
  } catch (error) {
    console.error("Count function error", error);
    return response(502, { message: "Count unavailable." });
  }
};
