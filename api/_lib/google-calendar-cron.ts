import { timingSafeEqual } from 'node:crypto';
import { calendarWorkStore } from './google-calendar-store.js';
import { processCalendarJob } from './google-calendar-worker.js';

export function validCalendarWorkerSecret(header: unknown, secret: string | undefined) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const actual=Buffer.from(header), expected=Buffer.from(`Bearer ${secret}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}

export async function calendarCron(req:any,res:any,env=process.env) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).end();
  if(!validCalendarWorkerSecret(req.headers?.authorization,env.CRON_SECRET))return res.status(401).json({code:'AUTH_REQUIRED'});
  if(env.GOOGLE_CALENDAR_AUTOMATION_ENABLED!=='true')return res.status(503).json({code:'CALENDAR_DISABLED'});
  try {
    return res.status(200).json(await processCalendarJob(calendarWorkStore(env)));
  }catch{return res.status(503).json({code:'CALENDAR_WORKER_UNAVAILABLE'});}
}
