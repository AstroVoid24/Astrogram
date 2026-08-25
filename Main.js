//| ====== STARFIELD (decoration only) ====== |\\
(function () {
    function fill(id, count, maxSize) {
        const batch = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const star = document.createElement("div");
            const size = (Math.random() * maxSize + 0.6).toFixed(1) + "px";
            star.className = "star";
            star.style.left = (Math.random() * 100).toFixed(2) + "%";
            star.style.top = (Math.random() * 160).toFixed(2) + "%";
            star.style.width = size;
            star.style.height = size;
            star.style.animationDelay = (Math.random() * 4).toFixed(2) + "s";
            batch.appendChild(star);
        }
        document.getElementById(id).appendChild(batch);
    }
    const small = window.innerWidth < 480;
    fill("stars", small ? 60 : 130, 1.7);
    fill("stars2", small ? 30 : 60, 2.6);
})();
function urlify(text) {
    let urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '">' + url + '</a>';
    })
}

//| ======== SERVER ======== |\\
// http://astrogram-is.cool:12345
let link = "/api"
let currentLink = window.location.origin + window.location.pathname

//| === PAGE SWITCHING === |\\
// Only the page inside #Main changes — the top bar never redraws.
// Settings is in the top bar. Profile and Chat are reached from inside it and
// from a chat row, so they have no button of their own.
let pages = ["Feed", "Search", "Chats", "Settings", "Profile", "Chat"];
let BeforeEditDesc
let BeforeEditTags = []      // the tags as they were before Edit profile was pressed
let CurrentPage = "Feed"        // pull-to-refresh needs to know what to reload

// The chat page is pinned under the bar, and the bar changes height when its
// buttons wrap. Its real height goes into a variable the CSS can use.
function MeasureBar() {
    const bar = document.getElementById("TopBar")
    if (bar) document.documentElement.style.setProperty("--barH", bar.offsetHeight + "px")
}
$(window).on("resize orientationchange", MeasureBar)

function PageUpdate(which) {
    CurrentPage = which
    ApplyText()                 // anything drawn since the last pass gets its words
    // only the message list may scroll in a conversation, never the page
    $("body").toggleClass("on-chat", which === "Chat")
    MeasureBar()
    for (let i = 0; i < pages.length; i++) {
        $("#Page" + pages[i]).toggleClass("on", pages[i] === which);
    }
    if (which === "Chats" || which === "Profile") ShowFollowing();
    if (which === "Settings") {
        $("#SettingsWho").text(me || "")
        $("#SettingsLang").text(LANG_NAMES[lang] || lang)
    }
    if (which !== "Chat") StopChat();       // no polling once you have walked away
    $(".PageButton").removeClass("active");
    $(`.PageButton[data-page='${which}']`).addClass("active");
    $(window).scrollTop(0);

    // Always a plus, and it only ever means one thing: new post. Hidden inside a
    // conversation, where it would sit on top of the box you type in.
    $("#ActionButton").addClass("plus").toggleClass("on", which !== "Chat")
        .attr("aria-label", "New post")
}

$("#TopBar").on("click", ".PageButton", function () {
    PageUpdate($(this).data("page"));
})
//| ======== SETUP ======== |\\

const USER_KEY = "astrogram-user"
const INDEX_KEY = "astrogram-index"

let UsernamesForSearch = []
let BannedForSearch = []      // same order as UsernamesForSearch
let IndexesForSearch = []     // their real position in the server's Users
let LevelsForSearch = []
let PicturesForSearch = []    // "" for anyone still on the default

//| ====== Things read during start up ====== |\\
const DEFAULT_PICTURE = "/resources/DefaultProfilePicture.png"
function PictureOf(index) {
    const at = IndexesForSearch.indexOf(Number(index))
    return (at !== -1 && PicturesForSearch[at]) ? PicturesForSearch[at] : DEFAULT_PICTURE
}

const MAX_IMAGES = 10
const MAX_IMAGE = 50 * 1024 * 1024      // 50 MB, same as the server

// What I have pressed, and how many likes each post has. The post objects
// sitting in the lists are a snapshot from when they were fetched, so on
// their own they would show the old state every time one is reopened.
const MyLikes = new Set(), MyDislikes = new Set(), LikeCounts = new Map()

//| ====== LANGUAGE ====== |\\
// One key per whole sentence. Never glue pieces together - word order differs
// between languages and the result reads as nonsense.
// {n} style holes are filled by the second argument to t().
const TEXT = {
    en: {
        settings: "Settings",
        settingsHint: "Your account and how the app looks.",
        language: "Language",
        feed: "Feed", search: "Search", chats: "Chats", profile: "Profile",
        feedHint: "What everyone has been posting.",
        searchHint: "Find people on Astrogram.",
        chatsHint: "Your conversations.",
        verified: "Verified", banned: "Banned",
        info: "Info", bio: "Bio", noBio: "No bio yet",
        interests: "What you want to see", noInterests: "No interests yet",
        username: "Username", posts: "Posts", nothingPosted: "Nothing posted yet",
        online: "online", notLoggedIn: "Not logged in",
        subscribers: "subscribers", subscribed: "subscribed",
        subscribe: "Subscribe", isSubscribed: "Subscribed", message: "Message",
        thisIsYou: "This is you", bannedNoSub: "Banned \u2014 cannot subscribe",
        editProfile: "Edit profile", logOut: "Log out", save: "Save", cancel: "Cancel",
        copyLink: "Copy link", edit: "Edit", del: "Delete", report: "Report",
        copied: "Copied!", keptPost: "Kept your post", deletedPost: "Deleted your post",
        loading: "Loading...", pull: "Pull to reload", release: "Release to reload",
        reloading: "Reloading...",
        noChats: "No conversations yet.<br>Open somebody's account and press Message.",
        noSubs: "Not subscribed to anybody",
        writeMessage: "Write a message...", typeUsername: "Type a username...",
        noMessages: "No messages yet. Say something.",
        startTyping: "Start typing to find accounts", nobodyCalled: "Nobody called that", nobodyFiltered: "Nobody called that, or not verified or banned",
        feedEmpty: "Loading the feed...",
        yourSubscribers: "Your subscribers", youSubscribedTo: "You are subscribed to",
        nobodySubscribed: "Nobody has subscribed yet",
        cannotReach: "Cannot reach Astrogram",
    },
    ru: {
        settings: "Настройки",
        settingsHint: "Ваш аккаунт и вид приложения.",
        language: "Язык",
        feed: "Лента", search: "Поиск", chats: "Чаты", profile: "Профиль",
        feedHint: "Что все публикуют.",
        searchHint: "Найти людей в Astrogram.",
        chatsHint: "Ваши переписки.",
        verified: "Проверенный", banned: "Заблокирован",
        info: "Информация", bio: "О себе", noBio: "Пока ничего не написано",
        interests: "Что вы хотите видеть", noInterests: "Интересов пока нет",
        username: "Имя пользователя", posts: "Посты", nothingPosted: "Пока нет постов",
        online: "в сети", notLoggedIn: "Вы не вошли",
        subscribers: "подписчиков", subscribed: "подписок",
        subscribe: "Подписаться", isSubscribed: "Вы подписаны", message: "Написать",
        thisIsYou: "Это вы", bannedNoSub: "Заблокирован \u2014 нельзя подписаться",
        editProfile: "Изменить профиль", logOut: "Выйти", save: "Сохранить", cancel: "Отмена",
        copyLink: "Копировать ссылку", edit: "Изменить", del: "Удалить", report: "Пожаловаться",
        copied: "Скопировано!", keptPost: "Пост сохранён", deletedPost: "Пост удалён",
        loading: "Загрузка...", pull: "Потяните, чтобы обновить", release: "Отпустите, чтобы обновить",
        reloading: "Обновление...",
        noChats: "Пока нет переписок.<br>Откройте чей-нибудь профиль и нажмите Написать.",
        noSubs: "Вы ни на кого не подписаны",
        writeMessage: "Напишите сообщение...", typeUsername: "Введите имя...",
        noMessages: "Сообщений пока нет. Напишите что-нибудь.",
        startTyping: "Начните вводить, чтобы найти", nobodyCalled: "Никого с таким именем", nobodyFiltered: "Никого с таким именем, либо не подходит под фильтр",
        feedEmpty: "Загрузка ленты...",
        yourSubscribers: "Ваши подписчики", youSubscribedTo: "Вы подписаны на",
        nobodySubscribed: "Пока никто не подписался",
        cannotReach: "Не удаётся связаться с Astrogram",
    },
    uz: {
        settings: "Sozlamalar",
        settingsHint: "Hisobingiz va ilova ko'rinishi.",
        language: "Til",
        feed: "Lenta", search: "Qidiruv", chats: "Suhbatlar", profile: "Profil",
        feedHint: "Hamma nima yozmoqda.",
        searchHint: "Astrogramdan odam toping.",
        chatsHint: "Sizning suhbatlaringiz.",
        verified: "Tasdiqlangan", banned: "Bloklangan",
        info: "Ma'lumot", bio: "O'zim haqimda", noBio: "Hali hech narsa yozilmagan",
        interests: "Nimani ko'rmoqchisiz", noInterests: "Qiziqishlar yo'q",
        username: "Foydalanuvchi nomi", posts: "Postlar", nothingPosted: "Hali post yo'q",
        online: "onlayn", notLoggedIn: "Kirilmagan",
        subscribers: "obunachi", subscribed: "obuna",
        subscribe: "Obuna bo'lish", isSubscribed: "Obuna bo'lingan", message: "Yozish",
        thisIsYou: "Bu siz", bannedNoSub: "Bloklangan \u2014 obuna bo'lib bo'lmaydi",
        editProfile: "Profilni o'zgartirish", logOut: "Chiqish", save: "Saqlash", cancel: "Bekor qilish",
        copyLink: "Havolani nusxalash", edit: "O'zgartirish", del: "O'chirish", report: "Shikoyat",
        copied: "Nusxalandi!", keptPost: "Post saqlandi", deletedPost: "Post o'chirildi",
        loading: "Yuklanmoqda...", pull: "Yangilash uchun torting", release: "Yangilash uchun qo'yib yuboring",
        reloading: "Yangilanmoqda...",
        noChats: "Hali suhbat yo'q.<br>Birovning profilini oching va Yozish tugmasini bosing.",
        noSubs: "Hech kimga obuna bo'lmagansiz",
        writeMessage: "Xabar yozing...", typeUsername: "Ism yozing...",
        noMessages: "Hali xabar yo'q. Biror narsa yozing.",
        startTyping: "Topish uchun yoza boshlang", nobodyCalled: "Bunday odam yo'q", nobodyFiltered: "Bunday odam yo'q yoki filtrga to'g'ri kelmaydi",
        feedEmpty: "Lenta yuklanmoqda...",
        yourSubscribers: "Sizning obunachilaringiz", youSubscribedTo: "Siz obuna bo'lgansiz",
        nobodySubscribed: "Hali hech kim obuna bo'lmagan",
        cannotReach: "Astrogram bilan bog'lanib bo'lmadi",
    }
}

