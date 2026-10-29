'use client';
// Optimize a photo before the private Sandbox D1 upload. Original file stays local.
export async function optimizeImage(file,{maxBytes=850000,maxDimension=1600}={}) {
  if(file.size<=maxBytes) return file;
  const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  try {
    let scale=Math.min(1,maxDimension/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    for(let pass=0;pass<4;pass++){
      canvas.width=Math.max(1,Math.floor(image.width*scale));
      canvas.height=Math.max(1,Math.floor(image.height*scale));
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw new Error('No se pudo procesar la imagen.');
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [0.88,0.8,0.7,0.58]){
        const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',quality));
        if(blob && blob.size<=maxBytes)
          return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'});
      }
      scale*=0.75;
    }
    throw new Error('La imagen es demasiado grande. Intenta con otra foto.');
  } finally {image.close()}
}
