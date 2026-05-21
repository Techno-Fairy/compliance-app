import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Document } from "@/types";

// ── Fetch all documents (optionally filtered by category) ─────────────────────
export function useDocuments(category?: string) {
  return useQuery<Document[]>({
    queryKey: ["documents", category],
    queryFn: async () => {
      const params = category ? { category } : {};
      const { data } = await api.get<Document[]>("/documents", { params });
      return data;
    },
  });
}

// ── Upload a new document ─────────────────────────────────────────────────────
export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      filename: string;
      category: string;
      expiry_date?: string;
      fileBase64: string;
      mimeType: string;
    }) => {
      const { data } = await api.post<Document>("/documents", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

// ── Delete a document ─────────────────────────────────────────────────────────
export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}