const LANG_KEY = "astrogram-lang"
// their phone's language on the first visit, English if it is not one of ours
let lang = localStorage.getItem(LANG_KEY) ||
           (TEXT[(navigator.language || "en").slice(0, 2)] ? navigator.language.slice(0, 2) : "en")

// Missing Uzbek falls back to English, and a missing key shows the key itself -
// so a gap reads as "subscribe" on screen, which is noticeable.
function t(key, values) {
    let out = (TEXT[lang] && TEXT[lang][key]) || TEXT.en[key] || key
    for (const k in (values || {})) out = out.split("{" + k + "}").join(values[k])
    return out
}

// Fills everything marked up in the HTML
function ApplyText() {
    $("[data-i18n]").each(function () { $(this).html(t($(this).data("i18n"))) })
    $("[data-i18n-ph]").each(function () { $(this).attr("placeholder", t($(this).data("i18n-ph"))) })
    $("html").attr("lang", lang)
}

const LANG_NAMES = {en: "English", ru: "Русский", uz: "O'zbekcha"}

$("body").on("click", "#GoProfile",  function () { PageUpdate("Profile") })
$("body").on("click", "#ProfileBack", function () { PageUpdate("Settings") })
$("body").on("click", "#GoLanguage", function () {
    OpenPopup("&#127760;", t("language"), "", "",
        Object.keys(LANG_NAMES).map(code =>
            `<button class="lang-pick${code === lang ? " on" : ""}" data-lang="${code}">` +
                `${LANG_NAMES[code]}</button>`).join(""))
})

function SetLanguage(picked) {
    localStorage.setItem(LANG_KEY, picked)
    // Reloading is far simpler than re-rendering every open list and pop-up,
    // and it happens once in a while.
    location.reload()
}
$("body").on("click", ".lang-pick", function () { SetLanguage($(this).data("lang")) })


const PREVIEW_LENGTH = 20;    // characters shown before the ".."
const PREVIEW_COUNT  = 5;     // how many posts before "Show all"


let me = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
// Where this account sits in the server's Users array. Saved at login so
// details can be asked for without searching by name.
let myIndex = Number(localStorage.getItem(INDEX_KEY) ?? sessionStorage.getItem(INDEX_KEY));

if (!me) {
    // "/" is the login page. link is "/api", which is not a page at all - going
    // there lands on "Invalid Path!".
    // The #post= or #account= is kept, or it would be lost on the way to login.
    if (window.location.hash) localStorage.setItem("astrogram-goto", window.location.hash);
    window.location.replace("/")
}
let UsersLoaded = (async function () {
    try {
        const request = await fetch(link + "/users")
        console.log(request)
        const answer = await request.json()
        UsernamesForSearch = answer.Usernames
        BannedForSearch = answer.Banned || []
        IndexesForSearch = answer.Indexes || []
        LevelsForSearch = answer.Levels || []
        PicturesForSearch = answer.Pictures || []
        console.log(UsernamesForSearch)
    }
    catch (error) {
        console.log(error);
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
    }
})()

// Show what we already know straight away, so the page is never blank
$("#WhoAmI").text(me || "Not logged in");
$("#MyUsername").text(me ? "@" + me : "—");

// Anything the server is willing to tell us about this account.
async function loadMyInfo() {
    const response = await fetch(link + "/user-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: myIndex })
    });
    if (!response.ok) return null;
    return await response.json();
}

// ...then fill in the rest once the server answers
async function showMyInfo() {
    let info = null;
    try { info = await loadMyInfo(); } catch (error) { return; }
    if (!info) return;

    $("#WhoAmI").text(info.Username);
    $("#MyUsername").text("@" + info.Username);

    if (info.description) {
        BeforeEditDesc = info.description
        $("#MyDesc").text(info.description).removeClass("empty");
    }
    BeforeEditTags = info.tags || []
    $("#MySubCount").text((info.subscribers || []).length)
    $("#MyPicture").attr("src", info.picturePath || DEFAULT_PICTURE)
    if (info.banned) {
        $("#MyStatus").text("banned").addClass("off");
    }
    // the class goes on the whole header, so the avatar and the tick
    // both pick up the blue
    $(".profile-header").toggleClass("is-verified", info.level === "verified");
    StaticProfile()
    await ShowMyPosts()
}

// My own posts, into the Posts block on the Profile page.
async function ShowMyPosts() {
    try {
        const response = await fetch(link + "/user-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex })
        })
        // 202 means the account simply has none yet
        let posts = response.status === 200 ? (await response.json()).posts || [] : []
        DrawPosts(posts, "#MyPosts", "#PostCount", me)
    } catch (error) {
        console.log("Could not load posts:", error)
    }
}

if (me) { await showMyInfo(); }

// Delegated: StaticProfile() removes this button and appends a fresh one,
// and a handler bound straight to the old element dies with it.
$("body").on("click", "#LogOut", function () {
    // without this "/" would see the cookie and send them straight back in
    document.cookie = "astrogram-in=; path=/; max-age=0";
    localStorage.removeItem(USER_KEY);     // clear both, whichever was used
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(INDEX_KEY);
    sessionStorage.removeItem(INDEX_KEY);
    window.location.replace("/")
});
// either the one in the address bar, or the one kept from before logging in
let hash = window.location.hash || localStorage.getItem("astrogram-goto") || ""
localStorage.removeItem("astrogram-goto")
if (hash) {
    let parts = hash.replace("#", "").split("=")
    let action = parts[0]
    let value = parts[1]
    if (action === "account") {
        await ShowAccountBySearch(value)
    }
    if (action === "post") {
        // value is the id out of the address bar, a string. ShowFullPost wants
        // the whole post, so it is fetched first.
        await ShowPostById(value)
    }
    history.replaceState(null, null, window.location.pathname + window.location.search);
}

//| ====== SWIPE BETWEEN PAGES ====== |\\
// Left and right across the four main pages. Chat is left out - it is pinned,
// and its own scrolling should not fight with this.
const SWIPE_PAGES = ["Feed", "Search", "Chats", "Settings"]
const SWIPE_NEEDED = 60         // sideways travel before it counts
let SwipeX = null, SwipeY = null

document.addEventListener("touchstart", function (event) {
    if ($("#PopupOverlay").length || CurrentPage === "Chat") { SwipeX = null; return }
    SwipeX = event.touches[0].clientX
    SwipeY = event.touches[0].clientY
}, {passive: true})

document.addEventListener("touchend", function (event) {
    if (SwipeX === null) return
    const dx = event.changedTouches[0].clientX - SwipeX
    const dy = event.changedTouches[0].clientY - SwipeY
    SwipeX = null
    // sideways, and clearly more sideways than up and down, or scrolling would
    // keep flicking the page over
    if (Math.abs(dx) < SWIPE_NEEDED || Math.abs(dx) < Math.abs(dy) * 1.5) return

    const at = SWIPE_PAGES.indexOf(CurrentPage)
    if (at === -1) return
    const to = dx < 0 ? at + 1 : at - 1          // dragging left moves forward
    if (to < 0 || to >= SWIPE_PAGES.length) return

    SlideTo(SWIPE_PAGES[to], dx < 0 ? "left" : "right")
}, {passive: true})

// the page it leaves and the page it lands on move the same way
function SlideTo(which, way) {
    const going = $(".Page.on")
    going.addClass(way === "left" ? "out-left" : "out-right")
    setTimeout(function () {
        going.removeClass("on out-left out-right")
        PageUpdate(which)
        $(".Page.on").addClass(way === "left" ? "in-right" : "in-left")
        setTimeout(function () { $(".Page").removeClass("in-left in-right") }, 220)
    }, 130)
}

//| ====== PULL DOWN TO RELOAD ====== |\\
// Drag down from the very top and let go, the way a phone app does. Whatever
// the page shows is fetched again.
const PULL_NEEDED = 70          // how far down before letting go counts
let PullFrom = null             // where the finger started, null when not pulling
let Refreshing = false

async function RefreshPage() {
    if (Refreshing) return
    Refreshing = true
    $("#Pull").addClass("busy")
    $("#Pull .pull-text").text(t("reloading"))
    try {
        if (CurrentPage === "Feed") {
            $("#FeedList").html("")
            LastDrawn = ""
            await LoadMoreFeed()
        }
        else if (CurrentPage === "Chats")   await ShowFollowing()
        else if (CurrentPage === "Profile") { await showMyInfo(); await ShowFollowing() }
        else if (CurrentPage === "Chat")    { LastDrawn = ""; await LoadChat() }
        else if (CurrentPage === "Search")  $("#SearchInput").trigger("input")
    }
    catch (e) { console.log(e) }
    Refreshing = false
    $("#Pull").removeClass("busy ready").css("height", 0)
    $("#Pull .pull-text").text(t("pull"))
}

// touchmove has to be able to preventDefault, and jQuery attaches these
// passively, so they are bound the plain way
function AtTheTop() {
    if ($("#PopupOverlay").length) return false
    // the conversation never scrolls the page, so ask the message list instead
    if (CurrentPage === "Chat") {
        const box = document.getElementById("ChatMessages")
        return !box || box.scrollTop <= 2
    }
    return window.scrollY <= 2
}

