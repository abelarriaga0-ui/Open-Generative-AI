import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {
  documentType,prepareHyperrealDocumentContent,
  buildHyperrealDocumentRequest,parseHyperrealDocumentResponse
} from '../lib/realizo-creative/hyperreal-document.js';

const file=(name,bytes)=>({name,size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
test('reads Word product documentation into plain text without unknown invented claims',async()=>{
 const xml='<?xml version="1.0"?><w:document xmlns:w="word"><w:body>'+
  '<w:p><w:r><w:t>GODA fragancia para hombres &amp; adultos.</w:t></w:r></w:p>'+
  '<w:p><w:r><w:t>Presentación con gotero. Aplicación externa.</w:t></w:r></w:p>'+
  '</w:body></w:document>';
 const zipped=zipSync({'word/document.xml':strToU8(xml)});
 const read=await prepareHyperrealDocumentContent(file('producto.docx',zipped));
 assert.equal(read.kind,'docx');
 assert.match(read.text,/GODA fragancia para hombres & adultos/);
 assert.match(read.text,/Presentación con gotero/);
 assert.ok(!read.fileData);
 const request=buildHyperrealDocumentRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},read);
 assert.equal(request.background,true);
 assert.equal(request.model,'gpt-6-luna');
 assert.equal(request.input[0].content.some(e=>e.type==='input_file'),false);
});
test('PDF is forwarded as an image-aware input_file without persisting bytes',async()=>{
 const pdf=file('ficha.pdf',strToU8('%PDF-1.7\n1 0 obj\n<</Type/Catalog>>\nendobj\n'));
 const doc=await prepareHyperrealDocumentContent(pdf);
 assert.equal(doc.kind,'pdf');
 assert.match(doc.fileData,/^data:application\/pdf;base64,/);
 const request=buildHyperrealDocumentRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},doc);
 assert.equal(request.input[0].content.find(e=>e.type==='input_file').filename,'producto.pdf');
});
test('rejects non-documents and trims structured result to UI limits',async()=>{
 assert.throws(()=>documentType({name:'photo.png',size:200}),/unsupported_document/);
 await assert.rejects(prepareHyperrealDocumentContent(file('empty.txt',strToU8('A'))),/document_without_readable_text/);
 const values={product_name:'GODA',description:'Fragancia con gotero',
  audience:'Hombres',angle:'Rutina',usage:'Aplicación externa',safety_notes:'',
  missing_information:'No se precisa duración'};
 const response={output:[{content:[{type:'output_text',text:JSON.stringify(values)}]}]};
 assert.deepEqual(parseHyperrealDocumentResponse(response),values);
});
