import json
import os
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request

API_BASE = "https://api.telegram.org/bot"
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
ADMIN_IDS = {
    int(value.strip())
    for value in os.getenv("ADMIN_IDS", "").split(",")
    if value.strip().isdigit()
}
DB_PATH = os.getenv("DB_PATH", "danzo_free_fire.sqlite3")

# Starter catalogue. Sensitivity values are deliberately not invented.
PHONE_CATALOG = {
    "samsung": [
        "Galaxy S26", "Galaxy S26+", "Galaxy S26 Ultra",
        "Galaxy S25", "Galaxy S25+", "Galaxy S25 Ultra",
        "Galaxy S24", "Galaxy S24+", "Galaxy S24 Ultra",
        "Galaxy S23", "Galaxy S23+", "Galaxy S23 Ultra",
        "Galaxy S22", "Galaxy S22+", "Galaxy S22 Ultra",
        "Galaxy Z Fold", "Galaxy Z Flip", "Galaxy A series"
    ],
    "iphone": [
        "iPhone 18 Pro", "iPhone 18 Pro Max", "iPhone 18",
        "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 17",
        "iPhone 16 Pro", "iPhone 16 Pro Max", "iPhone 16",
        "iPhone 15 Pro", "iPhone 15 Pro Max", "iPhone 15",
        "iPhone 14", "iPhone 13", "iPhone 12",
        "iPhone 11", "iPhone XS", "iPhone XR"
    ],
    "redmi": [
        "Redmi Note 15", "Redmi Note 14", "Redmi Note 13",
        "Redmi Note 12", "Redmi Note 11", "Redmi Note 10",
        "Redmi 15", "Redmi 14C", "Redmi 13", "Redmi 12",
        "Redmi K series", "Redmi Turbo series"
    ],
    "poco": [
        "POCO F8", "POCO F7", "POCO F6", "POCO F5",
        "POCO X8", "POCO X7", "POCO X6", "POCO X5",
        "POCO M8", "POCO M7", "POCO M6", "POCO C series"
    ],
}

BRANDS = {
    "samsung": "Samsung",
    "iphone": "iPhone",
    "redmi": "Redmi",
    "poco": "POCO",
}


def db():
    connection = sqlite3.connect(DB_PATH)
    connection.execute(
        "CREATE TABLE IF NOT EXISTS users "
        "(user_id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, joined_at TEXT DEFAULT CURRENT_TIMESTAMP)"
    )
    connection.execute(
        "CREATE TABLE IF NOT EXISTS user_modes "
        "(user_id INTEGER PRIMARY KEY, mode TEXT NOT NULL)"
    )
    connection.commit()
    return connection


