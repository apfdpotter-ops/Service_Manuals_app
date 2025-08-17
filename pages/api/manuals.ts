import type { NextApiRequest, NextApiResponse } from "next";
const response = await fetch(
  "https://raw.githubusercontent.com/apfdpotter-ops/Service_Manuals_app/main/data/manuals.json"
);
const manuals = await response.json();
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(data);
}