document.addEventListener("touchstart", function (event) {
    if (!AtTheTop()) { PullFrom = null; return }
    PullFrom = event.touches[0].clientY
}, {passive: true})

document.addEventListener("touchmove", function (event) {
    if (PullFrom === null || Refreshing) return
    const moved = event.touches[0].clientY - PullFrom
    if (moved <= 0) { PullFrom = null; $("#Pull").css("height", 0); return }
    if (!AtTheTop()) { PullFrom = null; $("#Pull").css("height", 0); return }

    event.preventDefault()                       // stop the page itself moving
    // the further you drag the less it follows, so it feels like elastic
    const shown = Math.min(moved * 0.5, 90)
    const ready = shown >= PULL_NEEDED
    $("#Pull").css("height", shown + "px").toggleClass("ready", ready)
    $("#Pull .pull-text").text(ready ? t("release") : t("pull"))
}, {passive: false})

document.addEventListener("touchend", function () {
    if (PullFrom === null) return
    PullFrom = null
    // how far it was dragged is exactly the height it is showing
    const dragged = $("#Pull").height()
    if (dragged >= PULL_NEEDED) RefreshPage()
    else $("#Pull").removeClass("ready").css("height", 0)
}, {passive: true})

//| ====== COPYING ====== |\\
// navigator.clipboard only exists on https or localhost. Over plain http on the
// wifi it is undefined, so every copy silently failed. The old way still works
// everywhere, and if even that is refused the link is shown to copy by hand.
async function CopyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text)
            return true
        }
        const box = document.createElement("textarea")
        box.value = text
        box.style.cssText = "position:fixed;top:-1000px;opacity:0"   // off screen, no scroll jump
        document.body.appendChild(box)
        box.select()
        const done = document.execCommand("copy")
        document.body.removeChild(box)
        if (done) return true
    }
    catch (e) { console.log("copy failed:", e) }

    OpenPopup("&#128279;", "Copy this link", "", "",
        `<input class="copy-fallback" type="text" readonly value="${Escape(text)}">`)
    $(".copy-fallback").trigger("focus").trigger("select")
    return false
}

//| ====== THE CHAT ====== |\\
let OpenChatWith = null      // whose conversation is on screen, null when none
let ChatPoll = null          // the timer that asks for new messages
let LastDrawn = ""           // ids of what is drawn, so it only redraws on a change
let DeletingMessageId = null // which message the confirm pop-up is about

function OpenChat(other, name) {
    ClosePopup()
    OpenChatWith = Number(other)
    LastDrawn = ""

    $("#ChatName").text(name || "Chat")
    $("#ChatSub").text("@" + (name || ""))
    $("#ChatPicture").attr("src", PictureOf(OpenChatWith))
    $("#ChatMessages").html(`<div class="chat-empty"><span class="spin"></span>${t("loading")}</div>`)
    $("#ChatInput").val("")

    PageUpdate("Chat")
    $("#ChatInput").trigger("focus")

    LoadChat()
    clearInterval(ChatPoll)
    ChatPoll = setInterval(LoadChat, 2000)      // 2s while it is open
}

$("body").on("click", "#ChatBack", function () { PageUpdate("Chats") })

// PageUpdate calls this the moment you leave, so the timer cannot outlive the page
function StopChat() {
    clearInterval(ChatPoll)
    ChatPoll = null
    OpenChatWith = null
}

async function LoadChat() {
    if (OpenChatWith === null) return StopChat()
    try {
        const response = await fetch(link + "/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: myIndex, id2: OpenChatWith })
        })
        if (response.status !== 200) return
        DrawMessages((await response.json()).MessageList || [])
    }
    catch (e) { }          // a missed poll is no reason to shout, the next one will do
}

function DrawMessages(list) {
    // Redrawing every two seconds would fight whatever you are selecting, so
    // it only happens when the messages have actually changed.
    const stamp = list.map(m => m.id).join(",")
    if (stamp === LastDrawn) return
    LastDrawn = stamp

    if (!list.length) {
        $("#ChatMessages").html(`<div class="chat-empty">${t("noMessages")}</div>`)
        return
    }
    let out = ""
    for (const m of list) {
        out += `<div class="bubble ${Number(m.who) === myIndex ? "mine" : "theirs"}" data-id="${m.id}">` +
                   `<span class="bubble-text" translate="no">${Escape(urlify(m.init))}</span>` +
                   `<span class="bubble-time">${MessageTime(m.time)}</span>` +
               `</div>`
    }
    $("#ChatMessages").html(out)
    const box = $("#ChatMessages")[0]
    box.scrollTop = box.scrollHeight          // newest in view
}

// A username or a message is text, never markup
function Escape(text) {
    return $("<div>").text(text == null ? "" : text).html()
}

async function SendMessage() {
    const text = $("#ChatInput").val().trim()
    if (!text || OpenChatWith === null) return
    $("#ChatInput").val("")                   // cleared at once, it feels quicker
    try {
        const response = await fetch(link + "/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: myIndex, id2: OpenChatWith, message: text })
        })
        if (response.status !== 200) {
            OpenPopup("&#128683;", "Could not send", await response.text(), "bad")
            return
        }
        await LoadChat()                      // straight away, not in two seconds
    }
    catch (e) {
        $("#ChatInput").val(text)             // give them their words back
        MessageBubble("Could not send that")
    }
}

// Tapping your own message offers to delete it. Theirs does nothing - you can
// only ever remove what you sent.
$("body").on("click", ".bubble.mine", function () {
    const id = $(this).data("id")
    const text = $(this).find(".bubble-text").text()
    OpenPopup("&#128465;", "Delete this message?", Shorten(text, 60), "",
        `<button id="DeleteMsgYes" class="doom-yes">Delete</button>` +
        `<button id="DeleteMsgNo" class="doom-no">Keep it</button>`)
    DeletingMessageId = id
})
$("body").on("click", "#DeleteMsgNo", ClosePopup)
$("body").on("click", "#DeleteMsgYes", async function () {
    const id = DeletingMessageId
    ClosePopup()
    if (id === null) return
    try {
        const response = await fetch(link + "/delete-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex, id: id })
        })
        if (response.status !== 200) {
            MessageBubble(await response.text())
            return
        }
        // it is gone, so the drawn list is out of date
        $(`.bubble[data-id="${id}"]`).addClass("going")
        LastDrawn = ""
        await LoadChat()
    }
    catch (e) { MessageBubble("Could not delete that", "") }
})

$("body").on("click", "#ChatSend", SendMessage)
$("body").on("keydown", "#ChatInput", function (event) {
    if (event.key === "Enter") SendMessage()
})

// the two ways in
$("body").on("click", ".chat-row", function () {
    OpenChat($(this).data("index"), $(this).find(".name").text())
})
$("body").on("click", ".message-btn", function () {
    const id = $(this).data("index")
    OpenChat(id, $("#WhoAmI").text())
})

//| ====== TIME ====== |\\
// Messages carry at: Date.now() - a plain number of milliseconds. Never a
// formatted string: those cannot be sorted, compared, or shown differently
// to someone in another country.
//   MessageTime(m.time)  ->  "14:32"        the clock, for next to a message
//   TimeAgo(m.time)      ->  "2 hours ago"  for a chat list
function MessageTime(at) {
    if (!at) return ""
    return new Date(at).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})
}

function TimeAgo(at) {
    if (!at) return ""
    const secs = Math.floor((Date.now() - at) / 1000)
    if (secs < 60)     return "just now"
    if (secs < 3600)   return Math.floor(secs / 60) + " min ago"
    if (secs < 86400)  return Math.floor(secs / 3600) + " hours ago"
    if (secs < 604800) return Math.floor(secs / 86400) + " days ago"
    return new Date(at).toLocaleDateString()          // older than a week, just the date
}

//| ====== WHO I FOLLOW ====== |\\
// One row for a person. cls picks what a click means:
//   chat-row   opens the conversation
//   person-row opens their account
function PersonRow(u, cls) {
        return `<button class="${cls}${u.banned ? " banned" : ""}` +
                    `${u.level === "verified" || u.level === "creator" ? " is-verified" : ""}" ` +
                    `data-index="${u.index}">` +
                `<div class="avatar"><img src="${u.picturePath || DEFAULT_PICTURE}" alt=""></div>` +
                `<span class="chat-who">` +
                    `<span class="name-row">` +
                        `<span class="name">${u.Username}</span>` +
                        VERIFIED_TICK +
                        `<span class="banned-tag">Banned</span>` +
                    `</span>` +
                    `<span class="at${u.lastMessage ? " has-chat" : ""}">` +
                    (u.lastMessage
                        ? (u.lastFrom === myIndex ? "You: " : "") + Shorten(u.lastMessage, 52)
                        : (u.description ? Shorten(u.description, 60) : "@" + u.Username)) +
                `</span>` +
                `</span>` +
            `</button>`
    }


// Draws a list of people into a pop-up. person-row, not chat-row, so a click
// opens the account rather than a conversation.
function ShowPeople(title, people, empty) {
    OpenPopup("", title, people.length ? people.length + "" : "", "",
        `<div class="people-list">` +
            (people.length
                ? people.map(u => PersonRow(u, "person-row")).join("")
                : `<div class="no-posts"><span class="big">&#128100;</span>${empty}</div>`) +
        `</div>`, 62, 82)
}

// a row in one of those pop-ups opens that account
$("body").on("click", ".person-row", async function () {
    await ShowAccountBySearch($(this).data("index"))
})

// ---- who follows somebody ----
async function ShowSubscribersOf(index, title) {
    OpenPopup("", title, "", "", `<div class="people-list">${LOADING}</div>`, 62, 82)
    try {
        const response = await fetch(link + "/subscribers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ of: Number(index) })
        })
        if (response.status !== 200) return
        const list = (await response.json()).subscribers
        ShowPeople(title, list, t("nobodySubscribed"))
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad")
    }
}

