import type { NextApiRequest, NextApiResponse } from "next";
import data from "../../data/manuals.json";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json(data);
}
