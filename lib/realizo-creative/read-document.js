// Extraction happens in the browser. Documents are never sent to an external AI
// service merely because a user selects a Word/PDF attachment.
export async function readProductDocument(file) {
  if(!file || file.size>5*1024*1024)throw new Error('El archivo debe pesar menos de 5 MB.');
  const name=String(file.name||'').toLowerCase();
  if(name.endsWith('.txt')){
    return (await file.text()).slice(0,16000);
  }
  if(name.endsWith('.docx')){
    const {unzipSync,strFromU8}=await import('fflate');
    const zip=unzipSync(new Uint8Array(await file.arrayBuffer()));
    const xml=zip['word/document.xml'];
    if(!xml)throw new Error('No se encontró el contenido del Word.');
    const doc=new DOMParser().parseFromString(strFromU8(xml),'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('El Word no contiene texto válido.');
    const paragraphs=Array.from(doc.getElementsByTagName('w:p'));
    const text=paragraphs.map(p=>Array.from(p.getElementsByTagName('w:t'))
      .map(t=>t.textContent||'').join('')).filter(Boolean).join('\n');
    if(!text.trim())throw new Error('El Word no contiene texto seleccionable.');
    return text.slice(0,16000);
  }
  if(name.endsWith('.pdf')){
    const pdfjs=await import('pdfjs-dist/webpack.mjs');
    const document=await pdfjs.getDocument({
      data:new Uint8Array(await file.arrayBuffer()),
      isEvalSupported:false,
      useSystemFonts:true,
    }).promise;
    const pages=Math.min(document.numPages,30);
    const words=[];
    for(let i=1;i<=pages;i++){
      const page=await document.getPage(i);
      const content=await page.getTextContent();
      words.push(content.items.map(item=>('str' in item?item.str:'')).join(' '));
      if(words.join('\n').length>=16000)break;
    }
    const text=words.join('\n').slice(0,16000);
    if(!text.trim())throw new Error('El PDF parece escaneado. Adjunta un documento con texto seleccionable.');
    return text;
  }
  throw new Error('Usa un archivo Word (.docx), PDF o TXT.');
}
