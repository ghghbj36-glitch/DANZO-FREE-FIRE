/**
 * DANZO FREE FIRE — Google Apps Script webhook version.
 *
 * Configure Script Properties:
 * BOT_TOKEN = your NEW Telegram bot token
 * ADMIN_IDS = optional comma-separated Telegram numeric IDs
 *
 * Deploy as Web app:
 * Execute as: Me
 * Who has access: Anyone
 * Then run installWebhook() once from the Apps Script editor.
 */

const API = "https://api.telegram.org/bot";

function properties_() {
  return PropertiesService.getScriptProperties();
}

function botToken_() {
  const token = properties_().getProperty("BOT_TOKEN");
  if (!token) throw new Error("Set BOT_TOKEN in Apps Script Project Settings > Script properties.");
  return token.trim();
}

function adminIds_() {
  return (properties_().getProperty("ADMIN_IDS") || "")
    .split(",").map(s => s.trim()).filter(Boolean);
}

function telegram_(method, payload) {
  const response = UrlFetchApp.fetch(API + botToken_() + "/" + method, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  const result = JSON.parse(response.getContentText());
  if (!result.ok) throw new Error("Telegram API: " + response.getContentText());
  return result.result;
}

function installWebhook() {
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error("Deploy this project as a Web app first, then run installWebhook().");
  const result = telegram_("setWebhook", { url: url });
  Logger.log(JSON.stringify(result));
}

function doGet() {
  return ContentService.createTextOutput("DANZO FREE FIRE webhook is online.");
}

function doPost(e) {
  try {
    const update = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (update.message) handleMessage_(update.message);
    if (update.callback_query) handleCallback_(update.callback_query);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
  }
  return ContentService.createTextOutput("OK");
}

function keyboard_(rows) {
  return { inline_keyboard: rows };
}

function btn_(text, data) {
  return { text: text, callback_data: data };
}

function send_(chatId, text, rows) {
  const payload = { chat_id: chatId, text: text };
  if (rows) payload.reply_markup = keyboard_(rows);
  telegram_("sendMessage", payload);
}

function homeRows_(userId) {
  const rows = [
    [btn_("📱 Каталог телефонов", "phones")],
    [btn_("🎯 Настройки Free Fire", "settings")],
    [btn_("🟢 LITE", "lite"), btn_("🔥 PRO", "pro")],
    [btn_("👑 Подписка", "subscription")],
    [btn_("💬 Поддержка", "support")]
  ];
  if (adminIds_().indexOf(String(userId)) !== -1) {
    rows.push([btn_("🛠️ Админ-панель", "admin")]);
  }
  return rows;
}

function showHome_(chatId, userId) {
  send_(chatId, "🔥 DANZO FREE FIRE\n\nВыбери нужный раздел:", homeRows_(userId));
}

function showBrands_(chatId) {
  send_(chatId, "📱 Выбери марку телефона:", [
    [btn_("Samsung", "brand:samsung"), btn_("iPhone", "brand:iphone")],
    [btn_("Redmi", "brand:redmi"), btn_("POCO", "brand:poco")],
    [btn_("⬅️ Главное меню", "home")]
  ]);
}

const CATALOG = {
  samsung: [
    "Galaxy S26", "Galaxy S26+", "Galaxy S26 Ultra",
    "Galaxy S25", "Galaxy S25+", "Galaxy S25 Ultra",
    "Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra",
    "Galaxy S23", "Galaxy S23+", "Galaxy S23 Ultra",
    "Galaxy S22", "Galaxy S22+", "Galaxy S22 Ultra",
    "Galaxy Z Fold", "Galaxy Z Flip", "Galaxy A series"
  ],
  iphone: [
    "iPhone 18 Pro", "iPhone 18 Pro Max", "iPhone 18",
    "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 17",
    "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 16",
    "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 15",
    "iPhone 14", "iPhone 13", "iPhone 12", "iPhone 11",
    "iPhone XS", "iPhone XR"
  ],
  redmi: [
    "Redmi Note 15", "Redmi Note 14", "Redmi Note 13",
    "Redmi Note 12", "Redmi Note 11", "Redmi Note 10",
    "Redmi 15", "Redmi 14C", "Redmi 13", "Redmi 12",
    "Redmi K series", "Redmi Turbo series"
  ],
  poco: [
    "POCO F8", "POCO F7", "POCO F6", "POCO F5",
    "POCO X8", "POCO X7", "POCO X6", "POCO X5",
    "POCO M8", "POCO M7", "POCO M6", "POCO C series"
  ]
};

function showModels_(chatId, brand) {
  const models = CATALOG[brand];
  if (!models) return send_(chatId, "Марка не найдена. Открой каталог ещё раз.");
  const rows = models.map(function(name, index) {
    return [btn_(name, "model:" + brand + ":" + index)];
  });
  rows.push([btn_("⬅️ К маркам", "phones")]);
  send_(chatId, "Выбери модель:", rows);
}

function handleMessage_(message) {
  const chatId = message.chat && message.chat.id;
  const userId = message.from && message.from.id;
  if (!chatId || !userId) return;
  const text = String(message.text || "").trim();

  if (text === "/start" || text === "/menu") {
    properties_().deleteProperty("support_" + userId);
    showHome_(chatId, userId);
    return;
  }

  if (properties_().getProperty("support_" + userId) === "1") {
    properties_().deleteProperty("support_" + userId);
    let sent = 0;
    adminIds_().forEach(function(adminId) {
      try {
        telegram_("sendMessage", {
          chat_id: adminId,
          text: "💬 Обращение от пользователя " + userId + ":\n\n" + text
        });
        sent++;
      } catch (err) {
        console.error(err);
      }
    });
    send_(chatId, sent ? "✅ Сообщение отправлено в поддержку." : "Поддержка пока не настроена.");
    return;
  }

  send_(chatId, "Нажми /start, чтобы открыть меню.");
}

function handleCallback_(query) {
  const callbackId = query.id;
  const chatId = query.message && query.message.chat && query.message.chat.id;
  const userId = query.from && query.from.id;
  const data = query.data || "";
  if (callbackId) telegram_("answerCallbackQuery", { callback_query_id: callbackId });
  if (!chatId || !userId) return;

  if (data === "home") return showHome_(chatId, userId);
  if (data === "phones" || data === "settings") return showBrands_(chatId);

  if (data.indexOf("brand:") === 0) {
    return showModels_(chatId, data.split(":")[1]);
  }

  if (data.indexOf("model:") === 0) {
    const parts = data.split(":");
    const models = CATALOG[parts[1]] || [];
    const model = models[Number(parts[2])];
    if (!model) return send_(chatId, "Модель не найдена. Выбери её заново.");
    return send_(chatId,
      "📱 " + model + "\n\nПроверенные значения чувствительности пока не добавлены. Мы не будем показывать выдуманные настройки.",
      [
        [btn_("🟢 LITE", "lite"), btn_("🔥 PRO", "pro")],
        [btn_("⬅️ К маркам", "phones")],
        [btn_("🏠 Главное меню", "home")]
      ]);
  }

  if (data === "lite" || data === "pro") {
    const label = data === "lite" ? "🟢 LITE" : "🔥 PRO";
    return send_(chatId, label + "\n\nПроверенные настройки ещё добавляются.", [
      [btn_("📱 Выбрать телефон", "phones")],
      [btn_("🏠 Главное меню", "home")]
    ]);
  }

  if (data === "subscription") {
    return send_(chatId, "👑 Подписка\n\nОплата пока не подключена.", [
      [btn_("🏠 Главное меню", "home")]
    ]);
  }

  if (data === "support") {
    properties_().setProperty("support_" + userId, "1");
    return send_(chatId, "💬 Напиши сообщение для поддержки одним сообщением.");
  }

  if (data === "admin") {
    if (adminIds_().indexOf(String(userId)) === -1) {
      return send_(chatId, "У тебя нет доступа к админ-панели.");
    }
    return send_(chatId, "🛠️ Админ-панель\n\nWebhook работает. Для расширенной статистики подключим базу данных.", [
      [btn_("🏠 Главное меню", "home")]
    ]);
  }

  send_(chatId, "Неизвестная кнопка. Отправь /start.");
}
