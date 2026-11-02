import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

const catalogPath = new URL('../lib/conversion-templates/explosion-premium-azul.json', import.meta.url);
const template = JSON.parse(readFileSync(catalogPath, 'utf8'));

test('primera plantilla con dos referencias y modo estricto', () => {
  assert.equal(template.id, 'explosion-premium-azul');
  assert.equal(template.mode, 'strict-reference-image-edit');
  assert.deepEqual(template.referenceOrder, ['original_template', 'customer_product']);
  assert.deepEqual(template.replaceOnly, ['main_product_container']);
  assert.equal(template.aspectRatio, '2:3');
  assert.equal(template.version, 1);
});
test('recurso de catálogo existe y descripción bloqueada está configurada', () => {
  assert(existsSync(new URL('../public' + template.previewUrl, import.meta.url)));
  assert(template.lockedVisuals.length >= 5);
  assert.equal(template.fixedClaims.length, 5);
  assert(template.productSlot.x >= 0 && template.productSlot.x < 1);
  assert(template.productSlot.width > 0 && template.productSlot.x + template.productSlot.width <= 1);
});
test('backend impone mismo control de entorno y billetera', () => {
  const route = readFileSync(new URL('../app/api/conversion-templates/generate/route.js', import.meta.url), 'utf8');
  assert(route.includes('requireWalletUser'));
  assert(route.includes('isMuapiGenerationEnabled'));
  assert(route.includes('createReservedJob'));
  assert(route.includes('buildStrictTemplatePrompt'));
  assert(!route.includes('body.prompt'));
  assert(!route.includes('body.model_id'));
});
