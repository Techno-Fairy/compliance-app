// mobile/hooks/useReports.ts
// FE-17: Reports — generate compliance PDF and share it

import { useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system/next";
import { API_BASE_URL } from "@/constants";

export interface GenerateReportPayload {
  report_type: "monthly" | "quarterly" | "annual";
  year: number;
  month?: number;
  quarter?: number;
}

export interface GeneratedReport {
  localUri: string;
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

// ── ArrayBuffer → binary string ───────────────────────────────────────────────
// File.write() from expo-file-system/next stores whatever string you pass —
// passing the raw binary string (not base64) means bytes are stored as-is,
// producing a valid PDF that expo-sharing can open directly.
function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as any));
  }
  return binary;
}

// ── Fetch PDF → write to cache → return file:// URI ──────────────────────────
async function downloadPdfToCache(url: string, filename: string): Promise<string> {
  const token = await SecureStore.getItemAsync("access_token");

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw new Error(`${response.status}`);

  const buffer = await response.arrayBuffer();
  const binary = arrayBufferToBinaryString(buffer);

  const file = new File(Paths.cache, filename);
  file.write(binary);

  return file.uri;
}

// ── useGenerateReport ─────────────────────────────────────────────────────────
export function useGenerateReport() {
  return useMutation({
    mutationFn: async (payload: GenerateReportPayload): Promise<GeneratedReport> => {
      const period      = buildPeriodParam(payload);
      const periodLabel = buildPeriodLabel(payload);
      const url         = `${API_BASE_URL}/reports/compliance-pdf?period=${encodeURIComponent(period)}`;
      const filename    = `CompliancePro_${periodLabel.replace(/[\s–()]+/g, "_")}_${Date.now()}.pdf`;

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