const events=new Set(['login_success','login_failed','otp_throttled','webhook_rejected','ownership_denied','invalid_upload']);
export async function recordSecurityEvent(env,event){
  if(!events.has(event))return;
  console.info(JSON.stringify({component:'realizo_security',event}));
  try{
    const hour=Math.floor(Date.now()/3600000)*3600;
    await env.WALLETS_DB.prepare(
      'INSERT INTO realizo_security_events(hour_start,event_type,event_count) VALUES(?,?,1) '+
      'ON CONFLICT(hour_start,event_type) DO UPDATE SET event_count=event_count+1'
    ).bind(hour,event).run();
  }catch{
    console.error('realizo_security_event_write_failed');
  }
}
