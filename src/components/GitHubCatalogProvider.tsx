import { useEffect } from 'react';
import { useGitHubCatalog } from '@/hooks/useGitHubCatalog';
import { setDynamicCatalogData } from '@/data/product-catalog';

interface GitHubCatalogProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that fetches the latest product catalog data from GitHub
 * and populates the dynamic catalog data store.
 * 
 * This should wrap the main app or at least the components that use the product catalog.
 */
export const GitHubCatalogProvider = ({ children }: GitHubCatalogProviderProps) => {
  const { uspotData, uchamfData, isLoading, error } = useGitHubCatalog();

  useEffect(() => {
    // Update the dynamic catalog data when GitHub data is loaded
    if (uspotData.length > 0 || uchamfData.length > 0) {
      setDynamicCatalogData(uspotData, uchamfData);
      console.log(`[GitHubCatalog] Updated catalog with ${uspotData.length} uspot and ${uchamfData.length} uchamf items`);
    }
  }, [uspotData, uchamfData]);

  // Log loading/error states for debugging
  useEffect(() => {
    if (isLoading) {
      console.log('[GitHubCatalog] Fetching latest catalog data from GitHub...');
    }
    if (error) {
      console.warn('[GitHubCatalog] Error fetching from GitHub, using fallback data:', error);
    }
  }, [isLoading, error]);

  return <>{children}</>;
};

export default GitHubCatalogProvider;
