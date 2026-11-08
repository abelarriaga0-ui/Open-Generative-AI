import test from 'node:test';
import assert from 'node:assert/strict';
import { walletPilotAction } from '../lib/wallet/request-policy.js';

test('Chrome can read the Realizo PWA manifest before login in production', () => {
  assert.equal(walletPilotAction('/manifest.webmanifest', true, true), 'allow');
  assert.equal(walletPilotAction('/icons/realizo-192.png', true, true), 'allow');
  assert.equal(walletPilotAction('/icons/realizo-512.png', true, true), 'allow');
  assert.equal(walletPilotAction('/studio', true, true), 'allow');
});

test('PWA public metadata does not broaden paid wallet or private API access', () => {
  assert.equal(walletPilotAction('/private-page', true, true), 'redirect');
  assert.equal(walletPilotAction('/api/realizo/unsafe-private-path', true, true), 'deny');
});
