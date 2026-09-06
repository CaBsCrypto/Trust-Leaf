import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
const errors=[];const rows=[];const commands=[];
const operations=new Set();let loseResponse=false;
const output=new URL('../../scratch/agenda-qa/',import.meta.url);await mkdir(output,{recursive:true});
const {fileURLToPath}=await import('node:url');
async function open(role,viewport={width:1280,height:850}){
  const context=await browser.newContext({viewport,timezoneId:'America/Santiago'});const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/agenda**',async route=>{
    const request=route.request();
    if(request.method()==='GET')return route.fulfill({json:{role,slots:rows.filter(r=>role==='doctor'||r.state==='published'||r.patient===role).map(r=>({...r,bookingRef:role==='doctor'||r.patient===role?r.bookingRef:null,bookingState:role==='doctor'||r.patient===role?r.bookingState:null}))}});
    const body=request.postDataJSON();commands.push(body);
    if(operations.has(body.input.operationId))return route.fulfill({json:{replayed:true}});
    operations.add(body.input.operationId);
    if(body.action==='publish')rows.push({...body.input,doctorRef:'11111111-1111-4111-8111-111111111111',state:'published',version:1,bookingRef:null,bookingState:null});
    const row=rows.find(r=>r.slotRef===body.input.slotRef);
    if(body.action==='reserve'){row.state='booked';row.version++;row.bookingRef=body.input.bookingRef;row.bookingState='confirmed';row.patient=role;}
    if(body.action==='cancel-booking'){row.state=role==='doctor'?'cancelled':'published';row.version++;row.bookingState='cancelled';}
    if(loseResponse){loseResponse=false;return route.fulfill({status:503,json:{code:'UNAVAILABLE'}});}
    return route.fulfill({json:{resourceRef:body.input.bookingRef??body.input.slotRef,replayed:false}});
  });
  await page.goto(`${process.env.AGENDA_FIXTURE_URL ?? 'http://127.0.0.1:4317'}/?role=${role}`);return page;
}
try{
  const doctor=await open('doctor');
  await doctor.getByRole('button',{name:'Publicar horario',exact:true}).click();
  await doctor.getByText('Disponible',{exact:true}).waitFor();
  assert.equal(commands.filter(c=>c.action==='publish').length,1);
  await doctor.reload();await doctor.getByText('Disponible',{exact:true}).waitFor();
  const patient=await open('patient',{width:390,height:844});
  await patient.getByRole('button',{name:'Reservar',exact:true}).click();
  await patient.getByText('Cita confirmada',{exact:true}).waitFor();
  await doctor.getByRole('button',{name:'Actualizar agenda',exact:true}).click();
  await doctor.getByText('Cita confirmada',{exact:true}).waitFor();
  await doctor.screenshot({path:fileURLToPath(new URL('doctor-desktop.png',output)),fullPage:true});
  await patient.screenshot({path:fileURLToPath(new URL('patient-mobile.png',output)),fullPage:true});
  for(const page of [doctor,patient])assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  const booking=commands.find(c=>c.action==='reserve').input.bookingRef;
  assert.equal(await doctor.getByText(`Reserva ${booking}`,{exact:true}).count(),1);
  patient.on('dialog',dialog=>dialog.accept());
  await patient.getByRole('button',{name:'Cancelar cita',exact:true}).click();
  await patient.getByRole('button',{name:'Reservar',exact:true}).waitFor();
  await patient.reload();await patient.getByRole('button',{name:'Reservar',exact:true}).waitFor();
  loseResponse=true;
  await patient.getByRole('button',{name:'Reservar',exact:true}).click();
  await patient.getByRole('button',{name:'Reintentar cambio',exact:true}).click();
  await patient.getByText('Cita confirmada',{exact:true}).waitFor();
  assert.equal(commands.at(-1).input.operationId,commands.at(-2).input.operationId,'uncertain writes retain their idempotency key');
  assert.deepEqual(errors,[]);
  console.log('PASS: real React component, mocked HTTP: publish, reload, patient booking, doctor confirmation, cancel, mobile/desktop layout. Not real Privy or hosted Supabase.');
}finally{await browser.close();}
