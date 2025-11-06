// ---------- Insert Your Data ---------- //

const BOT_TOKEN = "8355355767:AAH6moCMT72FfRXmBB3DtvJy5gJQdhjqrUs"; // Get this from @BotFather
const BOT_WEBHOOK = "leoxxf2l.shakthyoffl.workers.dev/"; // e.g. https://leoxxf2l.shakthyoffl.workers.dev
const BOT_SECRET = "MySuperSecretKey_123"; // Only [A-Z, a-z, 0-9, _, -]
const BOT_OWNER = 7844061005; // Your Telegram user ID (from @idbot)
const BOT_CHANNEL = -1002963111875; // Channel ID (bot must be admin)
const SIA_SECRET = "Error404"; // A strong random key
const PUBLIC_BOT = true; // true = anyone can use bot, false = private

// ---------- Do Not Modify Below ---------- //

const WHITE_METHODS = ["GET", "POST", "HEAD"];
const HEADERS_FILE = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const HEADERS_ERRR = { "Access-Control-Allow-Origin": "*", "content-type": "application/json" };
const ERROR_404 = {
  ok: false,
  error_code: 404,
  description: "Bad Request: missing /?file= parameter",
  credit: "https://github.com/vauth/filestream-cf",
};
const ERROR_405 = { ok: false, error_code: 405, description: "Bad Request: method not allowed" };
const ERROR_406 = { ok: false, error_code: 406, description: "Bad Request: file type invalid" };
const ERROR_407 = { ok: false, error_code: 407, description: "Bad Request: file hash invalid by atob" };
const ERROR_408 = { ok: false, error_code: 408, description: "Bad Request: mode not in [attachment, inline]" };

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const url = new URL(event.request.url);
  const file = url.searchParams.get("file");
  const mode = url.searchParams.get("mode") || "attachment";

  if (url.pathname === "/webhook") return Bot.handleWebhook(event);
  if (url.pathname === "/registerWebhook") return Bot.registerWebhook(event, url, BOT_WEBHOOK, BOT_SECRET);
  if (url.pathname === "/unregisterWebhook") return Bot.unregisterWebhook(event);
  if (url.pathname === "/getMe") return new Response(JSON.stringify(await Bot.getMe()), { headers: HEADERS_ERRR, status: 202 });

  if (!file) return Raise(ERROR_404, 404);
  if (!["attachment", "inline"].includes(mode)) return Raise(ERROR_408, 404);
  if (!WHITE_METHODS.includes(event.request.method)) return Raise(ERROR_405, 405);

  try {
    await Cryptic.deHash(file);
  } catch {
    return Raise(ERROR_407, 404);
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

// ---------- Retrieve File ---------- //

async function RetrieveFile(channel_id, message_id) {
  let fID, fName, fType, fSize;
  const data = await Bot.editMessage(channel_id, message_id, await UUID());
  if (data.error_code) return data;

  if (data.document) {
    fID = data.document.file_id;
    fName = data.document.file_name;
    fType = data.document.mime_type;
    fSize = data.document.file_size;
  } else if (data.audio) {
    fID = data.audio.file_id;
    fName = data.audio.file_name;
    fType = data.audio.mime_type;
    fSize = data.audio.file_size;
  } else if (data.video) {
    fID = data.video.file_id;
    fName = data.video.file_name;
    fType = data.video.mime_type;
    fSize = data.video.file_size;
  } else if (data.photo) {
    fID = data.photo[data.photo.length - 1].file_id;
    fName = data.photo[data.photo.length - 1].file_unique_id + ".jpg";
    fType = "image/jpg";
    fSize = data.photo[data.photo.length - 1].file_size;
  } else return ERROR_406;

  const file = await Bot.getFile(fID);
  if (file.error_code) return file;

  return [await Bot.fetchFile(file.file_path), fName, fSize, fType];
}

// ---------- Raise Error ---------- //

async function Raise(json_error, status_code) {
  return new Response(JSON.stringify(json_error), { headers: HEADERS_ERRR, status: status_code });
}

// ---------- UUID Generator ---------- //

async function UUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- Hash Generator ---------- //

class Cryptic {
  static async getSalt(length = 16) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let salt = "";
    for (let i = 0; i < length; i++) salt += characters.charAt(Math.floor(Math.random() * characters.length));
    return salt;
  }

  static async getKey(salt, iterations = 1000, keyLength = 32) {
    const key = new Uint8Array(keyLength);
    for (let i = 0; i < keyLength; i++)
      key[i] = (SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
    for (let j = 0; j < iterations; j++) {
      for (let i = 0; i < keyLength; i++)
        key[i] = (key[i] + SIA_SECRET.charCodeAt(i % SIA_SECRET.length) + salt.charCodeAt(i % salt.length)) % 256;
    }
    return key;
  }

  static async baseEncode(input) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let output = "",
      buffer = 0,
      bitsLeft = 0;
    for (let i = 0; i < input.length; i++) {
      buffer = (buffer << 8) | input.charCodeAt(i);
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        output += alphabet[(buffer >> (bitsLeft - 5)) & 31];
        bitsLeft -= 5;
      }
    }
    if (bitsLeft > 0) output += alphabet[(buffer << (5 - bitsLeft)) & 31];
    return output;
  }

  static async baseDecode(input) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const lookup = {};
    for (let i = 0; i < alphabet.length; i++) lookup[alphabet[i]] = i;
    let buffer = 0,
      bitsLeft = 0,
      output = "";
    for (let i = 0; i < input.length; i++) {
      buffer = (buffer << 5) | lookup[input[i]];
      bitsLeft += 5;
      if (bitsLeft >= 8) {
        output += String.fromCharCode((buffer >> (bitsLeft - 8)) & 255);
        bitsLeft -= 8;
      }
    }
    return output;
  }

  static async Hash(text) {
    const salt = await this.getSalt();
    const key = await this.getKey(salt);
    const encoded = String(text)
      .split("")
      .map((char, index) => String.fromCharCode(char.charCodeAt(0) ^ key[index % key.length]))
      .join("");
    return await this.baseEncode(salt + encoded);
  }

  static async deHash(hashed) {
    const decoded = await this.baseDecode(hashed);
    const salt = decoded.substring(0, 16);
    const encoded = decoded.substring(16);
    const key = await this.getKey(salt);
    const text = encoded
      .split("")
      .map((char, index) => String.fromCharCode(char.charCodeAt(0) ^ key[index % key.length]))
      .join("");
    return text;
  }
}

