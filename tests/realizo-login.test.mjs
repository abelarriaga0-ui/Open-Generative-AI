import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAuthConfig } from '../lib/realizo-auth/config.js';
import { walletPilotAction, contentSecurityPolicy } from '../lib/wallet/request-policy.js';

test('own login remains unavailable until URL and publishable key are configured', () => {
  const url = process.env.NEXT_PUBLIC_REALIZO_AUTH_URL;
  const key = process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_REALIZO_AUTH_URL;
    delete process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY;
    assert.equal(publicAuthConfig(), null);
    process.env.NEXT_PUBLIC_REALIZO_AUTH_URL = 'https://attacker.example.com';
    process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY = 'sb_publishable_test';
    assert.equal(publicAuthConfig(), null);
    process.env.NEXT_PUBLIC_REALIZO_AUTH_URL = 'https://testproject.supabase.co/';
    assert.equal(publicAuthConfig().url, 'https://testproject.supabase.co');
  } finally {
    if (url === undefined) delete process.env.NEXT_PUBLIC_REALIZO_AUTH_URL;
    else process.env.NEXT_PUBLIC_REALIZO_AUTH_URL = url;
    if (key === undefined) delete process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY = key;
  }
});

test('wallet pilot admits only own login callback and authentication endpoints', () => {
  for (const path of ['/login', '/auth/callback', '/api/auth/me', '/api/auth/logout']) {
    assert.equal(walletPilotAction(path, true), 'allow', path);
  }
  for (const path of ['/api/v1/models', '/api/app/models', '/api/workflow/create']) {
    assert.equal(walletPilotAction(path, true), 'deny', path);
  }
  assert.equal(walletPilotAction('/studio', true), 'redirect');
  assert.equal(walletPilotAction('/login', false), 'allow');
});

test('third-party Auth connections are permitted only on own login route', () => {
  assert.match(contentSecurityPolicy('/login'), /connect-src[^;]*https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(contentSecurityPolicy('/wallet'), /connect-src[^;]*https:\/\/\*\.supabase\.co/);
});
