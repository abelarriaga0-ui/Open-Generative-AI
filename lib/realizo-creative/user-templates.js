// Realizo: owner-private creative templates. No provider requests or costs.
export const USER_TEMPLATE_CATEGORIES=Object.freeze([
  {id:'ugc',label:'UGC'},
  {id:'cine_premium',label:'Cine Premium'},
  {id:'demostracion',label:'Demostración'},
  {id:'comercial',label:'Comercial'},
  {id:'otros',label:'Otros'},
]);
const LABELS=Object.fromEntries(USER_TEMPLATE_CATEGORIES.map(x=>[x.id,x.label]));
const MODELS=/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const WORKFLOWS=new Set(['animate_image','keyframes','references','edit_video','extend_uploaded_video','motion_transfer']);

export function classifyUserTemplate({prompt='',style=''}={}){
  const text=String(prompt).toLowerCase();
  const hint=String(style||'').toLowerCase().trim();
  // Priority matters: Premium prompts explicitly say "NOT UGC" and "NOT A DEMO".
  if(hint==='premium'||/luxury film|cine(?:ma)? premium|cinematogr[aá]fic[oa]|luxury product|style premium|estilo premium|hero packshot|product.only.*no.voice/i.test(text))
    return 'cine_premium';
  if(hint==='ugc'||/\bugc\b|user.generated.content|testimonio|selfie|testimonial|creador de contenido|hablando a c[aá]mara/i.test(text))
    return 'ugc';
  if(hint==='demo'||/demostraci[oó]n|tutorial|how.to.use|paso a paso|product demo/i.test(text))
    return 'demostracion';
  if(hint==='commercial'||/commercial ad|anuncio|venta directa|publicidad|oferta|sales angle|cta|comercial/i.test(text))
    return 'comercial';
  return 'otros';
}

function productFromPrompt(prompt){
  const text=String(prompt);
  const match=text.match(/(?:PRODUCT NAME\s*\(IDENTIFICATION ONLY\)|NOMBRE DEL PRODUCTO\s*\(SOLO IDENTIFICACI[OÓ]N\)|PRODUCT|PRODUCTO)\s*:\s*([^\n.;]{2,65})/i);
  return match?.[1]?.replace(/[<>{}]/g,'').trim()||null;
}

export function normalizeSavedTemplate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_template');
  const prompt=typeof input.prompt==='string'?input.prompt.trim():'';
  const model=String(input.model_id||'').trim();
  if(prompt.length<10||prompt.length>6000||model.length>100||!MODELS.test(model))
    throw Error('invalid_template');
  const duration=input.duration_seconds==null||input.duration_seconds===''?null:Number(input.duration_seconds);
  if(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>180))
    throw Error('invalid_template');
  const workflow=input.workflow_id==null||input.workflow_id===''?null:String(input.workflow_id);
  if(workflow!==null&&!WORKFLOWS.has(workflow))throw Error('invalid_template');
  const style=String(input.style||'').trim().slice(0,40);
  const category=classifyUserTemplate({prompt,style});
  const userTitle=typeof input.title==='string'?input.title.replace(/\s+/g,' ').trim().slice(0,85):'';
  const product=typeof input.product_name==='string'&&input.product_name.trim()
    ?input.product_name.replace(/\s+/g,' ').trim().slice(0,65):productFromPrompt(prompt);
  const title=userTitle||[LABELS[category],product].filter(Boolean).join(' · ')||LABELS[category];
  // Description is a short, safe preview; source media references and credentials
  // are never added separately to user templates.
  const description=prompt.replace(/https:\/\/[^\s]+/gi,'[referencia]').replace(/\s+/g,' ').slice(0,220);
  return {title,category,description,model_id:model,prompt,duration_seconds:duration,workflow_id:workflow};
}

export function templateSourceFromVideo(input,modelId,workflowId=null){
  // Captured when a paid request is already submitted; never store signed images
  // or videos, which expire and belong to a specific generation.
  if(typeof input?.prompt!=='string'||input.prompt.trim().length<10||
     input.prompt.length>6000)return null;
  try {
    const valid=normalizeSavedTemplate({
      prompt:input.prompt,model_id:modelId,duration_seconds:input.duration,
      workflow_id:workflowId
    });
    return JSON.stringify({prompt:valid.prompt,model_id:valid.model_id,
      duration_seconds:valid.duration_seconds,workflow_id:valid.workflow_id});
  }catch{return null;}
}
