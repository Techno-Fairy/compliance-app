// mobile/hooks/useReports.ts
// FE-17: Reports — period picker, generate, history list, share

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

export interface ReportRecord {
  id: number;
  period_label: string;   // e.g. "April 2024"
  report_type: string;    // "monthly" | "quarterly" | "annual"
  generated_at: string;   // ISO
  file_size_bytes: number;
  download_url: string;   // pre-signed S3 URL
}

export interface GenerateReportPayload {
  report_type: "monthly" | "quarterly" | "annual";
  year: number;
  month?: number;   // 1-12, required for monthly
  quarter?: number; // 1-4, required for quarterly
}

export function useReportHistory() {
  return useQuery<ReportRecord[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data } = await api.get<ReportRecord[]>("/reports");
      return data;
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateReportPayload) =>
      api.post<ReportRecord>("/reports/generate", payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export async function shareReport(report: ReportRecord): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing not available on this device.");

  // Download the PDF to a local temp file, then share
  const localUri = FileSystem.cacheDirectory + `report_${report.id}.pdf`;
  const download = await FileSystem.downloadAsync(report.download_url, localUri);

  await Sharing.shareAsync(download.uri, {
    mimeType: "application/pdf",
    dialogTitle: `${report.period_label} Compliance Report`,
    UTI: "com.adobe.pdf",
  });
}