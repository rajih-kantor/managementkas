import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUS = ["pending", "verified", "rejected"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("pemasukan")
    .select("*")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const nama = String(body.nama_pengirim ?? "").trim();
  const nominal = Number(body.nominal);

  if (!nama || !Number.isFinite(nominal) || nominal <= 0) {
    return NextResponse.json(
      { error: "Nama pengirim dan nominal wajib diisi." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("pemasukan")
    .insert({
      nama_pengirim: nama,
      nominal,
      keterangan: body.keterangan?.trim() || null,
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

// Bulk verify/reject: { ids: string[], status }
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length || !VALID_STATUS.includes(body.status)) {
    return NextResponse.json(
      { error: "ids dan status valid wajib diisi." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("pemasukan")
    .update({ status: body.status })
    .in("id", ids);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
