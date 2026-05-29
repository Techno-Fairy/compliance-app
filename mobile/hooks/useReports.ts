// mobile/hooks/useReports.ts
// FE-17: Reports — generate compliance PDF and share it
//
// Backend:
//   GET /reports/compliance-pdf?period=YYYY-MM  → streams PDF bytes directly
//
// expo-file-system v19 (SDK 54) removed the legacy constants
// (cacheDirectory, EncodingType, writeAsStringAsync) from the default export.
// The new API lives at 'expo-file-system/next' and uses File / Paths classes.
//
// Strategy:
//   fetch() with auth header → ArrayBuffer → base64 → File.write() → share URI

import { useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system/next";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/constants";

export interface GenerateReportPayload {
  report_type: "monthly" | "quarterly" | "annual";
  year: number;
  month?: number;    // 1-12, required for monthly
  quarter?: number;  // 1-4, required for quarterly
}

export interface GeneratedReport {
  localUri: string;    // file:// URI — ready to pass to expo-sharing
  period_label: string;
}

// ── Period param ──────────────────────────────────────────────────────────────
function buildPeriodParam(payload: GenerateReportPayload): string {
  if (payload.report_type === "monthly" && payload.month != null)
    return `${payload.year}-${String(payload.month).padStart(2, "0")}`;
  if (payload.report_type === "quarterly" && payload.quarter != null)
    return `${payload.year}-${String(payload.quarter * 3).padStart(2, "0")}`;
  return String(payload.year);
}

// ── Human-readable label ──────────────────────────────────────────────────────
const MONTHS   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const QUARTERS = ["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"];

export function buildPeriodLabel(payload: GenerateReportPayload): string {
  if (payload.report_type === "monthly" && payload.month != null)
    return `${MONTHS[payload.month - 1]} ${payload.year}`;
  if (payload.report_type === "quarterly" && payload.quarter != null)
    return `${QUARTERS[payload.quarter - 1]} ${payload.year}`;
  return `Full Year ${payload.year}`;
}

// ── ArrayBuffer → base64 (React Native safe — no FileReader / atob) ───────────
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192; // avoid stack overflow on large PDFs
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as any));
  }
  return btoa(binary);
}

// ── Fetch PDF → write to cache → return file:// URI ──────────────────────────
async function downloadPdfToCache(url: string, filename: string): Promise<string> {
  const token = await SecureStore.getItemAsync("access_token");

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  // expo-file-system/next API (SDK 54):
  //   Paths.cache  → cache directory URI
  //   new File(dir, name) → File object
  //   file.write(content, { encoding: "base64" }) → writes bytes
  //   file.uri → file:// URI for sharing
  const file = new File(Paths.cache, filename);
  await file.write(base64, { encoding: "base64" } as any);

  return file.uri;
}

// ── useGenerateReport ─────────────────────────────────────────────────────────
export function useGenerateReport() {
  return useMutation({
    mutationFn: async (payload: GenerateReportPayload): Promise<GeneratedReport> => {
      const period      = buildPeriodParam(payload);
      const periodLabel = buildPeriodLabel(payload);

      // API_BASE_URL = "http://<host>:8000/v1"
      const url = `${API_BASE_URL}/reports/compliance-pdf?period=${encodeURIComponent(period)}`;

      const filename = `CompliancePro_${periodLabel.replace(/[\s–()]+/g, "_")}_${Date.now()}.pdf`;
      const localUri = await downloadPdfToCache(url, filename);

      return { localUri, period_label: periodLabel };
    },
  });
}

// ── shareReport ───────────────────────────────────────────────────────────────
export async function shareReport(report: GeneratedReport): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error("Sharing is not available on this device.");

  await Sharing.shareAsync(report.localUri, {
    mimeType:    "application/pdf",
    dialogTitle: `${report.period_label} Compliance Report`,
    UTI:         "com.adobe.pdf",
  });
}