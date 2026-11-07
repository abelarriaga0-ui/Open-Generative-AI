// New model families belong in small, independently reviewable modules.
// This keeps the existing canonical Muapi schema_data snapshot unchanged.
// Exact public Muapi API routes & fields verified on 2026-11-07.
// Endpoints are still re-verified by the server on price quote / generation.
const duration=(maximum)=>({type:'int',title:'Duración',name:'duration',default:5,minValue:3,maxValue:maximum,step:1});
const aspect={type:'string',name:'aspect_ratio',title:'Relación de aspecto',
 enum:['16:9','9:16','1:1','21:9'],default:'16:9'};
const resolution={type:'string',name:'resolution',title:'Resolución',
 enum:['720p','1080p'],default:'720p'};
const prompt={type:'string',name:'prompt',title:'Instrucciones',description:'Prompt comercial; máximo 8000 caracteres.'};
const frame={type:'string',field:'image',name:'first_frame_url',title:'Fotograma inicial'};
const refs={type:'array',field:'image',name:'image_urls',items:{type:'string'},
 minItems:1,maxItems:10,title:'Fotografías de referencia'};
const meta={provider:'kling',provider_name:'Kling AI',hasPrompt:true,promptRequired:true,promptMaxLength:8000};
export const KLING4_T2V_MODELS=Object.freeze([
 {...meta,id:'kling-4.0-text-to-video',name:'Kling 4.0 Texto a video',
  endpoint:'kling-4.0-text-to-video',inputs:{prompt,duration:duration(30),resolution,aspect_ratio:aspect}},
 {...meta,id:'kling-4.0-flash-text-to-video',name:'Kling 4.0 Flash Texto a video',
  endpoint:'kling-4.0-flash-text-to-video',inputs:{prompt,duration:duration(20),
    resolution:{...resolution,enum:['720p']},aspect_ratio:aspect}},
]);
export const KLING4_I2V_MODELS=Object.freeze([
 {...meta,id:'kling-4.0-reference-to-video',name:'Kling 4.0 Referencias',
  endpoint:'kling-4.0-reference-to-video',imageField:'image_urls',maxImages:10,
  required:['prompt','image_urls'],inputs:{prompt,image_urls:refs,duration:duration(30),
    resolution,aspect_ratio:{...aspect,enum:['auto',...aspect.enum],default:'auto'}}},
 {...meta,id:'kling-4.0-flash-reference-to-video',name:'Kling 4.0 Flash Referencias',
  endpoint:'kling-4.0-flash-reference-to-video',imageField:'image_urls',maxImages:10,
  required:['prompt','image_urls'],inputs:{prompt,image_urls:refs,duration:duration(20),
    resolution:{...resolution,enum:['720p']},
    aspect_ratio:{...aspect,enum:['auto',...aspect.enum],default:'auto'}}},
 {...meta,id:'kling-4.0-keyframe-to-video',name:'Kling 4.0 Fotograma inicial',
  endpoint:'kling-4.0-keyframe-to-video',imageField:'first_frame_url',
  required:['prompt','first_frame_url'],
  inputs:{prompt,first_frame_url:frame,duration:duration(30),resolution,
    aspect_ratio:{...aspect,enum:['auto',...aspect.enum],default:'auto'}}},
 {...meta,id:'kling-4.0-flash-keyframe-to-video',name:'Kling 4.0 Flash Fotograma inicial',
  endpoint:'kling-4.0-flash-keyframe-to-video',imageField:'first_frame_url',
  required:['prompt','first_frame_url'],
  inputs:{prompt,first_frame_url:frame,duration:duration(20),
    resolution:{...resolution,enum:['720p']},
    aspect_ratio:{...aspect,enum:['auto',...aspect.enum],default:'auto'}}},
]);
