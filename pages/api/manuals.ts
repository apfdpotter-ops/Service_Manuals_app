import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Load service account key from env variable
    const key = JSON.parse(process.env.GOOGLE_SERVICE_KEY as string);

    const auth = new google.auth.JWT(
      key.client_email,
      undefined,
      key.private_key,
      ["https://www.googleapis.com/auth/drive.readonly"]
    );

    const drive = google.drive({ version: "v3", auth });

    // Use the folder ID from env var
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID as string;

    // List JSON files in the folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/json'`,
      fields: "files(id, name)",
    });

    const files = response.data.files || [];

    if (files.length === 0) {
      return res.status(404).json({ error: "No JSON files found in folder" });
    }

    // For now: just fetch the first JSON file
    const fileId = files[0].id as string;
    const file = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    let data = "";
    await new Promise<void>((resolve, reject) => {
      file.data.on("data", (chunk) => (data += chunk));
      file.data.on("end", () => resolve());
      file.data.on("error", (err) => reject(err));
    });

    const manuals = JSON.parse(data);
    res.status(200).json(manuals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
} });
  }
}
