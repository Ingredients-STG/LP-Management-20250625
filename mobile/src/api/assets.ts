import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './client';
import { Asset } from '../types/asset';

export function useAssetsQuery() {
  const api = useApiClient();
  return useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn: async () => {
      const res = await api.get('/assets');
      return res.data as Asset[];
    }
  });
}

export function useAssetQuery(assetId: string) {
  const api = useApiClient();
  return useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: async () => {
      const res = await api.get(`/assets/${assetId}`);
      return res.data as Asset;
    },
    enabled: !!assetId
  });
}

export function useCreateAsset() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Asset>) => {
      const res = await api.post('/assets', payload);
      return res.data as Asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
    }
  });
}

export function useUpdateAsset(assetId: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Asset>) => {
      const res = await api.put(`/assets/${assetId}`, payload);
      return res.data as Asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['asset', assetId] });
    }
  });
}

export function useDeleteAsset(assetId: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/assets/${assetId}`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
    }
  });
}
