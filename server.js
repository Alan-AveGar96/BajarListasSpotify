import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// 🔥 Necesario para __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json());

// 🔥 SERVIR EL FRONTEND
app.use(express.static(path.join(__dirname, "public")));

// Ruta test
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// 🔥 API PLAYLIST
app.post("/api/playlist", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("spotify")) {
    return res.json({ error: "Playlist inválida" });
  }

  try {
    // 🔥 SIMULACIÓN (luego conectas Spotify real)
    const canciones = [
      {
        nombre: "Canción 1",
        artista: "Artista 1",
        youtube: "https://youtube.com"
      },
      {
        nombre: "Canción 2",
        artista: "Artista 2",
        youtube: "https://youtube.com"
      }
    ];

    res.json(canciones);

  } catch (error) {
    console.error(error);
    res.json({ error: "Error procesando playlist" });
  }
});

// Puerto
app.listen(3001, () => {
  console.log("🚀 Servidor en http://localhost:3001");
});