// ---------- Telegram Bot Core ---------- //

class Bot {
  static async handleWebhook(event) {
    if (event.request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== BOT_SECRET)
      return new Response("Unauthorized", { status: 403 });
    const update = await event.request.json();
    event.waitUntil(this.Update(event, update));
    return new Response("OK");
  }

  static async registerWebhook(event, requestUrl, suffix, secret) {
    const webhookUrl = `${BOT_WEBHOOK}/webhook`;
    const response = await fetch(await this.apiUrl("setWebhook", { url: webhookUrl, secret_token: secret }));
    return new Response(JSON.stringify(await response.json()), { headers: HEADERS_ERRR });
  }

  static async unregisterWebhook() {
    const response = await fetch(await this.apiUrl("setWebhook", { url: "" }));
    return new Response(JSON.stringify(await response.json()), { headers: HEADERS_ERRR });
  }

  static async getMe() {
    const response = await fetch(await this.apiUrl("getMe"));
    return await response.json();
  }

  static async sendMessage(chat_id, reply_id, text, reply_markup = []) {
    const response = await fetch(await this.apiUrl("sendMessage", {
      chat_id,
      reply_to_message_id: reply_id,
      parse_mode: "Markdown",
      text,
      reply_markup: JSON.stringify({ inline_keyboard: reply_markup }),
    }));
    return await response.json();
  }

  static async sendDocument(chat_id, file_id) {
    const response = await fetch(await this.apiUrl("sendDocument", { chat_id, document: file_id }));
    return await response.json();
  }

  static async sendPhoto(chat_id, file_id) {
    const response = await fetch(await this.apiUrl("sendPhoto", { chat_id, photo: file_id }));
    return await response.json();
  }

  static async editMessage(channel_id, message_id, caption_text) {
    const response = await fetch(await this.apiUrl("editMessageCaption", {
      chat_id: channel_id,
      message_id,
      caption: caption_text,
    }));
    return await response.json();
  }

  static async getFile(file_id) {
    const response = await fetch(await this.apiUrl("getFile", { file_id }));
    return (await response.json()).result;
  }

  static async fetchFile(file_path) {
    const file = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file_path}`);
    return await file.arrayBuffer();
  }

  static async apiUrl(methodName, params = null) {
    let query = "";
    if (params) query = "?" + new URLSearchParams(params).toString();
    return `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}${query}`;
  }

  static async Update(event, update) {
    if (update.message) await onMessage(event, update.message);
    if (update.inline_query) await onInline(event, update.inline_query);
  }
}

// ---------- Inline Query Handler ---------- //

async function onInline(event, inline) {
  // Keep original inline logic
  return Bot.answerInlineArticle(inline.id, "Filestream Bot", "Send me a file to generate links.", "Upload a file to start!");
}

// ---------- Message Handler ---------- //

async function onMessage(event, message) {
  const url = new URL(event.request.url);
  const bot = await Bot.getMe();

  // 🆕 Simple greeting for /start
  if (message.text === "/start") {
    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      "👋 *Welcome!* Send me any file and I’ll give you instant Download & Stream links."
    );
  }

  // Handle original file upload logic...
  if (message.document) {
    const fID = message.document.file_id;
    const fName = message.document.file_name;
    const fSave = await Bot.sendDocument(BOT_CHANNEL, fID);
    if (fSave.error_code) return Bot.sendMessage(message.chat.id, message.message_id, fSave.description);

    const final_hash = await Cryptic.Hash(fSave.result.message_id);
    const final_link = `${url.origin}/?file=${final_hash}`;
    const buttons = [[{ text: "Download Link", url: final_link }]];
    return Bot.sendMessage(
      message.chat.id,
      message.message_id,
      `*🗂 File Name:* \`${fName}\`\n\nHere’s your download link 👇`,
      buttons
    );
  }

  return Bot.sendMessage(message.chat.id, message.message_id, "Send a file to generate a link.");
}
