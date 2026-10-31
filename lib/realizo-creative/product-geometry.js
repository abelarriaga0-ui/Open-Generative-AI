// Packaging geometry from the SAME image already used for Premium research.
// The image model estimates apparent proportions; it does NOT measure actual
// millimeters from an uncalibrated photograph. Never invent an exact scale.
const clean=(v,max=90)=>String(v??'').replace(/[\x00-\x1F]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const bounded=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
export function normalizeProductGeometry(input){
 if(!input||typeof input!=='object')return null;
 const products=(Array.isArray(input.products)?input.products:[]).slice(0,8).map(p=>({
  name:clean(p?.name,70),
  container_type:clean(p?.container_type,60),
  body_shape:clean(p?.body_shape,90),
  closure_type:clean(p?.closure_type,65),
  main_colors:clean(p?.main_colors,80),
 })).filter(p=>p.name);
 const names=new Set(products.map(p=>p.name.toLocaleLowerCase()));
 const pairs=(Array.isArray(input.relative_pairs)?input.relative_pairs:[]).slice(0,12)
  .filter(p=>p&&typeof p==='object')
  .map(p=>({
   larger:clean(p.larger,70),smaller:clean(p.smaller,70),
   same_depth:p.same_depth===true,confidence:['high','medium','low'].includes(p.confidence)?p.confidence:'low',
   // These are approximate apparent ratios ONLY when photographed at matching depth.
   apparent_height_ratio:bounded(p.apparent_height_ratio,1,8),
   apparent_width_ratio:bounded(p.apparent_width_ratio,1,8),
  }))
  .filter(p=>p.larger&&p.smaller&&p.larger.toLocaleLowerCase()!==p.smaller.toLocaleLowerCase()&&
   names.has(p.larger.toLocaleLowerCase())&&names.has(p.smaller.toLocaleLowerCase()));
 if(!products.length)return null;
 return {products,relative_pairs:pairs};
}
export function productGeometryPrompt(input){
 const g=normalizeProductGeometry(input);
 if(!g)return 'PACKAGING SCALE: Preserve the observed shape and realistic everyday size of each product shown in the original image. Never resize a bottle arbitrarily, stretch a cap or enlarge a label.';
 const items=g.products.map(x=>[x.name,x.container_type,x.body_shape,x.closure_type,x.main_colors]
  .filter(Boolean).join(' / ')).join('; ');
 const rules=g.relative_pairs.map(p=>{
  const identity=p.larger+' must remain visibly larger than '+p.smaller+
   ' whenever both products appear together at the same distance from the camera.';
  const trustworthy=p.same_depth&&['high','medium'].includes(p.confidence);
  const h=trustworthy&&p.apparent_height_ratio!==null?' approximately '+p.apparent_height_ratio.toFixed(2)+'x as tall':'';
  const w=trustworthy&&p.apparent_width_ratio!==null?' approximately '+p.apparent_width_ratio.toFixed(2)+'x as wide':'';
  return identity+((h||w)?' In the reference photo '+p.larger+' appears'+h+(h&&w?' and':'')+w+'; match this approximate hierarchy, not exact millimeters.':' Do not guess a numerical ratio from perspective-distorted or staged photographs.');
 }).join(' ');
 return 'PRODUCT PACKAGING GEOMETRY — HIGH PRIORITY: Product identities: '+items+
  '. Keep original container silhouette, body-to-cap proportions, pump/dropper size, label area and colors consistent in every shot. '+
  rules+' Show all products on a shared physical surface and similar camera depth when comparing size. Correct hand grip, plausible hand-to-bottle scale, stable shape across cuts; no giant mini bottles, shrinking containers, changing closures or distorted perspective. '+
  'The reference photo can establish only APPARENT relative scale, not certified real-world dimensions. Do not invent absolute measurements.';
}
