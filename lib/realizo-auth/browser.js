'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicAuthConfig } from './config';

let singleton = null;
export function getRealizoBrowserAuth() {
  const config = publicAuthConfig();
  if (!config) return null;
  if (!singleton) {
    singleton = createBrowserClient(config.url, config.key);
  }
  return singleton;
}
