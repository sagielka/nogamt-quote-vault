import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UspotItem {
  sku: string;
  desc: string;
}

export interface UchamfItem {
  [key: string]: string;
}

interface GitHubCatalogData {
  uspot: UspotItem[];
  uchamf: UchamfItem[];
  fetchedAt: string;
}

interface UseGitHubCatalogResult {
  uspotData: UspotItem[];
  uchamfData: UchamfItem[];
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;
  refetch: () => Promise<void>;
}

// Cache in memory to avoid refetching on every component mount
let cachedData: GitHubCatalogData | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useGitHubCatalog = (): UseGitHubCatalogResult => {
  const [uspotData, setUspotData] = useState<UspotItem[]>(cachedData?.uspot || []);
  const [uchamfData, setUchamfData] = useState<UchamfItem[]>(cachedData?.uchamf || []);
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(cachedData?.fetchedAt || null);

  const fetchCatalog = useCallback(async () => {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
      setUspotData(cachedData.uspot);
      setUchamfData(cachedData.uchamf);
      setLastFetched(cachedData.fetchedAt);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-github-catalog');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch catalog');
      }

      // Update cache
      cachedData = {
        uspot: data.uspot,
        uchamf: data.uchamf,
        fetchedAt: data.fetchedAt,
      };
      cacheTimestamp = now;

      setUspotData(data.uspot);
      setUchamfData(data.uchamf);
      setLastFetched(data.fetchedAt);
    } catch (err) {
      console.error('Error fetching GitHub catalog:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch catalog');
      
      // If we have cached data, use it as fallback
      if (cachedData) {
        setUspotData(cachedData.uspot);
        setUchamfData(cachedData.uchamf);
        setLastFetched(cachedData.fetchedAt);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  return {
    uspotData,
    uchamfData,
    isLoading,
    error,
    lastFetched,
    refetch: fetchCatalog,
  };
};

// Export a function to manually clear the cache (useful for testing)
export const clearGitHubCatalogCache = () => {
  cachedData = null;
  cacheTimestamp = 0;
};
