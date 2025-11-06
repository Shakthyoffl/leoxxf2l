// ---------- YOUR SETTINGS ---------- //

const BOT_TOKEN = "8355355767:AAEVXfNMK2se1BX6kuW7obOWFG9xH5KLsds"; // 🔒 from @BotFather
const BOT_WEBHOOK = "https://leoxxf2l.shakthyoffl.workers.dev"; // e.g. https://leoxxf2l.shakthyoffl.workers.dev
const BOT_SECRET = "MySuperSecretKey_123"; // [A-Z, a-z, 0-9, _, -]
const BOT_OWNER = 7844061005; // your Telegram user id
const BOT_CHANNEL = -1002963111875; // your channel id (bot must be admin)
const SIA_SECRET = "1TamilMovie"; // a strong random key
const PUBLIC_BOT = true; // true = anyone can use bot, false = private

// ---------- SYSTEM SETTINGS (DON'T CHANGE) ---------- //

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WHITE_METHODS = ["GET", "POST", "HEAD"];
const HEADERS_FILE = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const HEADERS_ERRR = { "Access-Control-Allow-Origin": "*", "content-type": "application/json" };
const ERROR_404 = { ok: false, error_code: 404, description: "Bad Request: missing /?file= parameter" };

// ---------- MAIN HANDLER ---------- //

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const url = new URL(event.request.url);
  const file = url.searchParams.get("file");
  const mode = url.searchParams.get("mode") || "attachment";

  // ✅ FIXED: Telegram webhook endpoint
  if (url.pathname === "/webhook") {
    return Bot.handleWebhook(event);
  }

  // Register/unregister webhook or test bot
  if (url.pathname === "/registerWebhook") {
    return Bot.registerWebhook(event, url, BOT_WEBHOOK, BOT_SECRET);
  }
  if (url.pathname === "/unregisterWebhook") {
    return Bot.unregisterWebhook(event);
  }
  if (url.pathname === "/getMe") {
    return new Response(JSON.stringify(await Bot.getMe()), { headers: HEADERS_ERRR });
  }

  // File streaming logic
  if (!file) return Raise(ERROR_404, 404);
  if (!WHITE_METHODS.includes(event.request.method)) return Raise(ERROR_405, 405);

  try {
    await Cryptic.deHash(file);
  } catch {
    return Raise({ ok: false, error_code: 407, description: "Bad Request: file hash invalid" }, 404);
  }

  const channel_id = BOT_CHANNEL;
  const file_id = await Cryptic.deHash(file);
  const retrieve = await RetrieveFile(channel_id, file_id);
  if (retrieve.error_code) return Raise(retrieve, retrieve.error_code);

  const [rdata, rname, rsize, rtype] = retrieve;
  return new Response(rdata, {
    status: 200,
    headers: {
      "Content-Disposition": `${mode}; filename=${rname}`,
      "Content-Length": rsize,
      "Content-Type": rtype,
      ...HEADERS_FILE,
    },
  });
}

// ---------- UTILITIES ---------- //

async function Raise(json_error, status_code) {
  return new Response(JSON.stringify(json_error), { headers: HEADERS_ERRR, status: status_code });
}

async function UUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- FILE RETRIEVER ---------- //

async function RetrieveFile(channel_id, message_id) {
    let  fID; let fName; let fType; let fSize; let fLen;
    let data = await Bot.editMessage(channel_id, message_id, await UUID());
    if (data.error_code){return data}
    
    if (data.document){
        fLen = data.document.length - 1
        fID = data.document.file_id;
        fName = data.document.file_name;
        fType = data.document.mime_type;
        fSize = data.document.file_size;
    } else if (data.audio) {
        fLen = data.audio.length - 1
        fID = data.audio.file_id;
        fName = data.audio.file_name;
        fType = data.audio.mime_type;
        fSize = data.audio.file_size;
    } else if (data.video) {
        fLen = data.video.length - 1
        fID = data.video.file_id;
        fName = data.video.file_name;
        fType = data.video.mime_type;
        fSize = data.video.file_size;
    } else if (data.photo) {
        fLen = data.photo.length - 1
        fID = data.photo[fLen].file_id;
        fName = data.photo[fLen].file_unique_id + '.jpg';
        fType = "image/jpg";
        fSize = data.photo[fLen].file_size;
    } else {
        return ERROR_406
    }

    const file = await Bot.getFile(fID)
    if (file.error_code){return file}

    return [await Bot.fetchFile(file.file_path), fName, fSize, fType];
}

