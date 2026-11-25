import json, os, logging
from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M, Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

TOKEN = os.environ["BOT_TOKEN"]
OWNER = os.environ.get("OWNER_ID")  # اختياري: رقم حسابك عشان البوت يرد عليك بس
DATA = json.load(open(os.path.join(os.path.dirname(__file__), "standards.json"), encoding="utf-8"))
CATS = {"eas": "🇪🇬 المعايير المصرية (EAS)", "ias": "🌍 المعايير الدولية IAS", "ifrs": "📘 المعايير الدولية IFRS"}
PER = 12
logging.basicConfig(level=logging.INFO)

def allowed(u: Update):
    return not OWNER or str(u.effective_user.id) == OWNER

def home():
    return M([[B(v, callback_data=f"c:{k}:0")] for k, v in CATS.items()] + [[B("🔎 عن البوت", callback_data="about")]])

async def start(u: Update, c: ContextTypes.DEFAULT_TYPE):
    if not allowed(u): return
    await u.message.reply_text("أهلاً يا محمد 👋\nاختار نوع المعايير:", reply_markup=home())

def listing(cat, p):
    items = DATA[cat]; chunk = items[p*PER:(p+1)*PER]
    rows = []
    for i in range(0, len(chunk), 2):
        rows.append([B("📄 " + x["code"], callback_data=f"s:{cat}:{items.index(x)}") for x in chunk[i:i+2]])
    nav = []
    if p > 0: nav.append(B("⬅️ السابق", callback_data=f"c:{cat}:{p-1}"))
    if (p+1)*PER < len(items): nav.append(B("التالي ➡️", callback_data=f"c:{cat}:{p+1}"))
    if nav: rows.append(nav)
    rows.append([B("🏠 القائمة الرئيسية", callback_data="home")])
    return M(rows)

async def cb(u: Update, c: ContextTypes.DEFAULT_TYPE):
    q = u.callback_query
    if not allowed(u): return await q.answer()
    await q.answer()
    a = q.data.split(":")
    if a[0] == "home":
        await q.edit_message_text("اختار نوع المعايير:", reply_markup=home())
    elif a[0] == "about":
        await q.edit_message_text("بوت مرجعي للمعايير المحاسبية المصرية والدولية.\nلإضافة ملف PDF لأي معيار: حطه في فولدر pdfs باسم زي EAS_1.pdf أو IFRS_15.pdf وهيتبعت مع المعيار.",
                                  reply_markup=M([[B("🏠 رجوع", callback_data="home")]]))
    elif a[0] == "c":
        await q.edit_message_text(CATS[a[1]] + "\nاختار معيار:", reply_markup=listing(a[1], int(a[2])))
    elif a[0] == "s":
        cat, i = a[1], int(a[2]); s = DATA[cat][i]
        txt = f"📌 *{s['code']}*\n{s['title']}\n"
        if s.get("note"): txt += f"\n{s['note']}\n"
        kb = M([[B("🔗 المصدر الرسمي", url=s["url"])], [B("⬅️ رجوع للقائمة", callback_data=f"c:{cat}:{i//PER}")], [B("🏠 الرئيسية", callback_data="home")]])
        await q.edit_message_text(txt, reply_markup=kb, parse_mode="Markdown")
        f = os.path.join(os.path.dirname(__file__), "pdfs", s["code"].replace(" ", "_") + ".pdf")
        if os.path.exists(f):
            await c.bot.send_document(q.message.chat_id, open(f, "rb"))

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(cb))
    base = os.environ.get("RENDER_EXTERNAL_URL")  # Render بيحطه لوحده
    if base:  # وضع الاستضافة (webhook): البوت بينام لو مفيش استخدام وبيصحى لما تبعتله
        path = "hook-" + TOKEN.split(":")[-1][:20]
        app.run_webhook(listen="0.0.0.0", port=int(os.environ.get("PORT", "10000")),
                        url_path=path, webhook_url=f"{base}/{path}",
                        secret_token=TOKEN.split(":")[-1][:20], drop_pending_updates=False)
    else:  # على جهازك: polling عادي
        app.run_polling()

if __name__ == "__main__":
    main()
