import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/constants";
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

export function useGetDocumentDownloadUrl() {
  return useMutation({
    mutationFn: async (id: number): Promise<string> => {
      const { data } = await api.get<{ download_url: string; expires_in_seconds: number }>(
        `/documents/${id}`
      );
      const url = data.download_url;
      // In local dev mode the backend returns a relative path like
      // /dev/files/compliance-documents/{id}/....  Linking.openURL needs
      // an absolute URL, so prepend the API base (strip the /v1 suffix).
      if (url.startsWith("/")) {
        const base = (API_BASE_URL as string).replace(/\/v1\/?$/, "");
        return `${base}${url}`;
      }
      return url;
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