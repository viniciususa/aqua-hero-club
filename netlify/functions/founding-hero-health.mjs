const jsonHeaders = {
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store"
};

function response(status, body){
  return new Response(JSON.stringify(body), {status, headers:jsonHeaders});
}

export default async (request) => {
  if(request.method !== "GET") return response(405,{ok:false,message:"Method not allowed."});

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;

  if(!supabaseUrl || !supabaseSecret){
    return response(503,{
      ok:false,
      configured:false,
      message:"Supabase environment variables are missing.",
      missing:[
        !supabaseUrl ? "SUPABASE_URL" : null,
        !supabaseSecret ? "SUPABASE_SECRET_KEY" : null
      ].filter(Boolean)
    });
  }

  try{
    const upstream = await fetch(
      `${supabaseUrl.replace(/\/$/,"")}/rest/v1/rpc/get_founding_hero_count`,
      {
        method:"POST",
        headers:{
          "content-type":"application/json",
          "apikey":supabaseSecret,
          "authorization":`Bearer ${supabaseSecret}`
        },
        body:"{}"
      }
    );
    const result = await upstream.json().catch(()=>null);
    if(!upstream.ok){
      return response(502,{
        ok:false,
        configured:true,
        message:"Supabase is connected, but the required SQL functions are unavailable.",
        upstreamStatus:upstream.status,
        upstreamResult:result
      });
    }
    return response(200,{ok:true,configured:true,database:true,count:result});
  }catch(error){
    return response(502,{ok:false,configured:true,message:"Could not reach Supabase."});
  }
};
