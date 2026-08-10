const mineflayer = require("mineflayer");
const express = require("express");
const fs = require("fs");
const axios = require("axios");

// KEEP ALIVE
const app = express();
app.get("/", (req, res) => res.send("AFK Bot działa ✅"));
app.listen(process.env.PORT || 5000, "0.0.0.0");

// LOAD CONFIG
const config = JSON.parse(fs.readFileSync("./config.json"));

let bot;
let afkTask;
let ostatnieZapytanie = 0;

function startBot() {
  console.log("🚀 Łączenie z serwerem...");

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: "offline"
  });

  bot.once("spawn", () => {
    console.log("✅ Bot wszedł na serwer");

    setTimeout(() => {
      bot.chat(`/login ${config.password}`);
    }, config.loginDelay);

    afkTask = setInterval(() => {
      bot.setControlState("jump", true);
      setTimeout(() => {
        bot.setControlState("jump", false);
      }, 300);
    }, config.afkInterval);
  });

  // AUTO REGISTER
  bot.on("messagestr", (msg) => {
    const m = msg.toLowerCase();
    if (m.includes("register")) {
      bot.chat(`/register ${config.password} ${config.password}`);
    }
  });

  // === GROQ AI ===
  bot.on("chat", async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith("!ai ")) return;

    const teraz = Date.now();
    if (teraz - ostatnieZapytanie < 8000) {
      bot.chat("Poczekaj chwilę zanim znów spytasz AI ⏳");
      return;
    }
    ostatnieZapytanie = teraz;

    const pytanie = message.slice(4).trim();
    if (!pytanie) return;

    try {
      const res = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "Jesteś pomocnym botem na serwerze Minecraft 26.2 aternos. Odpowiadasz krótko i zartobliwie, np. na pytania o receptury craftingowe, lub na pytania o swiecie."
            },
            { role: "user", content: pytanie }
          ]
        },
        { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }
      );

      const odpowiedz = res.data.choices[0].message.content;
      wyslijDlugaWiadomosc(odpowiedz);
    } catch (err) {
      bot.chat("⚠️ Błąd AI: " + err.message);
    }
  });

  function wyslijDlugaWiadomosc(text) {
    const chunks = text.match(/.{1,240}(\s|$)/g) || [text];
    chunks.forEach((c, i) => setTimeout(() => bot.chat(c.trim()), i * 700));
  }

  // RECONNECT
  bot.on("end", () => {
    console.log(`🔄 Rozłączono – reconnect za ${config.reconnectDelay / 1000}s`);
    if (afkTask) clearInterval(afkTask);
    setTimeout(startBot, config.reconnectDelay);
  });

  bot.on("error", (err) => {
    console.log("⚠️ Błąd:", err.message);
  });
}

startBot();