// ---- who somebody follows ----
async function ShowSubscribedOf(index, title) {
    OpenPopup("", title, "", "", `<div class="people-list">${LOADING}</div>`, 62, 82)
    try {
        const response = await fetch(link + "/following", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: Number(index) })
        })
        if (response.status !== 200) return
        // /following also returns people they only have messages with
        const list = (await response.json()).following.filter(u => u.subscribed)
        ShowPeople(title, list, t("noSubs"))
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad")
    }
}

$("body").on("click", "#ShowSubscribers", function () { ShowSubscribersOf(myIndex, t("yourSubscribers")) })
$("body").on("click", "#ShowSubscribed",  function () { ShowSubscribedOf(myIndex, t("youSubscribedTo")) })
// on somebody else's account
$("body").on("click", ".show-subscribers", function () {
    const whose = $(this).data("index")
    ShowSubscribersOf(whose, $("#WhoAmI").text() + "'s subscribers")
})

// The Chats page: conversations. The Profile page: who you follow.
const LOADING = `<div class="search-empty"><span class="spin"></span>${t("loading")}</div>`

async function ShowFollowing() {   // Chats: conversations. Profile: who you follow.
    // Only says Loading when there is nothing there yet, so switching back to a
    // list you have already seen does not blank it for half a second.
    if (!$("#FollowingList").children(".chat-row").length) $("#FollowingList").html(LOADING)
    try {
        const response = await fetch(link + "/following", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex })
        })
        if (response.status !== 200) {
            // saying nothing left "Loading..." on the screen for ever
            $("#FollowingList").html(
                "<div class='search-empty'><span class='big'>&#128246;</span>" +
                "Could not load your chats.</div>")
            return
        }
        const list = (await response.json()).following

        if (!list.length) {
            $("#FollowingList").html(
                "<div class='search-empty'><span class='big'>&#128172;</span>" +
                t("noChats") + "</div>")
            $("#MySubscribedCount").text("0")
            return
        }

        // One per line, like a chat list, not a grid of cards
        const Row = u => PersonRow(u, "chat-row")

        // ---- Chats: only real conversations ----
        // lastAt, not lastMessage: somebody sending an empty message would make
        // lastMessage "" - falsy - and the whole conversation would vanish.
        const talking = list.filter(u => u.lastAt)
        $("#FollowingList").html(talking.length
            ? talking.map(Row).join("")
            : "<div class='search-empty'><span class='big'>&#128172;</span>" +
              t("noChats") + "</div>")

        // ---- Profile: just the number next to the name, the list is a pop-up ----
        $("#MySubscribedCount").text(list.filter(u => u.subscribed).length)
    }
    catch (e) {
        console.log(e)
        $("#FollowingList").html(
            "<div class='search-empty'><span class='big'>&#128246;</span>" +
            "Cannot reach Astrogram.</div>")
    }
}

//| ====== THE ADMIN ====== |\\
// Subscribing to the admin is a trap. It is spelled out in his description
// and again in the pop-up, and it is entirely true.
const ADMIN_INDEX = 0
let DoomTimer = null

$("body").on("click", ".subscribe-btn", function (event) {
    if (Number($(this).data("index")) !== ADMIN_INDEX) return    // ordinary account
    event.stopImmediatePropagation()                              // hold the normal handler back
    OpenPopup("&#9760;", "Are you sure?",
        "Please read the description and it is 100% true, would you proceed?", "",
        `<button id="AdminSubYes" class="doom-yes">Yes, I will subscribe (Biggest regret)</button>` +
        `<button id="AdminSubNo" class="doom-no">Nope</button>`)
})

$("body").on("click", "#AdminSubNo", function () {
    ClosePopup()
    MessageBubble("Wise.")
})

$("body").on("click", "#AdminSubYes", async function () {
    ClosePopup()
    await fetch(link + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: myIndex, id2: ADMIN_INDEX })
    })
    MessageBubble("Subscribed to the Admin. Nothing bad will happen.")
    StartDoom()
})

// The moment lives on the server, so a reload cannot put it off. This just
// keeps asking, and does as it is told.
function StartDoom() {
    if (DoomTimer) return
    DoomTimer = setInterval(CheckDoom, 15000)
    CheckDoom()
}

async function CheckDoom() {
    let answer
    try {
        const response = await fetch(link + "/am-i-doomed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex })
        })
        answer = await response.json()
    } catch (e) { return }

    if (!answer.doomed) { clearInterval(DoomTimer); DoomTimer = null; return }
    if (!answer.banned) return          // not yet. everything is completely fine.

    clearInterval(DoomTimer)
    document.cookie = "astrogram-in=; path=/; max-age=0"
    localStorage.setItem("astrogram-doomed", "1")   // the login page reads this
    localStorage.removeItem(USER_KEY); sessionStorage.removeItem(USER_KEY)
    localStorage.removeItem(INDEX_KEY); sessionStorage.removeItem(INDEX_KEY)
    window.location.replace("/")
}

// Every load asks too, so closing the tab is no escape either.
StartDoom()

//| ====== REPORTING ====== |\\
// Which post the open report pop-up belongs to. The buttons in it carry the
// reason, not the post, so it is remembered when the pop-up is opened.
let ReportingPostId = null

// "other" needs the words typing first, the rest send straight away
$("body").on("click", ".report-reason", function () {
    const reason = $(this).data("reason")
    const id = ReportingPostId
    if (reason === "Other") {
        $(".report-reason").removeClass("on")
        $(this).addClass("on")
        $("#OtherReasonBox").addClass("open")
        $("#OtherReason").trigger("focus")
        return
    }
    SendReport(id, reason)
})
$("body").on("click", "#SendOtherReason", function () {
    const id = ReportingPostId
    const typed = $("#OtherReason").val().trim()
    if (!typed) { $("#OtherReason").trigger("focus"); return }
    SendReport(id, typed)          // the words themselves are the reason
})

async function SendReport(id, reason) {
    try {
        const response = await fetch(link + "/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: myIndex, post: id, reason: reason })
        })
        if (response.status === 201) { ClosePopup(); MessageBubble("You already reported that one"); return }
        if (response.status !== 200) {
            OpenPopup("&#128683;", "Could not report", await response.text(), "bad")
            return
        }
        const answer = await response.json()
        ClosePopup()
        MessageBubble(answer.banned
            ? "Reported \u2014 that account has been banned"
            : "Reported. Thank you.")
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad")
    }
}

//| ====== MESSAGE BUBBLE ====== |\\

