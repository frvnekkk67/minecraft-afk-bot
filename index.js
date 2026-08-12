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

  function wyslijDlugaWiadomosc(text) {
    const chunks = text.match(/.{1,240}(\s|$)/g) || [text];
    chunks.forEach((c, i) => setTimeout(() => bot.chat(c.trim()), i * 700));
  }

  // === GEMINI AI ===
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
      let res;
      let proby = 0;
      while (proby < 3) {
        try {
          res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              contents: [
                {
                  parts: [
                    {
                      text:
                        "Jesteś pomocnym botem na serwerze Minecraft. Odpowiadasz krótko i konkretnie po polsku, np. na pytania o receptury craftingowe.\n\nPytanie: " +
                        pytanie
                    }
                  ]
                }
              ]
            }
          );
          break;
        } catch (e) {
          if (e.response?.status === 503 && proby < 2) {
            proby++;
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            throw e;
          }
        }
      }

      const odpowiedz = res.data.candidates[0].content.parts[0].text;
      wyslijDlugaWiadomosc(odpowiedz);
    } catch (err) {
      bot.chat("⚠️ Błąd AI: " + err.message);
    }
  });

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