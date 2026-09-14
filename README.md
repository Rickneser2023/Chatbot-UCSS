<div align="center">

# 🎓 Chatbot UCSS — Admisión

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-7-blue?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Groq](https://img.shields.io/badge/Groq_API-AI-8B5CF6?logo=stripe)
![RAG](https://img.shields.io/badge/RAG-BM25-10B981)

**Chatbot web de asistencia virtual de la Universidad Católica Sedes Sapientiae (UCSS).**

Responde consultas de postulantes, estudiantes y público en general basándose en la información del **sitio web oficial** (`ucss.edu.pe` y `admision.ucss.edu.pe`) y en **documentación oficial cargada** (PDFs de reglamentos de admisión).

</div>

---

## ✨ Características

- **Chat conversacional RAG** — Responde preguntas usando solo la información de los documentos y del sitio web oficial
- **Base de conocimiento del sitio UCSS** — Rastrea `www.ucss.edu.pe` y `admision.ucss.edu.pe` (carreras, sedes, facultades, admisión, costos y servicios)
- **Carga de PDFs** — Sube reglamentos y documentos oficiales directamente desde la interfaz
- **Búsqueda BM25** — Recuperación de información eficiente sin base de datos vectorial
- **Múltiples conversaciones** — Crea, alterna y elimina conversaciones independientes
- **Exportar chat** — Descarga la conversación como archivo de texto
- **Sin base de datos** — Persistencia en `localStorage` del navegador e índice en JSON
- **Diseño responsive** — Interfaz adaptada para escritorio con tema UCSS

## 🛠️ Tecnologías

| Categoría | Tecnología |
|-----------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| UI | [React 19](https://react.dev/) |
| Lenguaje | [TypeScript 7](https://www.typescriptlang.org/) (strict mode) |
| LLM | [Groq API](https://console.groq.com/) — `openai/gpt-oss-120b` |
| Extracción PDF | [unpdf](https://github.com/nicehash/unpdf) |
| Rastreo web | [cheerio](https://cheerio.js.org/) — script `npm run crawl` |
| Búsqueda | BM25 custom con stopwords en español |

## 🏗️ Arquitectura

El sistema funciona como un pipeline RAG (Retrieval-Augmented Generation):

```mermaid
flowchart LR
    A[🌐 Sitio web UCSS<br/>ucss.edu.pe + admision] --> B[Extracción y<br/>limpieza dí HTML]
    Q[📄 PDFs de reglamento] --> B
    B[Normalización<br/>cheerio] --> C[División en chunks<br/>~900-1000 chars]
    C --> D[Índice BM25<br/>data/docs.json]

    E[💬 Pregunta del usuario] --> F[Búsqueda BM25<br/>Top 6 chunks]
    D --> F
    F --> G[Construcción de contexto<br/>web con enlace + PDF]
    G --> H[Groq LLM<br/>GPT-OSS-120B]
    H --> I[✅ Respuesta en español]

    style A fill:#E8F4FD,stroke:#2196F3
    style H fill:#F3E5F5,stroke:#9C27B0
    style I fill:#E8F5E9,stroke:#4CAF50
```

### Flujo detallado

1. **Rastreo**: `npm run crawl` descarga las páginas listadas en `scripts/ucss-urls.json`, limpia el HTML y guarda los textos en `data/web/pages.json`
2. **Indexación**: Los PDFs se procesan con `unpdf` y las páginas web se dividen en chunks; todo se indexa con BM25
3. **Búsqueda**: Al recibir una pregunta, se recuperan los 6 chunks más relevantes (PDF o web)
4. **Generación**: El contexto se envía a Groq junto con el historial de la conversación
5. **Respuesta**: El LLM responde en español y cita el enlace oficial cuando usa información de la web

## 📋 Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- [npm](https://www.npmjs.com/) o gestor de paquetes equivalente
- API key de [Groq](https://console.groq.com/keys) (gratis)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/chatbot-ucss.git
cd chatbot-ucss
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura tu API key:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` y reemplaza el valor de `GROQ_API_KEY` con tu clave de API.

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

El chatbot estará disponible en [http://localhost:3000](http://localhost:3000).

## ⚙️ Variables de entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `GROQ_API_KEY` | API key de Groq para el modelo LLM | Sí |

> Obtén tu API key gratis en [console.groq.com/keys](https://console.groq.com/keys)

## 💡 Uso

1. **Actualizar el conocimiento web**: Ejecuta `npm run crawl` para re-rastrear el sitio oficial (carreras, sedes, admisión, costos y servicios)
2. **Subir documentos**: Haz clic en el ícono de documentos en la barra lateral para subir PDFs de reglamentos
3. **Iniciar conversación**: Escribe tu pregunta sobre admisión en el campo de texto
4. **Gestionar chats**: Crea nuevas conversaciones con el botón "+" en la barra lateral
5. **Exportar**: Descarga cualquier conversación como archivo `.txt`

## 📁 Estructura del proyecto

```
chatbot-ucss/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Endpoint principal del chat (RAG)
│   │   ├── documents/route.ts  # Lista documentos y secciones web indexadas
│   │   ├── upload/route.ts     # Sube y procesa PDFs
│   │   └── search/route.ts     # Búsqueda BM25 independiente
│   ├── layout.tsx              # Layout raíz y metadata
│   ├── page.tsx                # Página principal
│   └── globals.css             # Estilos globales
├── components/
│   └── chat.tsx                # Componente principal del chat
├── lib/
│   ├── groq.ts                 # Cliente Groq y system prompt
│   ├── index.ts                # Gestión del índice de documentos
│   ├── ingest.ts               # Extracción y chunking de PDFs
│   ├── web.ts                  # Carga y chunking de las páginas web
│   ├── search.ts               # Algoritmo BM25
│   └── types.ts                # Tipos y utilidades de normalización
├── scripts/
│   ├── crawl.mjs               # Rastreador del sitio web UCSS
│   └── ucss-urls.json          # Lista curada de URLs a rastrear
├── data/                       # (gitignored) Índice, PDFs y webs procesadas
├── .env.local.example          # Plantilla de variables de entorno
├── next.config.ts              # Configuración de Next.js
├── package.json                # Dependencias y scripts
└── tsconfig.json               # Configuración de TypeScript
```

## 📡 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/chat` | Envía un mensaje y obtiene respuesta RAG |
| `POST` | `/api/upload` | Sube un PDF para indexar (máx. 25 MB) |
| `GET` | `/api/documents` | Lista documentos PDF y secciones web indexadas |
| `GET` | `/api/search?q=...` | Busca chunks relevantes (para depuración) |

## 📦 Scripts disponibles

```bash
npm run crawl     # Rastrea el sitio web de la UCSS y genera la base de conocimiento
npm run dev       # Servidor de desarrollo con Turbopack
npm run build     # Build de producción
npm run start     # Iniciar servidor de producción
npm run lint      # Verificar código
```

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Haz commit de tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

<div align="center">

**Universidad Católica Sedes Sapientiae** — Proyecto de asistencia virtual para admisión

</div>
