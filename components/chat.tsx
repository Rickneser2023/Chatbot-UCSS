"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

interface DocInfo {
  name: string;
  pages: number;
}

interface WebInfo {
  pages: number;
  crawledAt: string;
}

const STORAGE_KEY = "ucss-chat-conversations-v1";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function loadAll(): Record<string, Conversation> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Conversation>) : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, Conversation>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // almacenamiento lleno o no disponible
  }
}

export default function Chat() {
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [web, setWeb] = useState<WebInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  const convo = activeId ? conversations[activeId] : undefined;
  const messages = convo?.messages ?? [];

  const sorted = useMemo(
    () =>
      Object.values(conversations).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [conversations]
  );

  useEffect(() => {
    const all = loadAll();
    const entries = Object.values(all);
    if (entries.length > 0) {
      entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setConversations(all);
      setActiveId(entries[0].id);
    } else {
      setActiveId(newId());
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (hydrated.current) saveAll(conversations);
  }, [conversations]);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setWeb(data.web ?? null);
      setNotice(null);
    } catch {
      // ignorar
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !activeId) return;
    setInput("");
    if (!conversations[activeId]) {
      setConversations((prev) => ({
        ...prev,
        [activeId]: { id: activeId, title: "Nueva conversación", messages: [], updatedAt: new Date().toISOString() },
      }));
    }
    setConversations((prev) => {
      const cur = prev[activeId];
      const msgs = [...(cur?.messages ?? []), { role: "user" as const, content: text }];
      const title =
        cur && cur.title !== "Nueva conversación" && cur.title
          ? cur.title
          : text.slice(0, 40) + (text.length > 40 ? "…" : "");
      return { ...prev, [activeId]: { id: activeId, title, messages: msgs, updatedAt: new Date().toISOString() } };
    });
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      const reply = data.reply ?? "...";
      setConversations((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        const msgs = [...cur.messages, { role: "assistant" as const, content: reply }];
        return { ...prev, [activeId]: { ...cur, messages: msgs, updatedAt: new Date().toISOString() } };
      });
    } catch {
      setConversations((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        const msgs = [...cur.messages, { role: "assistant" as const, content: "Hubo un error de conexión. Inténtalo de nuevo." }];
        return { ...prev, [activeId]: { ...cur, messages: msgs, updatedAt: new Date().toISOString() } };
      });
    } finally {
      setLoading(false);
    }
  };

  const newConversation = () => {
    const id = newId();
    setConversations((prev) => ({
      ...prev,
      [id]: { id, title: "Nueva conversación", messages: [], updatedAt: new Date().toISOString() },
    }));
    setActiveId(id);
    setInput("");
    setNotice(null);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (id === activeId) {
      const remaining = Object.values(conversations).filter((c) => c.id !== id);
      if (remaining.length > 0) {
        remaining.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setActiveId(remaining[0].id);
      } else {
        newConversation();
      }
    }
  };

  const exportTxt = () => {
    if (!convo || messages.length === 0) return;
    const lines = [
      `Conversación con el Asistente UCSS`,
      `Fecha: ${new Date(convo.updatedAt).toLocaleString("es-PE")}`,
      `Guardada: ${new Date().toLocaleString("es-PE")}`,
      "",
      ...messages.map(
        (m) => `${m.role === "user" ? "Tú" : "Asistente UCSS"}:\n${m.content}\n`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversacion-ucss-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    setNotice(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) {
        setNotice(`PDF "${data.document?.name}" indexado correctamente.`);
      } else {
        setNotice(data.error ?? "No se pudo subir el PDF.");
      }
      await loadDocuments();
    } catch {
      setNotice("Error de conexión al subir el PDF.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <button type="button" className="btn full" onClick={newConversation}>
          + Nueva conversación
        </button>
        <div className="convo-list">
          {sorted.length === 0 && <p className="convo-empty">Sin conversaciones aún.</p>}
          {sorted.map((c) => (
            <div key={c.id} className={`convo-item ${c.id === activeId ? "active" : ""}`}>
              <button
                type="button"
                className="convo-select"
                onClick={() => {
                  setActiveId(c.id);
                  setNotice(null);
                }}
              >
                <span className="convo-title">{c.title || "Conversación"}</span>
                <span className="convo-date">
                  {new Date(c.updatedAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </button>
              <button
                type="button"
                className="convo-delete"
                title="Eliminar"
                onClick={() => deleteConversation(c.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-shell">
        <header className="chat-header">
          <div className="chat-header-info">
            <span className="chat-logo">UCSS</span>
            <div>
              <h1>Asistente UCSS</h1>
              <p>Universidad Católica Sedes Sapientiae — Carreras, sedes, admisión y servicios</p>
            </div>
          </div>
          <div className="chat-header-actions">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            <button type="button" className="btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Subiendo…" : "+ Cargar PDF"}
            </button>
            <button type="button" className="btn" disabled={messages.length === 0} onClick={exportTxt}>
              Exportar
            </button>
          </div>
        </header>

        {(web && web.pages > 0) || documents.length > 0 ? (
          <div className="doc-bar">
            {web && web.pages > 0 && (
              <span>
                Web UCSS: {web.pages} secciones informativas
                {web.crawledAt ? ` (actualizado ${new Date(web.crawledAt).toLocaleDateString("es-PE")})` : ""}
              </span>
            )}
            {documents.map((d) => (
              <span key={d.name}>
                {d.name} ({d.pages} pág.)
              </span>
            ))}
          </div>
        ) : null}
        {notice && <div className="notice">{notice}</div>}

        <section className="chat-body">
          {messages.length === 0 && (
            <div className="welcome">
              <p>¡Hola! Soy el asistente de la UCSS.</p>
              <p>
                Conozco el sitio oficial de la universidad: puedo hablarte de{" "}
                <em>“Carreras y sedes”</em>, <em>“Modalidades y requisitos de admisión”</em>,{" "}
                <em>“Costos de matrícula”</em> y <em>“Becas y servicios”</em>.
              </p>
              <p className="welcome-hint">Tus conversaciones se guardan automáticamente en este navegador.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="bubble assistant typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          <div ref={bottomRef} />
        </section>

        <footer className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escribe tu pregunta sobre admisión…"
            disabled={loading}
          />
          <button type="button" onClick={send} disabled={loading || !input.trim()}>
            Enviar
          </button>
        </footer>
      </main>
    </div>
  );
}