function MessageBubble(text, html = "", width = 0, height = 0, autoClose = true) {
    const bubble = $(
        `<div class="msg-bubble">` +
            `<button class="msg-close" aria-label="Close">&times;</button>` +
            `<div class="msg-text">${text || ""}</div>` +
            (html || "") +
        `</div>`
    )
    if (width !== undefined || width !== "" || width !== 0) {
        bubble.css({ width: width + "vw", maxWidth: "calc(100vw - 32px)" })
    }
    if (height !== undefined || height !== "" || height !== 0) {
        bubble.css({ height: height + "vh", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" })
    }
    $("#BubbleStack").append(bubble)
    if (autoClose) setTimeout(function () {CloseBubbles()}, 2000)
    return bubble          // so the caller can keep hold of it and remove it later
}
function CloseBubbles() { $("#BubbleStack").empty() }
$("body").on("click", ".msg-close", function () {
    $(this).closest(".msg-bubble").addClass("going")
    setTimeout(() => $(".msg-bubble.going").remove(), 200)
})

function OpenPopup(icon, title, text, kind, html, width, height) {
    ClosePopup();
    $("body").addClass("popup-open");      // stops the page scrolling underneath
    $("body").append(
        "<div id='PopupOverlay'>" +
            "<div id='PopupBox' class='" + (kind || "") + "'>" +
                // outside the scrolling part, so a tall pop-up cannot carry it
                // off the top of the screen
                "<button id='PopupClose'>&times;</button>" +
                "<div id='PopupBody'>" +
                    "<div id='PopupIcon'>" + icon + "</div>" +
                    "<h3 id='PopupTitle'>" + title + "</h3>" +
                    "<p id='PopupText'>" + (text || "") + "</p>" +
                    (html || "") +
                "</div>" +
            "</div>" +
        "</div>"
    );

    // Only touch the size when a number was actually passed, so every
    // existing call keeps the size it already had.
    if (width !== undefined) {
        // vw not %, because a % here would be of the overlay, and the
        // overlay is already the whole screen — same thing, but vw says it.
        $("#PopupBox").css({ width: width + "vw", maxWidth: "calc(100vw - 32px)" });
    }
    if (height !== undefined) {
        // the body scrolls, never the box - the x lives outside it
        $("#PopupBox").css({ height: height + "vh", maxHeight: "calc(100dvh - 32px)" });
    }
}
function ClosePopup() {
    $("#PopupOverlay").remove();
    $("body").removeClass("popup-open");
    PopupBack = null;
}

// What the arrow in the corner does. Null means no arrow at all, which is
// every pop-up that was not opened from somewhere else.
let PopupBack = null;
function AddBackButton(action) {
    PopupBack = action;
    $("#PopupBox").addClass("has-back")
        .prepend(`<button id="PopupBack" aria-label="Back">&#8592;</button>`);
}
$("body").on("click", "#PopupBack", function () {
    const go = PopupBack;          // ClosePopup wipes it, so hold on to it first
    if (go) go();
});

$("body").on("click", "#PopupClose", ClosePopup);
$("body").on("click", "#PopupOverlay", function (event) {
    if (event.target.id === "PopupOverlay") ClosePopup();
});
function NoSpaceAndComa(text) {
    return text.replaceAll(",", "").replaceAll(" ", "");
}
// One post as a card. The CSS for all of this is under "THE FEED".
function FeedCard(post) {
    // The search lists skip the admin, so a post's owner is NOT their position
    // in them - it has to be looked up by the real index.
    const at = IndexesForSearch.indexOf(post.owner)
    // the admin is left out of the search lists, so fall back to what the feed sent
    const name = post.ownerName || (at === -1 ? "Someone" : UsernamesForSearch[at])
    const banned = BannedForSearch[at] === true
    const verified = LevelsForSearch[at] === "verified"

    const picture = ImageStack(post.imagePath, "feed-image")
    const tags = (post.tags || []).length
        ? `<div class="feed-tags">#${post.tags.join(" #")}</div>` : ""

    const buttons = LikeButtons(post)

    return `<article class="feed-post${verified ? " is-verified" : ""}${banned ? " banned" : ""}" data-id="${post.id}">` +
               `<div class="feed-head" data-index="${post.owner}">` +
                   `<div class="avatar small">` +
                       `<img src="${PictureOf(post.owner)}" alt="">` +
                   `</div>` +
                   `<div class="feed-who">` +
                       `<div class="feed-name">` +
                           `<span class="feed-nick" translate="no">${name}</span>` +
                           VERIFIED_TICK +
                           `<span class="feed-banned">Banned</span>` +
                       `</div>` +
                       `<div class="feed-at">@${name}</div>` +
                   `</div>` +
                   PostMenu(post) +
               `</div>` +
               (post.title ? `<div class="feed-title" translate="no">${post.title}</div>` : "") +
               `<div class="feed-text" translate="no">${post.text || "<i>empty post</i>"}</div>` +
               picture +
               FileStack(post.files) +
               tags +
               buttons +
           `</article>`
}

const VERIFIED_TICK =
    `<svg class="verified-tick" viewBox="0 0 24 24" fill="currentColor">` +
        `<path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>` +
    `</svg>`


// Seeded the first time a post is seen, and only then - after that these
// three are the truth, because the presses have been going into them.
function RememberPost(post) {
    if (post.id === undefined || LikeCounts.has(post.id)) return
    LikeCounts.set(post.id, (post.like || []).length)
    if ((post.like    || []).includes(myIndex)) MyLikes.add(post.id)
    if ((post.dislike || []).includes(myIndex)) MyDislikes.add(post.id)
}

// Every picture on a post, each the full width and as tall as it is wide.
// A lone one gets no counter, several get 1/3, 2/3 and so on.
// Anything that is not a picture or a video is shown as a row you can download.
function NiceSize(bytes) {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB"
    return (bytes / 1024 / 1024).toFixed(1) + " MB"
}

function FileStack(files) {
    const list = Array.isArray(files) ? files : []
    if (!list.length) return ""
    return `<div class="file-stack">` +
        list.map(f =>
            // download= makes the browser save it instead of trying to show it,
            // and ?name= keeps the name they gave it
            `<a class="file-row" href="${f.url}?name=${encodeURIComponent(f.name)}" download="${f.name}">` +
                `<span class="file-icon">&#128206;</span>` +
                `<span class="file-what">` +
                    `<span class="file-name" translate="no">${Escape(f.name)}</span>` +
                    `<span class="file-size">${NiceSize(f.size || 0)}</span>` +
                `</span>` +
                `<span class="file-get">&#11015;</span>` +
            `</a>`
        ).join("") +
    `</div>`
}

const VIDEO_KINDS = ["mp4", "webm", "mov", "ogv"]
function IsVideo(src) {
    return VIDEO_KINDS.includes((src || "").split("?")[0].split(".").pop().toLowerCase())
}

function ImageStack(paths, cls) {
    const list = Array.isArray(paths) ? paths : (paths ? [paths] : [])
    if (!list.length) return ""
    return `<div class="image-stack">` +
        list.map((src, i) =>
            `<div class="image-slot">` +
                (IsVideo(src)
                    // no cls on a video: that class is what opens the big picture
                    // viewer, and a video needs its own clicks for the controls
                    ? `<video class="post-video" src="${src}" controls preload="metadata" playsinline></video>`
                    : `<img class="${cls}" src="${src}" alt="">`) +
                (list.length > 1 ? `<span class="image-num">${i + 1}/${list.length}</span>` : "") +
            `</div>`
        ).join("") +
    `</div>`
}

// Clicking a picture blows it up. Whatever pop-up was open is kept aside so
// the arrow can put it back exactly as it was, rather than closing everything.
$("body").on("click", ".feed-image, .post-full-image", function (event) {
    event.stopPropagation()
    const src = $(this).attr("src")
    const box = $("#PopupBox")

    if (box.length) {
        const beforeHtml  = box.html()
        const beforeBack  = PopupBack           // the arrow it already had, if any
        const beforeStyle = box.attr("style") || ""   // OpenPopup put the size here
        box.addClass("image-mode").removeAttr("style").html(
            `<button id="PopupClose">&times;</button>` +
            `<div class="image-viewer"><img src="${src}" alt=""></div>`)
        AddBackButton(function () {
            box.removeClass("image-mode").attr("style", beforeStyle).html(beforeHtml)
            PopupBack = beforeBack              // and its own arrow works again
        })
    } else {
        // No size passed, so the box shrinks to the picture and the x lands on
        // its corner instead of floating out in the empty space beside it.
        OpenPopup("", "", "", "", `<div class="image-viewer"><img src="${src}" alt=""></div>`)
        $("#PopupBox").addClass("image-mode")
    }
})

//| ====== Changing the profile picture ====== |\\
// A button cannot open a file dialog - only a file input can. So one is kept
// hidden on the page and the button clicks it instead.
$("body").on("click", "#ChangePicture", function () {
    $("#PictureInput")[0].click()      // works because we are inside a real click
})

$("body").on("change", "#PictureInput", async function () {
    const file = this.files[0]
    this.value = ""                    // or picking the same file twice fires nothing
    if (!file) return                  // they opened it and pressed cancel

    if (file.size > MAX_IMAGE) {
        OpenPopup("&#128683;", "Picture too big",
            `That one is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB.`, "bad")
        return
    }

    const was = $("#MyPicture").attr("src")
    $("#PageProfile .avatar").addClass("uploading")
    try {
        const data = new FormData()
        data.append("image", file)
        data.append("index", String(myIndex))
        const response = await fetch(link + "/change-picture", { method: "POST", body: data })
        if (response.status !== 200) {
            OpenPopup("&#128683;", "Could not change it", await response.text(), "bad")
            $("#MyPicture").attr("src", was)
            return
        }
        const answer = await response.json()
        $("#MyPicture").attr("src", answer.picturePath)
        // the lists the feed and search draw from are now out of date
        const at = IndexesForSearch.indexOf(myIndex)
        if (at !== -1) PicturesForSearch[at] = answer.picturePath
        OpenPopup("\u2705", "Picture changed!")
    }
    catch (e) {
        $("#MyPicture").attr("src", was)
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
    }
    finally { $("#PageProfile .avatar").removeClass("uploading") }
})

// Opens a post from nothing but its id, for #post= links.
async function ShowPostById(id) {
    OpenPopup("", "", "", "", `<div class="people-list">${LOADING}</div>`, 62, 82)
    try {
        const response = await fetch(link + "/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(id) })
        })
        if (response.status !== 200) {
            OpenPopup("&#128683;", "That post is gone",
                "It may have been deleted.", "bad")
            return
        }
        const answer = await response.json()
        await ShowFullPost(answer.post, answer.ownerName)
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad")
    }
}

// Copying a link to one post. Same shape as #account=, so the two work alike.
$("body").on("click", ".post-copy", function () {
    const id = $(this).data("id")
    const item = $(this)
    CopyText(currentLink + `#post=${id}`).then(function (ok) {
        if (!ok) return
        const was = item.html()
        item.html(`<span class="mi">&#10003;</span> ${t("copied")}`)
        setTimeout(function () { item.html(was) }, 1000)
    })
})

// The ... in the corner of a post. What is inside depends on whose it is.
// None of the three do anything yet - the handlers are yours to write.
function PostMenu(post) {
    const mine = Number(post.owner) === myIndex
    // everyone gets this one, mine or not
    const copy = `<button class="post-menu-item post-copy" data-id="${post.id}">` +
                     `<span class="mi">&#128279;</span> ${t("copyLink")}</button>`
    const items = copy + (mine
        ? `<button class="post-menu-item post-edit" data-id="${post.id}">` +
              `<span class="mi">&#9998;</span> ${t("edit")}</button>` +
          `<button class="post-menu-item danger post-delete" data-id="${post.id}">` +
              `<span class="mi">&#128465;</span> ${t("del")}</button>`
        : `<button class="post-menu-item danger post-report" data-id="${post.id}">` +
              `<span class="mi">&#128681;</span> ${t("report")}</button>`)

    return `<div class="post-menu">` +
               `<button class="post-menu-btn" aria-label="More" data-id="${post.id}">&#8943;</button>` +
               `<div class="post-menu-list">${items}</div>` +
           `</div>`
}

// Opening and closing it only - the three buttons inside are not bound.
$("body").on("click", ".post-menu-btn", function (event) {
    event.stopPropagation()          // or the head underneath opens the account
    const menu = $(this).closest(".post-menu")
    const wasOpen = menu.hasClass("open")
    $(".post-menu").removeClass("open")     // never two at once
    menu.toggleClass("open", !wasOpen)
})
// anywhere else on the page shuts it
$("body").on("click", function () { $(".post-menu").removeClass("open") })
$("body").on("click", ".post-menu-list", function (event) { event.stopPropagation() })

// The heart and the thumb. Shared by the feed cards and the single-post
// pop-up, so one click handler covers both and the counts stay in step.
function LikeButtons(post) {
    RememberPost(post)
    const iLiked    = MyLikes.has(post.id)    ? " on" : ""
    const iDisliked = MyDislikes.has(post.id) ? " on" : ""
    return  `<div class="feed-actions">` +
            `<button class="feed-act like${iLiked}" data-id="${post.id}" aria-label="Like">` +
                `<svg viewBox="0 0 24 24">` +
                    `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>` +
                `</svg>` +
                `<span class="like-count">${LikeCounts.get(post.id) || ""}</span>` +
            `</button>` +
            `<button class="feed-act dislike${iDisliked}" data-id="${post.id}" aria-label="Dislike">` +
                `<svg viewBox="0 0 24 24">` +
                    `<path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>` +
                `</svg>` +
            `</button>` +
        `</div>`
}

// A wall of text would push everything else off the screen, so anything
// taller than the cap is faded out and gets a "Read more" underneath.
function ClampLongPosts() {
    $(".feed-text").each(function () {
        if (this.scrollHeight > 150 && !$(this).hasClass("clamped")) {
            $(this).addClass("clamped")
                .after(`<button class="feed-more">READ MORE</button>`)
        }
    })
}
$("body").on("click", ".feed-more", function () {
    $(this).prev(".feed-text").removeClass("clamped")
    $(this).remove()
})

// The head has a hover and a pointer cursor, so it opens the account.
$("body").on("click", ".feed-head", async function () {
    await ShowAccountBySearch($(this).data("index"))
});   // <-- the ; matters: the next line starts with ( and would be read as a call

//Random Feeds:
// Called once at start up, then again by EndWatcher every time the bottom
// of the page comes into view.
async function LoadMoreFeed() {
    try {
        const response = await fetch(link + "/random-feeds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex })
        });
        let Feed = (await response.json())['Choosen20Posts']
        console.log(Feed)
        await UsersLoaded          // the names come from that list, so wait for it
        if (!Feed || !Feed.length) return
        $(".feed-empty").remove();
        let cards = ""
        for (let post of Feed) {
            cards += FeedCard(post)
        }
        $("#FeedList").append(cards)
        ClampLongPosts()
        WatchNewPosts()            // the cards that just arrived are strangers to Seen
    }
    catch (e) {
        console.log(e)
    }
}

