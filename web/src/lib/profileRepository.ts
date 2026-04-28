import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../types';
import { supabase } from './supabase';

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
};

function getFallbackDisplayName(user: SupabaseUser): string {
  if (typeof user.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim().length > 0) {
    return user.user_metadata.display_name.trim();
  }
  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0];
  }
  return '用户';
}

export function buildUiUser(user: SupabaseUser, profile?: Partial<ProfileRow> | null): User {
  const email = profile?.email?.trim() || user.email || 'unknown@example.com';
  const displayName = profile?.display_name?.trim() || getFallbackDisplayName(user);
  const avatar = displayName.slice(0, 2).toUpperCase();

  return {
    id: user.id,
    name: displayName,
    email,
    avatar
  };
}

export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) || null;
}

export async function getUserWithProfile(user: SupabaseUser): Promise<User> {
  try {
    const profile = await getUserProfile(user.id);
    return buildUiUser(user, profile);
  } catch (error) {
    console.warn('[profile] failed to load profile, falling back to auth metadata', error);
    return buildUiUser(user, null);
  }
}

export async function upsertUserProfile(user: SupabaseUser, displayName: string): Promise<void> {
  const normalizedDisplayName = displayName.trim() || getFallbackDisplayName(user);
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email || 'unknown@example.com',
        display_name: normalizedDisplayName
      },
      { onConflict: 'id' }
    );

  if (error) {
    throw error;
  }
}
