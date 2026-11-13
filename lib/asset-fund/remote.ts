import { createClient } from "@/lib/supabase/client";
import type { AssetFundRow, SourceType, StoredData } from "./types";

const TABLE = "asset_fund_data";
const SINGLETON_ID = 1;

type Row = {
  id: number;
  file_name: string;
  uploaded_at: string;
  headers: string[];
  rows: AssetFundRow[];
  source_type: SourceType | null;
  warnings: string[] | null;
  delimiter: string | null;
  updated_at: string;
};

export async function loadRemote(): Promise<StoredData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "file_name, uploaded_at, headers, rows, source_type, warnings, delimiter",
    )
    .eq("id", SINGLETON_ID)
    .maybeSingle();

  if (error) {
    console.error("loadRemote error:", error);
    throw new Error(`Gagal baca data: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Pick<
    Row,
    | "file_name"
    | "uploaded_at"
    | "headers"
    | "rows"
    | "source_type"
    | "warnings"
    | "delimiter"
  >;
  return {
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    headers: row.headers ?? [],
    rows: row.rows ?? [],
    sourceType: row.source_type ?? "xlsx",
    warnings: row.warnings ?? [],
    delimiter: row.delimiter ?? undefined,
  };
}

export async function saveRemote(payload: StoredData): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      id: SINGLETON_ID,
      file_name: payload.fileName,
      uploaded_at: payload.uploadedAt,
      headers: payload.headers,
      rows: payload.rows,
      source_type: payload.sourceType,
      warnings: payload.warnings,
      delimiter: payload.delimiter ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("saveRemote error:", error);
    throw new Error(`Gagal simpan: ${error.message}`);
  }
}

export async function clearRemote(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", SINGLETON_ID);
  if (error) {
    console.error("clearRemote error:", error);
    throw new Error(`Gagal hapus: ${error.message}`);
  }
}