//| ======== Edit Profile ======== |\\

$("body").on("click", "#EditProfile" , function () {
    EditableProfile()
})
// Makes a textarea exactly as tall as its contents.
function GrowToFit(box) {
    box.style.height = "auto";                    // shrink first, or it can only ever grow
    box.style.height = box.scrollHeight + "px";   // then match the text inside
}
// Fires on every keystroke, and on paste
$("body").on("input", "#BioInput, #PostInput", function () { GrowToFit(this) });

// Paints the tags as pills, or the gray placeholder when there are none.
function DrawTags(tags) {
    const row = $("#MyTags").empty()
    if (!tags || !tags.length) {
        row.addClass("empty").text("No interests yet")
        return
    }
    row.removeClass("empty")
    for (const tag of tags) {
        row.append($("<span class='tag-chip'></span>").text("#" + tag))
    }
}

function EditableProfile() {
    BeforeEditDesc = $("#MyDesc").text()
    // A textarea, not an input — an input is one line and can only scroll.
    $("#MyDesc").html(`<textarea id="BioInput" rows="1" placeholder="Say something about yourself"></textarea>`)
    $("#BioInput").val(BeforeEditDesc === "No bio yet" ? "" : BeforeEditDesc)
    $("#MyDesc").closest(".info-row").addClass("editing")
    GrowToFit($("#BioInput")[0])                  // size it to whatever is already there

    // One line of comma separated words is far less fiddly on a phone than
    // an add/remove chip editor, and it maps straight onto the array.
    $("#MyTags").removeClass("empty").html(
        `<input id="TagsInput" placeholder="games, music, cats">` +
        `<div class="edit-hint">Separate them with commas \u2014 your feed is built from these</div>`
    )
    $("#TagsInput").val(BeforeEditTags.join(", "))
    $("#MyTags").closest(".info-row").addClass("editing")

    // The picture turns into a button while editing. Nothing is bound to
    // #ChangePicture - that click is yours to write.
    $("#PageProfile .avatar").addClass("editing").append(
        `<button id="ChangePicture" type="button" aria-label="Change picture">` +
            `<svg viewBox="0 0 24 24" fill="currentColor">` +
                `<path d="M9 2L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3.17L15 2H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>` +
            `</svg>` +
        `</button>`
    )
    $("#LogOut").remove()
    $("#EditProfile").remove()
    $("#BottomElements").append(
        "<div style='display: flex' id='ProfileEditDiv'>" +
        `<button id="SaveProfile">${t("save")}</button>` +
        `<button id="CancelSaveProfile">${t("cancel")}</button>` +
        "</div>"
    )
}
function StaticProfile() {
    $("#ProfileEditDiv").remove()
    $("#EditProfile").remove()
    $("#LogOut").remove()
    $("#BottomElements").append(
        "<button class=\"action-row\" id=\"EditProfile\">\n" +
        `<span class="info-icon">&#9998;</span> ${t("editProfile")}\n` +
        "</button>" +
        "<button class=\"action-row danger\" id=\"LogOut\">\n" +
        `<span class="info-icon">&#9099;</span> ${t("logOut")}\n` +
        "</button>"
    )
    $("#MyDesc").closest(".info-row").removeClass("editing")
    $("#MyDesc").text(BeforeEditDesc)
    $("#MyDesc").toggleClass("empty", BeforeEditDesc === "No bio yet" || BeforeEditDesc === "")
    $("#MyTags").closest(".info-row").removeClass("editing")
    DrawTags(BeforeEditTags)
    $("#ChangePicture").remove()
    $("#PageProfile .avatar").removeClass("editing")
}
$("body").on("click", "#CancelSaveProfile", function () {
    StaticProfile()
})
$("body").on("click", "#SaveProfile", async function () {
    let NewDesc = $("#BioInput").val()
    // "Games, , MUSIC " -> ["games", "music"]
    let NewTags = $("#TagsInput").val()
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(t => t !== "")
    console.log(NewDesc, NewTags)
    try {
        const response = await fetch(link + "/change-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({description: NewDesc, tags: NewTags, banned: false, index: myIndex})
        });

        // The server says which outcome it was through the status code
        if (response.status === 200) {
            await showMyInfo()
            MessageBubble("Edited")
        }
        else if (response.status === 201) {
            OpenPopup("&#128683;", `Something is wrong, somehow, your account doesn't exists`);
        }
        console.log(response);
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
    }
})

//| ===== SEARCH ===== |\\
function Search() {
    let CurrentText = $("#SearchInput").val().trim().toLowerCase()
    let CheckedVerified = $("#IsVerified").is(":checked")
    let CheckedBanned = $("#IsBanned").is(":checked")

    // Nothing typed — back to the empty state instead of listing everyone
    // ("".includes("") is true for every name).
    if (CurrentText === "" && !CheckedBanned && !CheckedVerified) {
        $("#SearchResults").html(
            `<div class="search-empty"><span class="big">&#128101;</span>${t("startTyping")}</div>`)
        return
    }

    let cards = ""
    for (let i = 0; i < UsernamesForSearch.length; i++) {
        let name = UsernamesForSearch[i]
        if (!name.toLowerCase().includes(CurrentText)) continue

        let isBanned = BannedForSearch[i] === true
        let isVerified = LevelsForSearch[i] === "verified"
        let realIndex = IndexesForSearch[i]
        if (CheckedVerified && !isVerified) continue
        if (CheckedBanned && !isBanned) continue

        cards +=
            `<button class="account-card${isBanned ? " banned" : ""}${isVerified ? " is-verified" : ""}" data-index="${realIndex}">` +
            `<div class="avatar">` +
            `<img src="${PictureOf(realIndex)}" alt="">` +
            `</div>` +
            `<span class="name-row">` +
            `<span class="name">${name}</span>` +
            `<svg class="verified-tick" viewBox="0 0 24 24" fill="currentColor">` +
            `<path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z"/>` +
            `</svg>` +
            `</span>` +
            `<span class="at">@${name}</span>` +
            `<span class="banned-tag">Banned</span>` +
            `</button>`
    }

    if (cards === "") {
        $("#SearchResults").html(
            `<div class="search-empty"><span class="big">&#128533;</span>${t("nobodyFiltered")}</div>`)
        return
    }
    $("#SearchResults").html(`<div class="account-grid">${cards}</div>`)
}
$("#SearchInput").on("input", function () {
    Search()
})
$("#IsVerified").on("input", function () {
    Search()
})
$("#IsBanned").on("input", function () {
    Search()
})
//| ======= POSTING ====== |\\

$("#ActionButton").on("click", function () {
    {
        OpenPopup("📝", "Post for your subscribers and friends", "", "",
            "<label for='PostTitle'>Title</label>" +
            "<input id='PostTitle' type='text' maxlength='60' placeholder='Give it a name'>" +
            "<label for='PostInput'>What is on your mind</label>" +
            "<textarea id='PostInput' rows='3' autocorrect='on' autofocus='autofocus' placeholder='Write your post...'></textarea>" +
            "<label for='PostTags'>Tags</label>" +
            "<input id='PostTags' type='text' placeholder='space, duck, cool'>" +
            "<p class='post-hint'>At least one tag is needed. Separate them with a comma. Spaces are removed automatically \u2014 use '-' if you want a gap.</p>" +
            "<label for='imageAttachToPost'>Attach photos, video or files <span class='optional'>(optional, up to 10)</span></label>" +
            "<input type='file' id='imageAttachToPost' multiple>" +
            "<button id='ToPostButton'>Post!</button>"
        )
    }
})
$("body").on("click", "#ToPostButton", async function () {
    const Button = $(this)
    const WasSaying = Button.text()
    let Title = $("#PostTitle").val()
    let Text = $("#PostInput").val()
    let RawTextTags = $("#PostTags").val()
    let FillingCurrentText = ""
    let Tags = []
    let MoreThan2Tag = false
    for (let i = 0; i < RawTextTags.length; i++) {
        FillingCurrentText += RawTextTags[i]
        if (RawTextTags[i] === ",") {
            MoreThan2Tag = true
            Tags.push(NoSpaceAndComa(FillingCurrentText))
            FillingCurrentText = ""
        }
    }
    Tags.push(NoSpaceAndComa(FillingCurrentText))
    console.log(Tags)
    if (Tags.length < 0 || RawTextTags.length <= 1) {
        // A pop-up is not the place to complain: OpenPopup closes this one, and their
        // title, text and chosen files go with it. A bubble leaves everything alone.
        MessageBubble(t("tagTooShort") || "Every tag needs more than one letter")
        $("#PostTags").trigger("focus")
        return
    }
    // Turned off here, after the checks that leave early - the finally below
    // only runs for what is inside the try, so switching it off any sooner
    // would leave the button dead on those paths.
    Button.prop("disabled", true).text("Posting...")
    try {
        const files = $("#imageAttachToPost")[0].files
        // Checked here too, so a 200 MB photo is refused instantly instead of
        // after the whole thing has crawled up to the server.
        for (const file of files) {
            if (file.size > MAX_IMAGE) {
                MessageBubble(`"${Escape(file.name)}" is ${(file.size / 1024 / 1024).toFixed(1)} MB ` +
                    `\u2014 too big. Pick a smaller one.`)
                return
            }
        }
        if (files.length > MAX_IMAGES) {
            MessageBubble(`Pick ${MAX_IMAGES} at the most \u2014 you chose ${files.length}.`)
            return
        }
        const data = new FormData()
        for (const file of files) data.append("image", file)
        data.append("post", JSON.stringify({                         // everything else
            index: myIndex, title: Title, text: Text, tags: Tags
        }))
        const response = await fetch(link + "/post-feed", {
            method: "POST",
            body: data
        });

        // The server says which outcome it was through the status code
        if (response.status === 200) {
            await showMyInfo()
            ClosePopup()
            MessageBubble("Posted!")
        }
        else if (response.status === 201) {
            MessageBubble("Somehow your account does not exist. Tell AstroVoid24.")
        }
        else {
            MessageBubble(await response.text())
        }
        console.log(response);
    }
    catch (e) {
        MessageBubble("Could not reach Astrogram. Nothing was posted.")
    }
    finally { Button.prop("disabled", false).text(WasSaying) }
})
//| ==== Account showing ==== |\\
// Whether I am subscribed is already in the subscribers list that came with the
// account - it does NOT need asking the server, and must never toggle anything.
function AmSubscribed(subscribers) {
    return (subscribers || []).includes(myIndex)
}

