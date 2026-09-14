// ============================================================
// File: app/api/reports/export-iuran/route.ts
// Updates:
//   - Tarif jabatan ambil dari DB (table `jabatan`)
//   - Hapus section "Keterangan" (Out legend)
//   - Layout row dinamis berdasarkan jumlah jabatan
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";

const COLOR = {
  headerGreen: "FFA9D08E",
  doneGreen: "FFD9EAD3",
  belumRed: "FFF4CCCC",
} as const;

const thinBorder = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

type LaporanRow = {
  pegawai_id: string;
  nama: string;
  npp: string;
  jenjang: string;
  periode: string;
  status: "lunas" | "belum" | "na";
  tanggal_transaksi: string | null;
};

type PegawaiMatrix = {
  nama: string;
  npp: string;
  jenjang: string;
  bulan: Map<string, { status: string; tanggal: string | null }>;
};

export async function POST(req: NextRequest) {
  try {
    const { start, end } = await req.json();

    if (!start || !end) {
      return NextResponse.json(
        { error: "Parameter start & end wajib diisi" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // ---------- 1. Fetch data laporan ----------
    const { data: laporanData, error: laporanErr } = await supabase.rpc(
      "laporan_iuran_detail",
      { p_start: start, p_end: end },
    );
    if (laporanErr) {
      return NextResponse.json({ error: laporanErr.message }, { status: 500 });
    }

    // ---------- 2. Fetch tarif jabatan (dinamis) ----------
    const { data: jabatanData, error: jabatanErr } = await supabase
      .from("jabatan")
      .select("nama, iuran_bulanan")
      .order("iuran_bulanan", { ascending: false }); // nominal terbesar → terkecil

    if (jabatanErr) {
      return NextResponse.json({ error: jabatanErr.message }, { status: 500 });
    }
    const tarifList = (jabatanData ?? []) as {
      nama: string;
      iuran_bulanan: number;
    }[];

    // ---------- 3. Transform → matrix (pegawai × bulan) ----------
    const pegawaiMap = new Map<string, PegawaiMatrix>();
    const periodeSet = new Set<string>();

    for (const row of (laporanData ?? []) as LaporanRow[]) {
      periodeSet.add(row.periode);
      if (!pegawaiMap.has(row.pegawai_id)) {
        pegawaiMap.set(row.pegawai_id, {
          nama: row.nama,
          npp: row.npp,
          jenjang: row.jenjang,
          bulan: new Map(),
        });
      }
      pegawaiMap.get(row.pegawai_id)!.bulan.set(row.periode, {
        status: row.status,
        tanggal: row.tanggal_transaksi,
      });
    }

    const periodes = Array.from(periodeSet).sort();
    const pegawaiList = Array.from(pegawaiMap.values()).sort((a, b) =>
      a.nama.localeCompare(b.nama),
    );

    // ---------- 4. Build workbook ----------
    const wb = new ExcelJS.Workbook();
    wb.creator = "Kas Kantor";
    wb.created = new Date();

    // Dynamic row positions
    const tarifStartRow = 3;
    const tarifEndRow = tarifStartRow + Math.max(tarifList.length, 1) - 1;
    const notesRow = tarifEndRow + 1;
    const tableHeaderRow1 = notesRow + 3; // gap 2 baris kosong
    const tableHeaderRow2 = tableHeaderRow1 + 1;
    const dataStartRow = tableHeaderRow2 + 1;

    const ws = wb.addWorksheet("Laporan Iuran", {
      views: [{ state: "frozen", xSplit: 4, ySplit: tableHeaderRow2 }],
    });

    // ---------- 4a. Header LinkAja ----------
    ws.getCell("B2").value = "LinkAja : 082351121587 (Zahra Ramadhanti)";
    ws.getCell("B2").font = { bold: true };

    // ---------- 4b. Tarif jabatan (dinamis dari DB) ----------
    tarifList.forEach((t, i) => {
      const rowNum = tarifStartRow + i;
      ws.getCell(`B${rowNum}`).value = t.nama;
      ws.getCell(`C${rowNum}`).value = t.iuran_bulanan;
      ws.getCell(`C${rowNum}`).numFmt = '"Rp"#,##0';
      ws.getCell(`B${rowNum}`).border = thinBorder;
      ws.getCell(`C${rowNum}`).border = thinBorder;
    });

    // ---------- 4c. Notes ----------
    ws.getCell(`B${notesRow}`).value = "Notes: Pembayaran hanya via LinkAja";
    ws.getCell(`B${notesRow}`).font = { bold: true, underline: true };

    // ---------- 4d. Table header ----------
    const totalCols = 4 + periodes.length * 2;

    ws.getCell(tableHeaderRow1, 1).value = "No";
    ws.getCell(tableHeaderRow1, 2).value = "Nama";
    ws.getCell(tableHeaderRow1, 3).value = "NPP";
    ws.getCell(tableHeaderRow1, 4).value = "Jenjang";

    ws.mergeCells(tableHeaderRow1, 1, tableHeaderRow2, 1);
    ws.mergeCells(tableHeaderRow1, 2, tableHeaderRow2, 2);
    ws.mergeCells(tableHeaderRow1, 3, tableHeaderRow2, 3);
    ws.mergeCells(tableHeaderRow1, 4, tableHeaderRow2, 4);

    periodes.forEach((periode, i) => {
      const startCol = 5 + i * 2;
      const endCol = startCol + 1;
      ws.mergeCells(tableHeaderRow1, startCol, tableHeaderRow1, endCol);

      const monthName = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(new Date(periode));

      ws.getCell(tableHeaderRow1, startCol).value =
        monthName.charAt(0).toUpperCase() + monthName.slice(1);
      ws.getCell(tableHeaderRow2, startCol).value = "Ket";
      ws.getCell(tableHeaderRow2, endCol).value = "Tanggal Transfer";
    });

    // Style header
    for (let r = tableHeaderRow1; r <= tableHeaderRow2; r++) {
      for (let c = 1; c <= totalCols; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR.headerGreen },
        };
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = thinBorder;
      }
    }

    // ---------- 4e. Data rows ----------
    pegawaiList.forEach((p, idx) => {
      const rowNum = dataStartRow + idx;
      const row = ws.getRow(rowNum);

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = p.nama;
      row.getCell(3).value = p.npp;
      row.getCell(4).value = p.jenjang;

      periodes.forEach((periode, pi) => {
        const b = p.bulan.get(periode);
        const ketCol = 5 + pi * 2;
        const tglCol = ketCol + 1;
        const ketCell = row.getCell(ketCol);
        const tglCell = row.getCell(tglCol);

        if (!b || b.status === "belum") {
          ketCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLOR.belumRed },
          };
          tglCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLOR.belumRed },
          };
        } else if (b.status === "lunas") {
          ketCell.value = "Done";
          ketCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLOR.doneGreen },
          };
          if (b.tanggal) {
            tglCell.value = new Date(b.tanggal);
            tglCell.numFmt = "dd/mm/yyyy";
          }
        }
        // status 'na' → kosong

        ketCell.alignment = { horizontal: "center", vertical: "middle" };
        tglCell.alignment = { horizontal: "center", vertical: "middle" };
      });

      for (let c = 1; c <= totalCols; c++) {
        row.getCell(c).border = thinBorder;
      }
    });

    // ---------- 4f. Column widths ----------
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 32;
    ws.getColumn(3).width = 12;
    ws.getColumn(4).width = 18;
    for (let i = 0; i < periodes.length; i++) {
      ws.getColumn(5 + i * 2).width = 10;
      ws.getColumn(6 + i * 2).width = 18;
    }

    // ---------- 5. Return blob ----------
    const buffer = await wb.xlsx.writeBuffer();
    const filename = `laporan-iuran-${start}-sd-${end}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Gagal generate Excel" },
      { status: 500 },
    );
  }
}
