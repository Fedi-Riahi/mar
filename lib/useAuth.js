'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function useAuth() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') {
      setLoading(true);
    } else if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      });
      setLoading(false);
    } else {
      setError('Not authenticated');
      setLoading(false);
    }
  }, [session, status]);

  return { user, loading, error };
}