def api(method, payload=None):
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is not configured.")
    body = json.dumps(payload or {}).encode("utf-8")
    request = urllib.request.Request(
        API_BASE + BOT_TOKEN + "/" + method,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Telegram API error: {details}") from error
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API error: {result}")
    return result.get("result")


def send(chat_id, text, keyboard=None):
    payload = {"chat_id": chat_id, "text": text}
    if keyboard:
        payload["reply_markup"] = {"inline_keyboard": keyboard}
    api("sendMessage", payload)


def button(text, data):
    return {"text": text, "callback_data": data}


def main_menu(user_id):
    rows = [
        [button("📱 Каталог телефонов", "phones")],
        [button("🎯 Настройки Free Fire", "settings")],
        [button("🟢 LITE", "lite"), button("🔥 PRO", "pro")],
        [button("👑 Подписка", "subscription")],
        [button("💬 Поддержка", "support")],
    ]
    if user_id in ADMIN_IDS:
        rows.append([button("🛠️ Админ-панель", "admin")])
    return rows


def show_home(chat_id, user_id):
    send(
        chat_id,
        "🔥 DANZO FREE FIRE\n\nВыбери нужный раздел:",
        main_menu(user_id),
    )


def remember_user(message):
    user = message.get("from", {})
    connection = db()
    connection.execute(
        "INSERT OR IGNORE INTO users(user_id, username, first_name) VALUES (?, ?, ?)",
        (user.get("id"), user.get("username"), user.get("first_name")),
    )
    connection.execute(
        "UPDATE users SET username = ?, first_name = ? WHERE user_id = ?",
        (user.get("username"), user.get("first_name"), user.get("id")),
    )
    connection.commit()
    connection.close()


def set_mode(user_id, mode):
    connection = db()
    connection.execute(
        "INSERT OR REPLACE INTO user_modes(user_id, mode) VALUES (?, ?)",
        (user_id, mode),
    )
    connection.commit()
    connection.close()


def get_mode(user_id):
    connection = db()
    row = connection.execute(
        "SELECT mode FROM user_modes WHERE user_id = ?", (user_id,)
    ).fetchone()
    connection.close()
    return row[0] if row else None


def clear_mode(user_id):
    connection = db()
    connection.execute("DELETE FROM user_modes WHERE user_id = ?", (user_id,))
    connection.commit()
    connection.close()


def show_brands(chat_id):
    rows = [
        [button("Samsung", "brand:samsung"), button("iPhone", "brand:iphone")],
        [button("Redmi", "brand:redmi"), button("POCO", "brand:poco")],
        [button("⬅️ Главное меню", "home")],
    ]
    send(chat_id, "📱 Выбери марку телефона:", rows)


def show_models(chat_id, slug):
    models = PHONE_CATALOG.get(slug)
    if not models:
        send(chat_id, "Не удалось найти эту марку. Открой каталог ещё раз.")
        return
    rows = [[button(name, f"model:{slug}:{index}")] for index, name in enumerate(models)]
    rows.append([button("⬅️ К маркам", "phones")])
    send(chat_id, f"📱 {BRANDS[slug]} — выбери модель:", rows)


def handle_message(message):
    chat_id = message.get("chat", {}).get("id")
    user_id = message.get("from", {}).get("id")
    if not chat_id or not user_id:
        return
    remember_user(message)
    text = (message.get("text") or "").strip()

    if text in ("/start", "/menu"):
        clear_mode(user_id)
        show_home(chat_id, user_id)
        return

    if text == "/admin":
        if user_id not in ADMIN_IDS:
            send(chat_id, "У тебя нет доступа к админ-панели.")
        else:
            handle_admin(chat_id)
        return

    if get_mode(user_id) == "support":
        if not text:
            send(chat_id, "Отправь сообщение текстом, пожалуйста.")
            return
        clear_mode(user_id)
        delivered = 0
        for admin_id in ADMIN_IDS:
            try:
                api("sendMessage", {
                    "chat_id": admin_id,
                    "text": f"💬 Обращение в поддержку от пользователя {user_id}:\n\n{text}",
                })
                delivered += 1
            except Exception as error:
                print("Could not forward support message:", error)
        if delivered:
            send(chat_id, "✅ Сообщение отправлено в поддержку. Спасибо!")
        else:
            send(chat_id, "Поддержка пока не настроена. Попробуй позже.")
        return

    send(chat_id, "Используй кнопки меню. Чтобы открыть его, отправь /start.")


def handle_admin(chat_id):
    connection = db()
    count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    connection.close()
    send(
        chat_id,
        f"🛠️ DANZO FREE FIRE — админ-панель\n\nПользователей в базе: {count}\n\n"
        "Для доступа добавь свой Telegram ID в переменную ADMIN_IDS на хостинге.",
        [[button("⬅️ Главное меню", "home")]],
    )


def handle_callback(query):
    callback_id = query.get("id")
    message = query.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    user_id = query.get("from", {}).get("id")
    data = query.get("data", "")
    if callback_id:
        api("answerCallbackQuery", {"callback_query_id": callback_id})
    if not chat_id or not user_id:
        return

    if data == "home":
        show_home(chat_id, user_id)
    elif data in ("phones", "settings"):
        show_brands(chat_id)
    elif data.startswith("brand:"):
        show_models(chat_id, data.split(":", 1)[1])
    elif data.startswith("model:"):
        _, slug, index_text = data.split(":", 2)
        models = PHONE_CATALOG.get(slug, [])
        try:
            model_name = models[int(index_text)]
        except (ValueError, IndexError):
            send(chat_id, "Модель не найдена. Выбери её из списка ещё раз.")
            return
        send(
            chat_id,
            f"📱 {model_name}\n\n"
            "Модель добавлена в каталог. Проверенные значения чувствительности "
            "для неё пока не опубликованы — мы не будем показывать выдуманные настройки.",
            [
                [button("🟢 LITE", "lite"), button("🔥 PRO", "pro")],
                [button("⬅️ К моделям", f"brand:{slug}")],
                [button("🏠 Главное меню", "home")],
            ],
        )
    elif data in ("lite", "pro"):
        tier = "LITE" if data == "lite" else "PRO"
        send(
            chat_id,
            f"{'🟢' if tier == 'LITE' else '🔥'} Раздел {tier}\n\n"
            "Проверенные настройки ещё добавляются. Здесь пока нет готовых значений.",
            [[button("📱 Выбрать телефон", "phones")],
             [button("🏠 Главное меню", "home")]],
        )
    elif data == "subscription":
        send(
            chat_id,
            "👑 Подписка\n\nПокупка пока не подключена. Оплата не принимается.",
            [[button("🏠 Главное меню", "home")]],
        )
    elif data == "support":
        set_mode(user_id, "support")
        send(chat_id, "💬 Напиши одним сообщением, чем мы можем помочь. Я передам его администратору.")
    elif data == "admin":
        if user_id in ADMIN_IDS:
            handle_admin(chat_id)
        else:
            send(chat_id, "У тебя нет доступа к админ-панели.")
    else:
        send(chat_id, "Неизвестная команда. Открой меню через /start.")


def main():
    if not BOT_TOKEN:
        raise SystemExit(
            "Не задан BOT_TOKEN. Добавь токен в переменные окружения хостинга, "
            "не вставляй его в исходный код."
        )
    db().close()
    api("deleteWebhook", {"drop_pending_updates": False})
    print("DANZO FREE FIRE is running. Press Ctrl+C to stop.")
    offset = None
    while True:
        try:
            payload = {"timeout": 25, "allowed_updates": ["message", "callback_query"]}
            if offset is not None:
                payload["offset"] = offset
            updates = api("getUpdates", payload)
            for update in updates:
                offset = update["update_id"] + 1
                try:
                    if "message" in update:
                        handle_message(update["message"])
                    elif "callback_query" in update:
                        handle_callback(update["callback_query"])
                except Exception as error:
                    print("Update handling error:", error)
        except KeyboardInterrupt:
            print("Bot stopped.")
            break
        except Exception as error:
            print("Polling error:", error)
            time.sleep(5)


if __name__ == "__main__":
    main()