// ---------- CRYPTIC ENCODER ---------- //

class Cryptic {
  static async getSalt(len = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }
  static async getKey(salt, it = 1000, len = 32) {
    const k = new Uint8Array(len);
    for (let i = 0; i < len; i++)
      k[i] = (SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
    for (let j = 0; j < it; j++)
      for (let i = 0; i < len; i++)
        k[i] = (k[i] + SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
    return k;
  }
  static async baseEncode(input) {
    const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let o = "",
      b = 0,
      l = 0;
    for (let i = 0; i < input.length; i++) {
      b = (b << 8) | input.charCodeAt(i);
      l += 8;
      while (l >= 5) {
        o += a[(b >> (l - 5)) & 31];
        l -= 5;
      }
    }
    if (l > 0) o += a[(b << (5 - l)) & 31];
    return o;
  }
  static async baseDecode(input) {
    const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      m = {};
    for (let i = 0; i < a.length; i++) m[a[i]] = i;
    let b = 0,
      l = 0,
      o = "";
    for (let i = 0; i < input.length; i++) {
      b = (b << 5) | m[input[i]];
      l += 5;
      if (l >= 8) {
        o += String.fromCharCode((b >> (l - 8)) & 255);
        l -= 8;
      }
    }
    return o;
  }
  static async Hash(text) {
    const s = await this.getSalt();
    const k = await this.getKey(s);
    const e = String(text)
      .split("")
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k[i % k.length]))
      .join("");
    return await this.baseEncode(s + e);
  }
  static async deHash(h) {
    const d = await this.baseDecode(h);
    const s = d.substring(0, 16);
    const e = d.substring(16);
    const k = await this.getKey(s);
    return e
      .split("")
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k[i % k.length]))
      .join("");
  }
}

// ---------- TELEGRAM BOT CORE ---------- //

class Bot {
  static async handleWebhook(event) {
    if (event.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== BOT_SECRET)
      return new Response("Unauthorized", { status: 403 });

    const update = await event.request.json();
    event.waitUntil(this.Update(event, update));
    return new Response("OK", { status: 200 });
  }

  static async registerWebhook(event, url, base, secret) {
    const webhookUrl = `${base}/webhook`;
    const res = await fetch(`${API}/setWebhook?url=${webhookUrl}&secret_token=${secret}`);
    return new Response(await res.text(), { headers: HEADERS_ERRR });
  }

  static async unregisterWebhook() {
    const res = await fetch(`${API}/setWebhook?url=`);
    return new Response(await res.text(), { headers: HEADERS_ERRR });
  }

  static async getMe() {
    const res = await fetch(`${API}/getMe`);
    return await res.json();
  }

  static async sendMessage(chat_id, reply_id, text) {
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, reply_to_message_id: reply_id, text, parse_mode: "Markdown" }),
    });
    return await res.json();
  }

  static async sendDocument(chat_id, file_id) {
    const res = await fetch(`${API}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, document: file_id }),
    });
    return await res.json();
  }

  static async sendPhoto(chat_id, file_id) {
    const res = await fetch(`${API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, photo: file_id }),
    });
    return await res.json();
  }

  static async editMessage(channel_id, message_id, caption_text) {
    const res = await fetch(`${API}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel_id, message_id, caption: caption_text }),
    });
    return await res.json();
  }

  static async getFile(file_id) {
    const res = await fetch(`${API}/getFile?file_id=${file_id}`);
    return (await res.json()).result;
  }

  static async fetchFile(path) {
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
    return await res.arrayBuffer();
  }

  static async Update(event, update) {
    if (update.message) await onMessage(event, update.message);
  }
}

// ---------- MESSAGE HANDLER ---------- //

async function onMessage(event, message) {
  const url = new URL(event.request.url);

  // 👋 Respond to /start
  if (message.text === "/start") {
    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      "👋 *Welcome!* Send me any file and I’ll generate instant download & stream links."
    );
  }

  // Handle file uploads
  if (message.document) {
    const fID = message.document.file_id;
    const fName = message.document.file_name;
    const saved = await Bot.sendDocument(BOT_CHANNEL, fID);
    const fileMsg = saved.result.message_id;
    const hash = await Cryptic.Hash(fileMsg);
    const link = `${url.origin}/?file=${hash}`;
    const text = `*File:* \`${fName}\`\n[🔗 Download Link](${link})`;
    return Bot.sendMessage(message.chat.id, message.message_id, text);
  }

  return Bot.sendMessage(message.chat.id, message.message_id, "Send me a file to generate a link.");
}
