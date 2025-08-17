import { useEffect, useState } from "react";

type Manual = {
  id: string;
  title: string;
  brand?: string;
  category?: string;
  tags?: string[];
  url?: string;
};

export default function Home() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Manual[]>([]);
  const [filtered, setFiltered] = useState<Manual[]>([]);

  useEffect(() => {
    fetch("/api/manuals")
      .then(r => r.json())
      .then((d: Manual[]) => {
        setData(d);
        setFiltered(d);
      });
  }, []);

  useEffect(() => {
    const needle = q.toLowerCase();
    setFiltered(
      data.filter(m =>
        [m.title, m.brand, m.category, (m.tags || []).join(" ")].join(" ")
          .toLowerCase()
          .includes(needle)
      )
    );
  }, [q, data]);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Manuals Search</h1>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by model, brand, tag…"
        style={{ width: "100%", padding: 12, fontSize: 16 }}
      />
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        {filtered.length} result{filtered.length === 1 ? "" : "s"}
      </p>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
        {filtered.map(m => (
          <li key={m.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{m.title}</div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              {m.brand ?? "—"} · {m.category ?? "—"}
            </div>
            {!!m.tags?.length && (
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.tags.map(t => (
                  <span key={t} style={{ fontSize: 12, border: "1px solid #ddd", borderRadius: 999, padding: "2px 8px" }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {m.url && (
              <a href={m.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
                Open manual
              </a>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