// Subscribe and Message, side by side. Neither appears on your own account.
// The message button is not wired to anything yet.
function SubscribeButton(id, isSubscribed, banned) {
    if (id === myIndex) return `<div class="its-you">${t("thisIsYou")}</div>`
    if (banned) return `<div class="its-you banned-note">${t("bannedNoSub")}</div>`
    return `<div class="account-actions">` +
               `<button class="subscribe-btn${isSubscribed ? " on" : ""}" data-index="${id}" type="button">` +
                   `${isSubscribed ? t("isSubscribed") : t("subscribe")}` +
               `</button>` +
               `<button class="message-btn" data-index="${id}" type="button">` +
                   `<svg viewBox="0 0 24 24" fill="currentColor">` +
                       `<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>` +
                   `</svg>${t("message")}` +
               `</button>` +
           `</div>`
}

function ReturnAccount(id, name, description, status, banned, subscribers, isSubscribed) {
    // verified and creator both get the blue tick; banned turns it all red
    let marks = (status === "verified" || status === "creator" ? " is-verified" : "")
              + (banned ? " banned" : "")
    return `        <div class="card profile-header${marks}">\n` +
    (banned ? "<div class='banned-banner'>&#128683; This account is banned</div>" : "") +
    `<button id='CopyAccLink' data-account-id='${id}' type='button'>Copy link</button>` +
    "<div class=\"avatar\">\n" +
    `                <img id="MyPicture" src="${PictureOf(id)}" alt="Profile picture">\n` +
    "            </div>\n" +
    "            <div class=\"profile-name-row\">\n" +
    `                <h2 class=\"profile-name\" id=\"WhoAmI\">${name}</h2>\n` +
    "                <svg class=\"verified-tick\" viewBox=\"0 0 24 24\" fill=\"currentColor\">\n" +
    "                    <path d=\"M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z\"/>\n" +
    "                </svg>\n" +
    "            </div>\n" +
    `            <p class=\"profile-status\" id=\"MyStatus\">${status}</p>\n` +
    `            <div class="sub-count">` +
        `<button class="show-subscribers" type="button" data-index="${id}">` +
            `<b>${(subscribers || []).length}</b> subscribers` +
        `</button>` +
    `</div>\n` +
    // Not wired up. The class is what the handler will look for later.
    `            ${SubscribeButton(id, isSubscribed, banned)}\n` +
    "        </div>\n" +
    "\n" +
    "        <!-- the details, each row a value with what it is underneath -->\n" +
    "        <div class=\"info-group\">\n" +
    "            <div class=\"title\">Info</div>\n" +
    "\n" +
    "            <div class=\"info-row\">\n" +
    "                <div class=\"info-icon\">&#9432;</div>\n" +
    "                <div class=\"info-text\">\n" +
    `                    <div class="info-value${description ? "" : " empty"}" id="MyDesc">${description || "No bio yet"}</div>\n` +
    "                    <div class=\"info-label\">Bio</div>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "\n" +
    "            <div class=\"info-row\">\n" +
    "                <div class=\"info-icon\">@</div>\n" +
    "                <div class=\"info-text\">\n" +
    `                    <div class=\"info-value\" id=\"MyUsername\">${name}</div>\n` +
    "                    <div class=\"info-label\">Username</div>\n" +
    "                </div>\n" +
    "            </div>\n" +
    "        </div>\n" +
    "\n" +
    "        <!-- everything this account has posted -->\n" +
    "        <div class=\"info-group\">\n" +
    "            <div class=\"title with-count\">\n" +
    "                Posts <span class=\"post-count\" id=\"PostCount\"></span>\n" +
    "            </div>\n" +
    "            <div id=\"UsersPosts\">\n" +
    "                <div class=\"no-posts\" id='LookingToProfileNoPosts'><span class=\"big\">&#128247;</span>Nothing posted yet</div>" +
    "            </div>\n" +
    "        </div>"
}
//| ======== SHOWING POSTS ======== |\\

// Keeps whatever was last loaded, so "Show all" does not have to ask again.

// "A very long sentence here" -> "A very long sentenc.."
function Shorten(text, limit) {
    text = (text || "").replace(/\s+/g, " ").trim();
    return text.length > limit ? text.slice(0, limit) + ".." : text;
}

// One post as a row. full=true leaves the text alone.
// data-post carries its position in the list held on the container.
function PostRow(post, number, full) {
    const text = full ? (post.text || "") : Shorten(post.text, PREVIEW_LENGTH);
    const title = post.title ? `<div class="row-title">${post.title}</div>` : "";
    const tags = (post.tags || []).length
        ? `<div class="tags">#${post.tags.join(" #")}</div>` : "";
    return `<div class="post-row${full ? " full" : ""}" data-post="${number - 1}">` +
               `<div class="num">${number}</div>` +
               `<div class="body">` +
                   title +
                   `<div class="snippet">${text || "<i>empty post</i>"}</div>` +
                   tags +
               `</div>` +
           `</div>`;
}
function DrawPosts(posts, into, countInto, ownerName) {
    if (countInto) { $(countInto).text(posts.length ? posts.length : ""); }

    $(into).addClass("post-holder").data("posts", posts).data("owner", ownerName || "");

    if (!posts.length) {
        $(into).html("<div class='no-posts'><span class='big'>&#128247;</span>Nothing posted yet</div>");
        return;
    }

    let rows = "";
    for (let i = 0; i < posts.length && i < PREVIEW_COUNT; i++) {
        rows += PostRow(posts[i], i + 1, false);
    }
    if (posts.length > PREVIEW_COUNT) {
        rows += `<button class="show-all-row" id="ShowAllPosts">` +
                `Show all ${posts.length} posts</button>`;
    }
    $(into).html(rows);
}

async function ShowFullPost(post, who, backTo) {
    if (!post) return;
    who = who || "";

    const tags = (post.tags || []).length
        ? `<div class="post-full-tags">#${post.tags.join(" #")}</div>` : "";
    const picture = ImageStack(post.imagePath, "post-full-image");

    OpenPopup("",
        post.title ? post.title : (who ? who : "Post"),
        who && post.title ? who : "", "",
        `<div class="post-full">` +
            `<div class="post-full-text" translate="no">${post.text || "<i>empty post</i>"}</div>` +
            picture +
            FileStack(post.files) +
            tags +
            `<div class="post-full-bar">${LikeButtons(post)}${PostMenu(post)}</div>` +
        `</div>`,
        62, 82);
    // Opened from somebody's account? Then the arrow goes back to it,
    // rather than the X throwing the whole thing away.
    if (backTo !== undefined) AddBackButton(() => ShowAccountBySearch(backTo));
}

$("body").on("click", ".post-row", async function () {
    // walk up to whichever list this row belongs to
    const holder = $(this).closest(".post-holder");
    const list = holder.data("posts") || [];
    await ShowFullPost(list[$(this).data("post")],
                       holder.data("owner"),
                       holder.data("ownerId"));
});

// Every post, in its own pop-up, nothing shortened.
$("body").on("click", "#ShowAllPosts", function () {
    const holder = $(this).closest(".post-holder");
    const list = holder.data("posts") || [];
    const who = holder.data("owner") || "";

    const backTo = holder.data("ownerId");

    // Drawn as feed cards, so they read exactly like the Feed page does.
    let rows = "";
    for (const post of list) {
        rows += FeedCard(post);
    }
    OpenPopup("&#128221;", who ? who + "'s posts" : "All posts",
        `${list.length} in total`, "",
        `<div id="AllPostsList" class="post-holder">${rows}</div>`,
        62, 82);
    $("#AllPostsList").data("posts", list).data("owner", who);
    ClampLongPosts();                    // long ones get the fade and READ MORE
    if (backTo !== undefined) AddBackButton(() => ShowAccountBySearch(backTo));
});

