// Only trust finalized Muapi provider outputs stored on an owned generation job.
const trusted=value=>{
  try{
    const u=new URL(value);
    return u.protocol==='https:' && u.hostname==='cdn.muapi.ai' &&
      /^\/outputs\/[a-zA-Z0-9/_-]+\.mp4$/.test(u.pathname) && !u.search && !u.hash;
  }catch{return false;}
};
export function extractOwnedDownloadUrl(job){
  if(job?.status!=='completed'||!job.result_json)return null;
  try{
    const data=JSON.parse(job.result_json);
    const choices=[data.url,data.output_url,data.output?.url,data.outputs?.[0]?.url,
      data.outputs?.[0],data.output?.[0]];
    return choices.find(x=>typeof x==='string'&&trusted(x))||null;
  }catch{return null;}
}
