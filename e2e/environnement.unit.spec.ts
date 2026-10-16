import { test, expect } from '@playwright/test';
import { clientAdminAutorise } from '../src/lib/environnement';

// Garde-fou : jamais de client service_role dans un aperçu Vercel.
test('aperçu Vercel (Preview) : client admin refusé', () => {
  expect(clientAdminAutorise({ VERCEL_ENV: 'preview', SUPABASE_SERVICE_ROLE_KEY: 'cle' })).toBe(false);
});

test('production, développement Vercel, local et CI : client admin autorisé', () => {
  expect(clientAdminAutorise({ VERCEL_ENV: 'production' })).toBe(true);
  expect(clientAdminAutorise({ VERCEL_ENV: 'development' })).toBe(true);
  expect(clientAdminAutorise({})).toBe(true);
});
