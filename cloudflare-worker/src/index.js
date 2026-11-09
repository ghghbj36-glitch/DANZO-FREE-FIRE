const TELEGRAM_API = "https://api.telegram.org";

const CATALOG = {
  samsung: {
    title: "Samsung",
    models: [
      "Galaxy S22", "Galaxy S22+", "Galaxy S22 Ultra", "Galaxy S21 FE",
      "Galaxy S23", "Galaxy S23+", "Galaxy S23 Ultra", "Galaxy S23 FE",
      "Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra", "Galaxy S24 FE",
      "Galaxy S25", "Galaxy S25+", "Galaxy S25 Ultra", "Galaxy S25 Edge", "Galaxy S25 FE",
      "Galaxy Z Flip4", "Galaxy Z Fold4", "Galaxy Z Flip5", "Galaxy Z Fold5",
      "Galaxy Z Flip6", "Galaxy Z Fold6", "Galaxy Z Flip7", "Galaxy Z Fold7",
      "Galaxy A14", "Galaxy A15", "Galaxy A16", "Galaxy A24", "Galaxy A25",
      "Galaxy A26", "Galaxy A34", "Galaxy A35", "Galaxy A36", "Galaxy A54",
      "Galaxy A55", "Galaxy A56", "Galaxy M14", "Galaxy M15", "Galaxy M34",
      "Galaxy M35", "Galaxy M54", "Galaxy M55"
    ]
  },
  iphone: {
    title: "iPhone",
    models: [
      "iPhone XS", "iPhone XS Max", "iPhone XR",
      "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
      "iPhone SE (2020)", "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
      "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max", "iPhone SE (2022)",
      "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
      "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
      "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 16e",
      "iPhone 17", "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone Air"
    ]
  },
  redmi: {
    title: "Redmi",
    models: [
      "Redmi 10", "Redmi 10C", "Redmi 12", "Redmi 12C", "Redmi 13", "Redmi 13C",
      "Redmi 14C", "Redmi 15C", "Redmi Note 11", "Redmi Note 11S",
      "Redmi Note 12", "Redmi Note 12 5G", "Redmi Note 12 Pro", "Redmi Note 12 Pro+",
      "Redmi Note 13", "Redmi Note 13 5G", "Redmi Note 13 Pro", "Redmi Note 13 Pro+",
      "Redmi Note 14", "Redmi Note 14 5G", "Redmi Note 14 Pro", "Redmi Note 14 Pro+",
      "Redmi Note 15", "Redmi Note 15 Pro"
    ]
  },
  poco: {
    title: "POCO",
    models: [
      "POCO M4 Pro", "POCO X4 Pro 5G", "POCO F4", "POCO F4 GT",
      "POCO M5", "POCO M5s", "POCO X5 5G", "POCO X5 Pro 5G", "POCO F5", "POCO F5 Pro",
      "POCO C65", "POCO X6 5G", "POCO X6 Pro", "POCO M6", "POCO M6 Pro",
      "POCO F6", "POCO F6 Pro", "POCO X7", "POCO X7 Pro", "POCO M7",
      "POCO M7 Pro 5G", "POCO F7", "POCO F7 Pro", "POCO F7 Ultra"
    ]
  }
};

const MAIN_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📱 Каталог телефонов", callback_data: "catalog" }],
    [{ text: "🎯 Настройки Free Fire", callback_data: "settings" }],
    [{ text: "🔥 LITE", callback_data: "lite" }, { text: "💎 PRO", callback_data: "pro" }],
    [{ text: "💳 Подписка", callback_data: "subscription" }],
    [{ text: "💬 Поддержка", callback_data: "support" }]
  ]
};

function adminIds(env) {
  return (env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
}

async function telegram(env, method, payload) {
  if (!env.BOT_TOKEN) throw new Error("BOT_TOKEN is not configured");
  const response = await fetch(TELEGRAM_API + "/bot" + env.BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error("Telegram API request failed: " + method);
  return data.result;
}

async function sendText(env, chatId, text, replyMarkup) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegram(env, "sendMessage", payload);
}

async function editText(env, chatId, messageId, text, replyMarkup) {
  const payload = { chat_id: chatId, message_id: messageId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegram(env, "editMessageText", payload);
}

async function answerCallback(env, callbackId, text) {
  return telegram(env, "answerCallbackQuery", { callback_query_id: callbackId, text });
}

async function saveUser(env, from) {
  if (!env.DB || !from || !from.id) return;
  try {
    await env.DB.prepare(
      "INSERT INTO users (user_id, username, first_name) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name"
    ).bind(from.id, from.username || "", from.first_name || "").run();
  } catch (error) {
    console.log("User record was not saved. Check D1 setup.");
  }
}

function mainText(firstName) {
  return "Салам, " + (firstName || "друг") + "!\n\nДобро пожаловать в DANZO FREE FIRE.\nВыбери нужный раздел:";
}

function catalogKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Samsung", callback_data: "cat:samsung:0" }, { text: "iPhone", callback_data: "cat:iphone:0" }],
      [{ text: "Redmi", callback_data: "cat:redmi:0" }, { text: "POCO", callback_data: "cat:poco:0" }],
      [{ text: "⬅️ Главное меню", callback_data: "home" }]
    ]
  };
}