async function ShowAccountBySearch(id) {
    // Up before the fetch, not after. Opened afterwards, the tap that asked for
    // it has nowhere to land, and half a second later the account appears right
    // under a finger that is still down - straight onto Subscribe.
    OpenPopup("", "", "", "", `<div class="people-list">${LOADING}</div>`, 62, 82)
    try {
        const response = await fetch(link + "/user-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({index: id})
        })
        const UserPosts = await fetch(link + "/user-posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({index: id})
        })

        // The server says which outcome it was through the status code
        if (response.status === 200) {
            let CurrentUser = await response.json()
            console.log(CurrentUser)
            OpenPopup("", "", "", "",
                ReturnAccount(id, CurrentUser.Username, CurrentUser.description,
                              CurrentUser.level, CurrentUser.banned, CurrentUser.subscribers,
                          AmSubscribed(CurrentUser.subscribers)),
                62, 82
            )
            if (UserPosts.status === 200) {
                let PostKey = await UserPosts.json()
                DrawPosts(PostKey.posts || [], "#UsersPosts", "#PostCount", CurrentUser.Username)
            } else {
                DrawPosts([], "#UsersPosts", "#PostCount", CurrentUser.Username)
            }
            // the arrow on any pop-up opened from here comes back to this account
            $("#UsersPosts").data("ownerId", id)
            console.log(CurrentUser)
        }
        else if (response.status === 404) {
            OpenPopup("&#128246;", "User doesn't exists", "", "bad");
        }
        else {
            OpenPopup("&#128683;", "Could not open that account", await response.text(), "bad")
        }
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
        console.log(e)
    }
}
$("body").on("click", ".account-card", async function () {
    await ShowAccountBySearch($(this).data("index"))
})
$("body").on("click", "#CopyAccLink", async function () {
    let id = $(this).data("account-id")
    let fullUrl = currentLink + `#account=${id}`
    CopyText(fullUrl).then(function (ok) {
        if (!ok) return
        let currentText = $("#CopyAccLink").text()
        $("#CopyAccLink").text("Copied!")
        setTimeout(function() {
            $("#CopyAccLink").text(currentText)
        }, 1000)
    });
})

//| ====== Liking ====== |\\

$("body").on("click", ".feed-act", async function () {
    const button = $(this)
    const id     = Number(button.data("id"))
    const action = button.hasClass("like") ? "like" : "dislike"

    try {
        const response = await fetch(link + "/like-dislike-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ index: myIndex, id: id, action: action })
        });
        if (response.status !== 200 && response.status !== 201) return

        // 200 the server added it, 201 the server took it back
        const added = response.status === 200

        // The same post can be in the feed more than once, so every copy of
        // this button has to change, not only the one that was pressed.
        // remember it, so a pop-up opened later shows the same thing
        const mine  = action === "like" ? MyLikes : MyDislikes
        const other = action === "like" ? MyDislikes : MyLikes
        if (added) { mine.add(id); other.delete(id) } else { mine.delete(id) }

        const twins = $(`.feed-act.${action}[data-id="${id}"]`)
        twins.toggleClass("on", added)

        // The server drops the opposite one when this is added, so the
        // other button has to let go of its fill as well.
        if (added) {
            const opposite = action === "like" ? "dislike" : "like"
            const others = $(`.feed-act.${opposite}[data-id="${id}"]`)
            if (opposite === "like" && others.hasClass("on")) {
                const now = (LikeCounts.get(id) || 0) - 1
                LikeCounts.set(id, now > 0 ? now : 0)
                others.find(".like-count").text(now > 0 ? now : "")
            }
            others.removeClass("on")
        }

        if (action === "like") {
            const now = (LikeCounts.get(id) || 0) + (added ? 1 : -1)
            twins.find(".like-count").text(now > 0 ? now : "")   // empty, so the CSS hides a zero
        }
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
    }
})

//| ====== Subscribing ====== |\\
// The only place that talks to /subscribe. Pressing it flips the state, so
// nothing else may call it - reading the state is AmSubscribed()'s job.
$("body").on("click", ".subscribe-btn", async function () {
    const button = $(this)
    const UserId = Number(button.data("index"))
    if (UserId === myIndex) return

    button.prop("disabled", true)          // one press at a time, or the two cross
    try {
        const response = await fetch(link + "/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: myIndex, id2: UserId })
        })
        if (response.status !== 200 && response.status !== 201) {
            OpenPopup("&#128683;", "Could not subscribe", await response.text(), "bad")
            return
        }
        // 200 the server added me, 201 it took me off
        const nowSubscribed = response.status === 200
        button.toggleClass("on", nowSubscribed)
              .text(nowSubscribed ? "Subscribed" : "Subscribe")

        // the count sits right above the button, in the same header
        const box = button.closest(".profile-header").find(".sub-count b").first()
        const now = (Number(box.text()) || 0) + (nowSubscribed ? 1 : -1)
        box.text(now > 0 ? now : 0)
    }
    catch (e) {
        OpenPopup("&#128246;", "Cannot reach Astrogram",
            "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad");
    }
    finally { button.prop("disabled", false) }
})

//| ====== Generate More Posts ====== |\\
let CurrentPost
const Seen = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (e.isIntersecting) {
            CurrentPost = Number(e.target.dataset.id)
            console.log(`Just saw the post with id ${CurrentPost}`)
        }
    }
}, { threshold: 0.6 })
// observe() only knows the elements it was handed, so every new batch has to
// be handed over too. The class marks the ones already being watched.
function WatchNewPosts() {
    $(".feed-post").not(".watched").addClass("watched").each(function () {
        Seen.observe(this)
    })
}
let LoadingMore = false
const EndWatcher = new IntersectionObserver(async function (entries) {
    if (!entries[0].isIntersecting) return
    if (LoadingMore) return          // it stays on screen while fetching, so it fires again
    LoadingMore = true
    await LoadMoreFeed()
    LoadingMore = false
})
EndWatcher.observe(document.getElementById("FeedEnd"))

await LoadMoreFeed()
//| === Start up === |\\
ApplyText()
PageUpdate("Feed")
//| ===== Post Editing and deleting ===== |\\
// The post leaves the page at once and the server is only told ten seconds
// later, so Cancel can put it back without anything having happened.
let DeletingPostId = null
let CountdownInterval = null
let DeletePostAfter10Sec = null
let DeleteBubble = null
let RemovedCards = []        // [{card, gap}] - the cards and where they were

// detach() and not remove(): detach keeps the element alive so it can go
// straight back, and the gap holds its exact place in the list.
function TakePostsOff(id) {
    RemovedCards = []
    $(`.feed-post[data-id="${id}"]`).each(function () {
        const gap = $("<div class='post-gap'></div>")
        $(this).after(gap)
        RemovedCards.push({ card: $(this).detach().removeClass("going"), gap: gap })
    })
}
function PutPostsBack() {
    for (const item of RemovedCards) item.gap.replaceWith(item.card)
    RemovedCards = []
}
function ForgetPosts() {          // it really is deleted, drop the placeholders
    $(".post-gap").remove()
    RemovedCards = []
}
function StopCountdown() {
    clearTimeout(DeletePostAfter10Sec)
    clearInterval(CountdownInterval)
    DeletePostAfter10Sec = null
    CountdownInterval = null
    if (DeleteBubble) { DeleteBubble.remove(); DeleteBubble = null }
}

$("body").on("click", ".post-delete", function () {
    // a second delete while one is counting down would lose the first one's cards
    if (DeletePostAfter10Sec) { StopCountdown(); PutPostsBack() }

    const id = $(this).data("id")
    DeletingPostId = id
    TakePostsOff(id)

    let Countdown = 10
    CloseBubbles()
    DeleteBubble = MessageBubble("Deleting your post in",
        `<p class="delete-countdown"><b id="DeleteCountdown">10</b> seconds</p>` +
        `<button id="DeletePostCancel">Cancel</button>`,
        "", "", false
    )

    // 1000, or with no delay at all it runs at screen speed and is past zero
    // before you have read it
    CountdownInterval = setInterval(function () {
        Countdown--
        $("#DeleteCountdown").text(Countdown > 0 ? Countdown : 0)
    }, 1000)

    DeletePostAfter10Sec = setTimeout(async function () {
        StopCountdown()
        try {
            const response = await fetch(link + "/delete-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({id: id, index: myIndex})
            })
            if (response.status !== 200) {
                PutPostsBack()          // it is still there, so show it again
                OpenPopup("&#128683;", "Could not delete", await response.text(), "bad")
                return
            }
            ForgetPosts()
            MessageBubble(t("deletedPost"))
        }
        catch (e) {
            PutPostsBack()
            OpenPopup("&#128246;", "Cannot reach Astrogram",
                "The server is not answering.<br>Is it running?  <b>bun --watch Astrogram-Server.js</b>", "bad")
        }
    }, 10000)
})

$("body").on("click", "#DeletePostCancel", function () {
    StopCountdown()             // before the ten seconds are up, so nothing was sent
    PutPostsBack()
    MessageBubble(t("keptPost"))
})

//| ====== Report ====== |\\

$("body").on("click", ".post-report", async function () {
    ReportingPostId = $(this).data("id")
    OpenPopup("🚩", "Reporting this post", "Reason:", "",
        "<button class='report-reason' data-reason='Nudity'>Nudity or Sexual Content</button>" +
        "<button class='report-reason' data-reason='Violence'>Violent information</button>" +
        "<button class='report-reason' data-reason='HardSwearing'>Too much Swearing and Insulting</button>" +
        "<button class='report-reason' data-reason='Spam'>Spam or Scams</button>" +
        "<button class='report-reason' data-reason='HateSpeech'>Hate Speech or Discrimination</button>" +
        "<button class='report-reason' data-reason='Harassment'>Harassment or Bullying</button>" +
        "<button class='report-reason' data-reason='Impersonation'>Fake Account or Impersonation</button>" +
        "<button class='report-reason' data-reason='SelfHarm'>Suicide or Self-Harm</button>" +
        "<button class='report-reason' data-reason='FalseInfo'>False Information</button>" +
        "<button class='report-reason' data-reason='IntellectualProperty'>Intellectual Property Violation</button>" +
        "<button class='report-reason' data-reason='Other'>Something else</button>" +
        "<div id='OtherReasonBox'>" +
            "<label for='OtherReason'>Say what is wrong with it</label>" +
            "<input id='OtherReason' type='text' maxlength='80' placeholder='In your own words'>" +
            "<button id='SendOtherReason'>Report</button>" +
        "</div>"
    );

})

//| ===== My Subscribers ===== |\\

$("body").on("click", "#ShowSubscribers", function () {

})   // who follows me
$("body").on("click", "#ShowSubscribed",  function () {

})