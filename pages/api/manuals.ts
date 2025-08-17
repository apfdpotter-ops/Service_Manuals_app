import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const keyRaw = process.env.GOOGLE_SERVICE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "18cA7HjlJjvU5NN1-eEfJnvpMoxNyQboi";
    if (!keyRaw) throw new Error("Missing GOOGLE_SERVICE_KEY env var");

    const key = JSON.parse(keyRaw);

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    const drive = google.drive({ version: "v3", auth });

    const resp = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: "files(id,name,webViewLink,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 1000
    });

    const manuals =
      resp.data.files?.map((f) => ({
        id: f.id!,
        title: f.name || "Untitled",
        brand: undefined,        // optional; UI will show "—"
        category: undefined,     // optional
        tags: [],                // optional
        url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`
      })) ?? [];

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(manuals);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to fetch manuals" });
  }
}