function modelsKeyboard(brand, page) {
  const data = CATALOG[brand];
  const pageSize = 8;
  const start = page * pageSize;
  const chunk = data.models.slice(start, start + pageSize);
  const rows = chunk.map((name, i) => [{
    text: name,
    callback_data: "phone:" + brand + ":" + (start + i)
  }]);
  const nav = [];
  if (page > 0) nav.push({ text: "⬅️", callback_data: "cat:" + brand + ":" + (page - 1) });
  if (start + pageSize < data.models.length) nav.push({ text: "➡️", callback_data: "cat:" + brand + ":" + (page + 1) });
  if (nav.length) rows.push(nav);
  rows.push([{ text: "↩️ К брендам", callback_data: "catalog" }]);
  rows.push([{ text: "🏠 Главное меню", callback_data: "home" }]);
  return { inline_keyboard: rows };
}

function isAdmin(userId, env) {
  return adminIds(env).includes(String(userId));
}

async function showAdmin(env, chatId) {
  let count = "база данных не подключена";
  if (env.DB) {
    try {
      const result = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
      count = String(result.total);
    } catch (error) {
      count = "ошибка базы данных";
    }
  }
  return sendText(env, chatId, "👑 Админ-панель DANZO\n\nПользователей в базе: " + count +
    "\n\nКоманда /id показывает твой Telegram ID.\nADMIN_IDS задаётся в переменных Worker.", MAIN_KEYBOARD);
}

async function handleMessage(update, env) {
  const message = update.message;
  if (!message || !message.chat || !message.from) return;
  const chatId = message.chat.id;
  const from = message.from;
  const text = (message.text || "").trim();
  await saveUser(env, from);

  if (text === "/start" || text === "/menu") {
    return sendText(env, chatId, mainText(from.first_name), MAIN_KEYBOARD);
  }
  if (text === "/id") {
    return sendText(env, chatId, "Твой Telegram ID: " + from.id + "\nНе публикуй его вместе с токеном бота.");
  }
  if (text === "/admin") {
    if (!isAdmin(from.id, env)) return sendText(env, chatId, "⛔ Доступ закрыт.");
    return showAdmin(env, chatId);
  }
  if (text.startsWith("/support ")) {
    const body = text.slice(9).trim();
    if (!body) return sendText(env, chatId, "Напиши сообщение после команды: /support Твой вопрос");
    const recipients = adminIds(env);
    if (!recipients.length) return sendText(env, chatId, "Поддержка пока не настроена. Попробуй позже.");
    const sender = "Новое обращение DANZO\nОт: " + (from.first_name || "") +
      "\nUsername: @" + (from.username || "не указан") + "\nID: " + from.id + "\n\n" + body;
    for (const id of recipients) {
      try { await sendText(env, id, sender); } catch (error) { console.log("Could not forward support message."); }
    }
    return sendText(env, chatId, "✅ Сообщение отправлено в поддержку.");
  }
  if (text) {
    return sendText(env, chatId, "Используй кнопки меню или команду /support Твой вопрос.", MAIN_KEYBOARD);
  }
}

