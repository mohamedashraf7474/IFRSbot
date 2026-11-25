// بوت المعايير المحاسبية - Cloudflare Worker
// الأسرار (Secrets): BOT_TOKEN , WEBHOOK_SECRET   | اختياري: OWNER_ID
import DATA from "./standards.json";
const CATS = {eas: "🇪🇬 المعايير المصرية (EAS)", ias: "🌍 المعايير الدولية IAS", ifrs: "📘 المعايير الدولية IFRS"};
const PER = 12;

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)});
  return r.json();
}
const homeKb = () => ({inline_keyboard: [...Object.entries(CATS).map(([k, v]) => [{text: v, callback_data: `c:${k}:0`}]),
  [{text: "🔎 عن البوت", callback_data: "about"}]]});
function listKb(cat, p) {
  const items = DATA[cat], chunk = items.slice(p * PER, (p + 1) * PER), rows = [];
  for (let i = 0; i < chunk.length; i += 2)
    rows.push(chunk.slice(i, i + 2).map(x => ({text: "📄 " + x.code, callback_data: `s:${cat}:${items.indexOf(x)}`})));
  const nav = [];
  if (p > 0) nav.push({text: "⬅️ السابق", callback_data: `c:${cat}:${p - 1}`});
  if ((p + 1) * PER < items.length) nav.push({text: "التالي ➡️", callback_data: `c:${cat}:${p + 1}`});
  if (nav.length) rows.push(nav);
  rows.push([{text: "🏠 القائمة الرئيسية", callback_data: "home"}]);
  return {inline_keyboard: rows};
}
const ok = (env, id) => !env.OWNER_ID || String(id) === String(env.OWNER_ID);

async function handle(env, u) {
  if (u.message) {
    const m = u.message;
    if (!ok(env, m.from.id)) return;
    if ((m.text || "").startsWith("/start"))
      await tg(env, "sendMessage", {chat_id: m.chat.id, text: "أهلاً يا محمد 👋\nاختار نوع المعايير:", reply_markup: homeKb()});
    return;
  }
  const q = u.callback_query;
  if (!q) return;
  if (!ok(env, q.from.id)) return tg(env, "answerCallbackQuery", {callback_query_id: q.id});
  tg(env, "answerCallbackQuery", {callback_query_id: q.id});
  const a = q.data.split(":"), base = {chat_id: q.message.chat.id, message_id: q.message.message_id};
  if (a[0] === "home") await tg(env, "editMessageText", {...base, text: "اختار نوع المعايير:", reply_markup: homeKb()});
  else if (a[0] === "about") await tg(env, "editMessageText", {...base, text: "بوت مرجعي للمعايير المحاسبية المصرية والدولية.", reply_markup: {inline_keyboard: [[{text: "🏠 رجوع", callback_data: "home"}]]}});
  else if (a[0] === "c") await tg(env, "editMessageText", {...base, text: CATS[a[1]] + "\nاختار معيار:", reply_markup: listKb(a[1], +a[2])});
  else if (a[0] === "s") {
    const cat = a[1], i = +a[2], s = DATA[cat][i];
    let text = `📌 ${s.code}\n${s.title}\n`;
    if (s.note) text += `\n${s.note}\n`;
    await tg(env, "editMessageText", {...base, text, reply_markup: {inline_keyboard: [
      [{text: "🔗 المصدر الرسمي", url: s.url}],
      [{text: "⬅️ رجوع للقائمة", callback_data: `c:${cat}:${Math.floor(i / PER)}`}],
      [{text: "🏠 الرئيسية", callback_data: "home"}]]}});
    if (s.pdf) {  // يبعت ملف الـ PDF من موقع الهيئة العامة للرقابة المالية مباشرة
      const r = await tg(env, "sendDocument", {chat_id: base.chat_id, document: s.pdf, caption: `${s.code} - ${s.title}\nالمصدر: الهيئة العامة للرقابة المالية (FRA)`.slice(0, 1000)});
      if (!r.ok) await tg(env, "sendMessage", {chat_id: base.chat_id, text: "مقدرتش أبعت الملف، افتحه من اللينك ده:\n" + s.pdf});
    } else if (cat === "eas") {
      await tg(env, "sendMessage", {chat_id: base.chat_id, text: "ملف الـ PDF لهذا المعيار مش متاح عندي حالياً، استخدم زر المصدر الرسمي."});
    } else {
      await tg(env, "sendMessage", {chat_id: base.chat_id, text: "المعايير الدولية محمية بحقوق IFRS Foundation وممنوع إرسالها كملف. النسخة المجانية للمسجلين على ifrs.org من زر المصدر الرسمي."});
    }
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/setup") {  // افتح الرابط ده مرة واحدة: /setup?key=WEBHOOK_SECRET
      if (url.searchParams.get("key") !== env.WEBHOOK_SECRET) return new Response("no", {status: 403});
      const r = await tg(env, "setWebhook", {url: `${url.origin}/hook`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message", "callback_query"]});
      return new Response(JSON.stringify(r));
    }
    if (url.pathname === "/hook" && req.method === "POST") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) return new Response("no", {status: 403});
      const u = await req.json();
      ctx.waitUntil(handle(env, u).catch(e => console.log("err", String(e))));
      return new Response("ok");
    }
    return new Response("البوت شغال ✅");
  }
};
