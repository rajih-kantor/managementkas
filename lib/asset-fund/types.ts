export type AssetFundValue = string | null;
export type AssetFundRow = Record<string, AssetFundValue>;

export type ParseResult = {
  rows: AssetFundRow[];
  headers: string[];
  fileName: string;
  uploadedAt: string;
};

export type StoredData = ParseResult;

export const REQUIRED_HEADERS = [
  "Name",
  "Asset Type",
  "Status",
  "Allow Switching",
] as const;

export const SECTION_MAP: Array<{ title: string; fields: string[] }> = [
  {
    title: "Identitas",
    fields: [
      "Avaloq Id",
      "UT Code",
      "Internal Id",
      "Reference",
      "Legacy Key",
      "Infovesta Code",
      "Name",
    ],
  },
  {
    title: "Klasifikasi",
    fields: [
      "Asset Type",
      "Asset Group",
      "Customer Segment",
      "Status",
      "Investment Category",
      "Market",
      "Product Category",
      "Risk Rating",
      "Syariah Status",
      "Diaspora",
      "PFM Category",
      "PFM Class",
      "PFM Market",
      "PFM Rating",
      "Product Knowledge",
    ],
  },
  {
    title: "Tanggal",
    fields: [
      "Open Date",
      "Close Date",
      "Issue Date",
      "Maturity Date",
      "IPO Period From",
      "IPO Period To",
      "IPO Settlement Date",
    ],
  },
  {
    title: "Info Produk",
    fields: [
      "Issuer",
      "Custodian Bank",
      "Asset Domicile",
      "Denominated CCY",
      "Issue Price",
      "Par Value",
      "Trade Unit",
      "Trade Unit MD",
      "Round Lot",
      "Round Lot MD",
    ],
  },
  {
    title: "Flag",
    fields: [
      "Enable RSP",
      "Allow Subscription",
      "Allow Redemption",
      "Allow Switching",
    ],
  },
  {
    title: "Limit Umum",
    fields: [
      "Max Holding (Amt/Unit)",
      "Max Redemption (in pct)",
      "Min Init Subscription Amt",
      "Max Init Subscription Amt",
      "Max Number of Investors",
      "Quota in Unit",
      "Quota in Amt",
    ],
  },
  {
    title: "Subscription",
    fields: [
      "Subscription - Branch - Min Amt",
      "Subscription - Branch - Max Amt",
      "Subscription - MB - Min Amt",
      "Subscription - MB - Max Amt",
    ],
  },
  {
    title: "Redemption",
    fields: [
      "Redemption - Branch - Min Amt",
      "Redemption - Branch - Max Amt",
      "Redemption - Branch - Min Qty",
      "Redemption - Branch - Max Qty",
      "Redemption - Branch - Min Balance After Trade",
      "Redemption - MB - Min Amt",
      "Redemption - MB - Max Amt",
      "Redemption - MB - Min Qty",
      "Redemption - MB - Max Qty",
      "Redemption - MB - Min Balance After Trade",
    ],
  },
  {
    title: "Switch",
    fields: [
      "Switch - Branch - Min Amt",
      "Switch - Branch - Max Amt",
      "Switch - Branch - Min Qty",
      "Switch - Branch - Max Qty",
      "Switch - Branch - Min Balance After Trade",
      "Switch - MB - Min Amt",
      "Switch - MB - Max Amt",
      "Switch - MB - Min Qty",
      "Switch - MB - Max Qty",
      "Switch - MB - Min Balance After Trade",
    ],
  },
  { title: "Dokumen", fields: ["Fund Fact Sheet URL", "Propectus URL"] },
];

export const URL_FIELDS = new Set(["Fund Fact Sheet URL", "Propectus URL"]);
export const DATE_FIELDS = new Set([
  "Open Date",
  "Close Date",
  "Issue Date",
  "Maturity Date",
  "IPO Period From",
  "IPO Period To",
  "IPO Settlement Date",
]);
export const BOOL_FIELDS = new Set([
  "Enable RSP",
  "Allow Subscription",
  "Allow Redemption",
  "Allow Switching",
]);
export const AMT_FIELDS = new Set([
  "Issue Price",
  "Par Value",
  "Max Holding (Amt/Unit)",
  "Min Init Subscription Amt",
  "Max Init Subscription Amt",
  "Max Number of Investors",
  "Quota in Unit",
  "Quota in Amt",
  "Subscription - Branch - Min Amt",
  "Subscription - Branch - Max Amt",
  "Subscription - MB - Min Amt",
  "Subscription - MB - Max Amt",
  "Redemption - Branch - Min Amt",
  "Redemption - Branch - Max Amt",
  "Redemption - Branch - Min Qty",
  "Redemption - Branch - Max Qty",
  "Redemption - Branch - Min Balance After Trade",
  "Redemption - MB - Min Amt",
  "Redemption - MB - Max Amt",
  "Redemption - MB - Min Qty",
  "Redemption - MB - Max Qty",
  "Redemption - MB - Min Balance After Trade",
  "Switch - Branch - Min Amt",
  "Switch - Branch - Max Amt",
  "Switch - Branch - Min Qty",
  "Switch - Branch - Max Qty",
  "Switch - Branch - Min Balance After Trade",
  "Switch - MB - Min Amt",
  "Switch - MB - Max Amt",
  "Switch - MB - Min Qty",
  "Switch - MB - Max Qty",
  "Switch - MB - Min Balance After Trade",
  "Trade Unit",
  "Trade Unit MD",
  "Round Lot",
  "Round Lot MD",
]);
