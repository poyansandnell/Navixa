import { useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { fetchIsAdmin } from './api';

export interface UseIsAdmin {
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Resolves the current user's `profiles.is_admin` flag. Used to decide whether
 * to render the admin UI. The `admin-actions` Edge Function re-verifies admin
 * status server-side on every request, so this is a convenience gate only.
 */
export function useIsAdmin(): UseIsAdmin {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const id = user?.id;
    if (!id) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchIsAdmin(id)
      .then((ok) => {
        if (!cancelled) setIsAdmin(ok);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}