async function handleCallback(update, env) {
  const query = update.callback_query;
  if (!query || !query.message || !query.from) return;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data || "";
  await answerCallback(env, query.id, "DANZO");
  await saveUser(env, query.from);

  if (data === "home") {
    return editText(env, chatId, messageId, mainText(query.from.first_name), MAIN_KEYBOARD);
  }
  if (data === "catalog") {
    return editText(env, chatId, messageId, "📱 Выбери марку телефона:", catalogKeyboard());
  }
  if (data.startsWith("cat:")) {
    const parts = data.split(":");
    const brand = parts[1];
    const page = Math.max(0, Number(parts[2]) || 0);
    const entry = CATALOG[brand];
    if (!entry) return;
    const pageCount = Math.ceil(entry.models.length / 8);
    const safePage = Math.min(page, pageCount - 1);
    return editText(env, chatId, messageId,
      "📱 " + entry.title + "\nСтраница " + (safePage + 1) + " из " + pageCount +
      "\n\nВыбери свою модель:", modelsKeyboard(brand, safePage));
  }
  if (data.startsWith("phone:")) {
    const parts = data.split(":");
    const brand = parts[1];
    const index = Number(parts[2]);
    const entry = CATALOG[brand];
    if (!entry || !Number.isInteger(index) || !entry.models[index]) return;
    return editText(env, chatId, messageId,
      "✅ Выбрана модель: " + entry.models[index] +
      "\n\nПрофили чувствительности для этой модели ещё не опубликованы. Мы не будем показывать случайные значения.\n\nВернись в каталог или открой главное меню.",
      { inline_keyboard: [
        [{ text: "↩️ К каталогу", callback_data: "cat:" + brand + ":" + Math.floor(index / 8) }],
        [{ text: "🏠 Главное меню", callback_data: "home" }]
      ] });
  }
  if (data === "settings") {
    return editText(env, chatId, messageId,
      "🎯 Настройки Free Fire\n\nСначала выбери телефон в каталоге. Проверенные значения чувствительности будут добавляться отдельно. Сейчас готовых значений ещё нет.",
      { inline_keyboard: [[{ text: "📱 Выбрать телефон", callback_data: "catalog" }], [{ text: "🏠 Главное меню", callback_data: "home" }]] });
  }
  if (data === "lite") {
    return editText(env, chatId, messageId,
      "🔥 Профиль LITE\n\nРаздел подготовлен, но точные настройки ещё не добавлены. Мы не будем выдавать случайные значения за проверенные.",
      { inline_keyboard: [[{ text: "📱 Каталог телефонов", callback_data: "catalog" }], [{ text: "🏠 Главное меню", callback_data: "home" }]] });
  }
  if (data === "pro") {
    return editText(env, chatId, messageId,
      "💎 Профиль PRO\n\nPRO пока находится в разработке. Оплата и выдача PRO-доступа не подключены.",
      { inline_keyboard: [[{ text: "💳 Подписка", callback_data: "subscription" }], [{ text: "🏠 Главное меню", callback_data: "home" }]] });
  }
  if (data === "subscription") {
    return editText(env, chatId, messageId,
      "💳 Подписка DANZO\n\nПриём платежей пока не подключён. Не отправляй деньги на личные карты или неизвестные счета.",
      { inline_keyboard: [[{ text: "💎 О профиле PRO", callback_data: "pro" }], [{ text: "🏠 Главное меню", callback_data: "home" }]] });
  }
  if (data === "support") {
    return editText(env, chatId, messageId,
      "💬 Поддержка\n\nОтправь сообщение командой:\n/support Твой вопрос\n\nСообщение получат администраторы бота.",
      { inline_keyboard: [[{ text: "🏠 Главное меню", callback_data: "home" }]] });
  }
  if (data === "admin") {
    if (!isAdmin(userId, env)) return sendText(env, chatId, "⛔ Доступ закрыт.");
    return showAdmin(env, chatId);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("DANZO FREE FIRE worker is online.", { status: 200 });
    }

    if (request.method === "GET" && url.pathname === "/configure-webhook") {
      if (!env.SETUP_SECRET || url.searchParams.get("key") !== env.SETUP_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const webhookUrl = url.origin + "/telegram";
      const options = { url: webhookUrl };
      if (env.WEBHOOK_SECRET) options.secret_token = env.WEBHOOK_SECRET;
      try {
        const result = await telegram(env, "setWebhook", options);
        return new Response("Webhook configured: " + String(result), { status: 200 });
      } catch (error) {
        return new Response("Webhook setup failed. Check Worker secrets.", { status: 500 });
      }
    }

    if (request.method === "POST" && url.pathname === "/telegram") {
      if (env.WEBHOOK_SECRET) {
        const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
        if (supplied !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
      }
      let update;
      try {
        update = await request.json();
      } catch (error) {
        return new Response("Bad Request", { status: 400 });
      }
      try {
        if (update.message) await handleMessage(update, env);
        else if (update.callback_query) await handleCallback(update, env);
      } catch (error) {
        console.log("Update processing failed.");
      }
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }
};
