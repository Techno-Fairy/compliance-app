import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Document } from "@/types";

export function useDocuments() {
  return useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data } = await api.get<Document[]>("/documents");
      return data;
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      uri,
      filename,
      mimeType,
      category,
      deadline_id,
      expiry_date,
      onProgress,
    }: {
      uri: string;
      filename: string;
      mimeType: string;
      category: string;
      deadline_id?: number;
      expiry_date?: string;
      onProgress?: (pct: number) => void;
    }) => {
      const form = new FormData();
      form.append("file", { uri, name: filename, type: mimeType } as any);
      form.append("category", category);
      if (deadline_id) form.append("deadline_id", String(deadline_id));
      if (expiry_date) form.append("expiry_date", expiry_date);

      const { data } = await api.post("/documents", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}