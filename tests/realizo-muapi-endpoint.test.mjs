import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedMuapiEndpoint} from '../lib/wallet/muapi-endpoint.js';
import {readFileSync} from 'node:fs';

test('official Wan 2.2 endpoint with version dot is allowed',()=>{
 assert.equal(isAllowedMuapiEndpoint('wan2.2-image-to-video'),true);
 assert.equal(isAllowedMuapiEndpoint('wan2.2-text-to-video'),true);
 assert.equal(isAllowedMuapiEndpoint('seedance-v1.5'),true);
});
test('remote URLs, path traversal, header delimiters and invalid slugs are blocked',()=>{
 for(const value of [
  'http://example.com/route','https://other.example','../secret',
  'wan2..2-image-to-video','wan2/2','wan2?token=x','wan2#fragment',
  'WAN2.2-IMAGE-TO-VIDEO','wan2%2F2','wan2\nX-Api-Key:secret',
  '/wan2.2','wan2.2/', 'wan2.2.', '',null,{},'a'.repeat(101)
 ])assert.equal(isAllowedMuapiEndpoint(value),false,String(value));
});
test('generation handler uses safely validated provider slug',()=>{
 const handler=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(handler,/isAllowedMuapiEndpoint\(model\.muapi_endpoint\)/);
 assert.doesNotMatch(handler,/\/\^\[A-Za-z0-9_-\]\+\$\//);
});
