import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
const require=createRequire(new URL('../sql/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');

// Loopback-only QA server. Synthetic identity injection is never imported by the app.
export function fixtureApi(){return {name:'isolated-agenda-fixture',async configureServer(server){
  const db=new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create function auth.uid() returns uuid language sql stable as $$select null::uuid$$; grant usage on schema auth to anon,authenticated,service_role;");
  const migrations=new URL('../../supabase/migrations/',import.meta.url);
  for(const name of (await readdir(migrations)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,migrations),'utf8'));
  for(const role of ['doctor','patient']){
    const row=(await db.query('select * from public.trustleaf_enroll_privy_actor($1,$2)',[`did:privy:fixture-${role}`,role])).rows[0];
    if(role==='doctor')await db.query("update trustleaf_private.actor_bindings set state='active' where actor_ref=$1",[row.actor_ref]);
  }
  await db.exec('set role service_role');
  server.httpServer?.once('close',()=>void db.close());
  server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,'http://127.0.0.1');if(url.pathname!=='/api/agenda')return next();
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const token=req.headers['privy-id-token'];
    if(!['fixture-doctor','fixture-patient'].includes(token)){res.statusCode=401;res.end('{}');return;}
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4000)throw new Error('too large');}
      const command=req.method==='GET'?{action:'list',input:{from:url.searchParams.get('from'),to:url.searchParams.get('to')}}:JSON.parse(body);
      const result=await db.query('select public.trustleaf_privy_agenda($1,$2,$3) as data',[`did:privy:${token}`,command.action,command.input]);
      res.end(JSON.stringify(result.rows[0].data));
    }catch(e){res.statusCode=e.code==='42501'?403:['40001','23505'].includes(e.code)?409:400;res.end(JSON.stringify({code:'FIXTURE_COMMAND_REJECTED'}));}
  });
}};}
