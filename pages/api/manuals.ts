import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const url =
      "https://raw.githubusercontent.com/apfdpotter-ops/Service_Manuals_app/main/data/manuals.json";

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`);
    }

    const manuals = await response.json();
    res.status(200).json(manuals);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load manuals" });
  }
}
