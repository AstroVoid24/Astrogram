//| ================= WHERE THE DATA LIVES =================
// Render's free tier wipes the disk every time the service sleeps, so the two
// lists live in Upstash Redis when its two env vars are set, and in the json
// files next to this one when they are not (which is how it runs on your Mac).
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN)

async function RedisGet(key) {
    const r = await fetch(`${REDIS_URL}/get/${key}`, {
        headers: {Authorization: `Bearer ${REDIS_TOKEN}`}
    })
    if (!r.ok) throw new Error(`Redis get ${key}: ${r.status}`)
    // Upstash answers {result: "<the string we stored>"} or {result: null}
    const {result} = await r.json()
    return result == null ? null : JSON.parse(result)
}

async function RedisSet(key, value) {
    const r = await fetch(`${REDIS_URL}/set/${key}`, {
        method: "POST",
        headers: {Authorization: `Bearer ${REDIS_TOKEN}`},
        body: JSON.stringify(value)
    })
    if (!r.ok) throw new Error(`Redis set ${key}: ${r.status}`)
}

// ---- files, for running here ----
async function ReadBytes(path) {
    try {
        const f = Bun.file(path)
        return await f.exists() ? new Uint8Array(await f.arrayBuffer()) : null
    } catch (e) { return null }
}
async function WriteBytes(path, bytes) { return await Bun.write(path, bytes) }
async function RemoveFile(path) { try { await Bun.file(path).delete() } catch (e) { } }

//| ---- the two lists ----
async function LoadJson(key, path) {
    if (USE_REDIS) {
        const got = await RedisGet(key)
        if (got) return got
        throw new Error("nothing saved yet")     // the catch loads the defaults
    }
    const bytes = await ReadBytes(path)
    if (!bytes) throw new Error("no file")
    return JSON.parse(new TextDecoder().decode(bytes))
}
async function SaveJson(key, path, value) {
    if (USE_REDIS) return await RedisSet(key, value)
    return await WriteBytes(path, new TextEncoder().encode(JSON.stringify(value, null, 2)))
}

//| ---- pictures ----
// Redis holds text, so a picture goes in as base64 under a key of its own.
function ToBase64(bytes) {
    let out = ""
    for (const b of bytes) out += String.fromCharCode(b)
    return btoa(out)
}
function FromBase64(text) {
    const raw = atob(text)
    const out = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
    return out
}
async function SaveImage(path, bytes) {
    if (!USE_REDIS) return await WriteBytes(path, bytes)
    return await RedisSet("img:" + path.split("/").pop(), ToBase64(bytes))
}
async function ReadImage(path) {
    if (!USE_REDIS) return await ReadBytes(path)
    const text = await RedisGet("img:" + path.split("/").pop())
    return text ? FromBase64(text) : null
}
async function RemoveImage(path) {
    if (!USE_REDIS) return await RemoveFile(path)
    return await RedisSet("img:" + path.split("/").pop(), "")
}

function PictureType(name) {
    return TYPES[name.split(".").pop().toLowerCase()] || "application/octet-stream"
}

const TYPES = {html: "text/html;charset=utf-8", css: "text/css;charset=utf-8",
    js: "text/javascript;charset=utf-8", json: "application/json",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
    gif: "image/gif", svg: "image/svg+xml", ico: "image/x-icon",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", ogv: "video/ogg"}

// what a post may carry, and therefore what the picture routes may hand out
const PICTURE_TYPES = ["png", "jpg", "jpeg", "webp", "gif", "svg", "ico",
                       "mp4", "webm", "mov", "ogv"]
// The files are beside the server now, so a picture route pointed at anything
// else would happily hand out Users.json or this very file.
function IsPicture(name) {
    return PICTURE_TYPES.includes(name.split(".").pop().toLowerCase())
}

async function ServeFile(path, headers = {}) {
    const bytes = await ReadBytes(path)
    if (!bytes) return new Response("Not found", {status: 404, headers})
    const ext = path.split(".").pop().toLowerCase()
    return new Response(bytes, {headers: {...headers, "Content-Type": TYPES[ext] || "application/octet-stream"}})
}

let Users = [
    {
        Username: "Admin",
        Password: "xddcc",
        level: "admin",
        posts: [],
        subscribers: [],
        messages: [],
        tags: ["astrovoid24", "admin"]
    },
    {
        Username: "AstroVoid24",
        Password: "I'm CEO",
        description: "I'm the CEO of the Astrogram! And the creator :D" ,
        banned: false,
        email: "saidumar.holmeer@gmail.com",
        level: "creator",
        posts: [0],
        subscribers: [2,3,4,5],
        tags: ["cosmos", "astro", "cats", "elon-musk", "space", "ducks", "astrogram"]
    },
    {
        Username: "Dream130909",
        Password: "Dream130909 is the best",
        description: "Fnaf fan! I danced with golden feddy",
        banned: false,
        email: "jamesxplayer4@gmail.com",
        level: "verified",
        posts: [],
        subscribers: [],
        messages: [],
        tags: ["astrovoid24", "fnaf", "freddy", "fazbear"]
    },
    {
        Username: "Rizo2424",
        Password: "Rizo top 3000",
        description: "I play robloh, very cool game",
        banned: false,
        email: "saidumarchik.h@gmail.com",
        level: "verified", posts: [],
        subscribers: [],
        messages: [],
        tags: ["astrovoid24", "rizo", "best", "roblox"]
    },
    {
        Username: 'Azamatjon Polvon',
        Password: 'Bitta$Parolda&endi',
        description: '',
        banned: false,
        email: 'saidumar.holmeer@gmail.com',
        level: 'verified',
        posts: [],
        subscribers: [],
        messages: [],
        tags: ["astrovoid24"]
    },
    {
        Username: 'Pickachu Pika Pika',
        Password: 'PikaPika',
        description: 'I love pikachuuuuu! Pokemon fan!',
        banned: false,
        email: 'saidumar.holmeer@gmail.com',
        level: 'user',
        posts: [],
        subscribers: [],
        messages: [],
        tags: ["pokemon", "pikachu", "anime-manga"]
    },
    {
        Username: "Anti-Astrogram",
        Password: "Astrogram is Trash",
        description: "LET'S PROTEST THE ASTROGRAM",
        banned: true,
        email: "Aaaa@gmail.com",
        level: "user",
        posts: [],
        subscribers: [],
        messages: [],
        tags: ["protest", "anti-astrogram", "hate-astrogram", "astrogram-bugs"]
    },
]
class User {
    constructor(name, pass, email) {
        this.Username = name
        this.Password = pass
        this.description = ""
        this.banned = false
        this.email = email
        this.level = "user"
        this.posts = []
        this.subscribers = []
        this.tags = ["astrovoid24"]
        this.picturePath = ""       // "" means the default picture
        this.banReason = null       // {top, count, others} once reports ban them
        this.messages = []
    }
    ban(id, reason) {
        this.banned = true
        Users[id].banReason = reason
        ClearSubs(id)
        saveData()
    }
}
let PostsFeed = [
    {title: "The very first post",
    text: "[Test Post] Hello!" +
            " I'm AstroVoid24, nice to meet you! Of course, you know who I am! " +
            "The CEO and the creator of this app! " +
            "And this is the first post and this message is immortal! Even if the server's data would delete, but this won't happen in a 1000 years! " +
            "Here is a random duck image: ",
    imagePath: [],
    owner: 1,
    tags: ["first", "astrovoid24", "astrogram", "cool", "interesting", "astro", "duck"],
    like: [],
    dislike: [],
    reports: {}
    }
]
class PostFeed {
    constructor(text, imagePath = [], owner, tags = [], title = "", files = []) {
        this.title = title
        this.text = text
        this.imagePath = imagePath      // URLs like /post-images/p-3-0.png, [] when none
        this.files = files              // anything else: [{url, name, size}]
        this.owner = owner
        this.tags = tags
        this.like = []          // who liked it
        this.dislike = []       // who disliked it, never shown as a number
        this.reports = {}       // who reported it and why - {"3": "inappropriate"}
    }
}
class Message {
    constructor(init, who, to, seen = false, id) {
        this.init = init
        this.who = who
        this.to = to
        this.time = Date.now()
        this.seen = seen
        this.id = id
    }
}
// Everything sits next to the server now, no folders
const UsersPath = "./Users.json"
const PostsPath = "./Posts.json"
const database = "."
const POST_IMAGES = "./"      // what people attach to a post, named p-...
const USER_IMAGES = "./"      // profile pictures, named u-...
// A picture is stored as base64 text in Redis and Upstash will not take a big
// one, so the cap drops right down there. Shrink pictures in the browser.
const MAX_IMAGE = USE_REDIS ? 400 * 1024 : 50 * 1024 * 1024
const MAX_IMAGES = 10                               // per post
const DOOM_MIN_MS = 3000                // three seconds
const DOOM_MAX_MS = 60 * 60 * 1000      // one hour
//| ====== WHAT A USERNAME MAY NOT BE ====== |\\
const NAME_MIN = 1
const NAME_MAX = 20

// Refused wherever they appear in the name. Kept deliberately short - a long
// list catches innocent words, and every extra entry is another way to lock
// somebody out of their own account.
const BAD_WORDS = [
    "fuck", "shit", "bitch", "cunt", "whore", "slut", "rape", "nazi", "hitler",
    "nigger", "nigga", "faggot", "retard", "pedo", "porn", "dick", "penis",
    "vagina", "boob", "sex",
    // russian
    "blyat", "blyad", "suka", "pizda", "hui", "huy", "ebat", "mudak",
    "блять", "сука", "пизда", "хуй", "ебат", "мудак", "секс", "порно",
    // uzbek
    "kot", "jala", "amcik", "jalab"
]

// Names nobody but the app may have
const RESERVED = [
    "admin", "administrator", "moderator", "mod", "astrogram", "support",
    "system", "root", "owner", "staff", "official", "help"
]

// The same letters in disguise: @ for a, 0 for o, 1 for i, and so on. Spaces,
// dots and underscores go too, so "a d m i n" and "a.d.m.i.n" are seen for what
// they are.
function PlainName(name) {
    return (name || "").toLowerCase()
        .replace(/[@4]/g, "a").replace(/[1!|]/g, "i").replace(/0/g, "o")
        .replace(/[$5]/g, "s").replace(/3/g, "e").replace(/7/g, "t")
        .replace(/[^a-zа-яё0-9]/g, "")
}

// null when the name is fine, otherwise what is wrong with it
function NameProblem(name) {
    const trimmed = (name || "").trim()
    if (trimmed.length < NAME_MIN) return "A username cannot be empty"
    if (trimmed.length > NAME_MAX) return `A username can be ${NAME_MAX} letters at most`

    // Printable ASCII only: 32 (space) to 126 (~). That is every letter, digit
    // and symbol on an English keyboard. Anything above 126 is refused - accents,
    // Cyrillic, emoji, and the invisible characters people hide in names.
    for (const ch of trimmed) {
        const code = ch.codePointAt(0)
        if (code < 32 || code > 126) {
            return `"${ch}" cannot be used. English letters, numbers and symbols only.`
        }
    }

    const plain = PlainName(trimmed)

    for (const word of BAD_WORDS) {
        if (plain.includes(word)) return "That username is not allowed"
    }
    // exact match only. As a substring it would refuse "Adminah" or "Modest".
    for (const word of RESERVED) {
        if (plain === word) return `"${trimmed}" is reserved`
    }
    return null
}

const REPORT_PRESETS = ["Nudity", "Violence", "HardSwearing", "Spam", "HateSpeech",
                        "Harassment", "Impersonation", "SelfHarm", "FalseInfo",
                        "IntellectualProperty"]
const REPORT_LIMIT = 50                              // this many reports and it is flagged
try {
    Users = await LoadJson("users", UsersPath)
    console.log("Found the users file, loaded users")
    PostsFeed = await LoadJson("posts", PostsPath)
    console.log("Found the posts file, loaded posts")
}
catch (e) {
    console.log("Could not find the users or the posts file, default users or posts loaded and saved")
    saveData()
}
// Nobody stays subscribed to a banned account, and a banned account follows
// nobody. Called from every place that bans, so none of them can forget.
function ClearSubs(index) {
    if (!Users[index]) return
    Users[index].subscribers = []
    for (const other of Users) {
        if (other.subscribers) other.subscribers = other.subscribers.filter(i => i !== index)
    }
}

let NextMessageId = 0

function RecoverMessageId() {
    for (const u of Users) {
        for (const m of (u.messages || [])) {
            if (Number(m.id) >= NextMessageId) NextMessageId = Number(m.id) + 1
        }
    }
    console.log("Next message id is", NextMessageId)
}
// Below the definition, not up in the try. Called from there it hit the dead
// zone of the let above, threw, and the catch reported the files as missing.
RecoverMessageId()

// Every write is chained onto the last one, so two saves cannot interleave and
// Refresh() can wait for whatever is still in the air. Writing to Redis takes a
// round trip, and the 22 places that call this do not await it - so without the
// chain the next request would read Redis back before the write had landed and
// quietly undo it.
let Saving = Promise.resolve()
function saveData() {
    Saving = Saving
        .then(async () => {
            await SaveJson("users", UsersPath, Users)
            await SaveJson("posts", PostsPath, PostsFeed)
        })
        .catch(e => console.log("Could not save:", e.message))
    return Saving
}
let EmailVerifiers = []
const CODE_LIFETIME = ToMinutes(10)   // codes stop working after 10 minutes
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

//| ======== SENDING EMAIL (Resend) ======== |\\
const RESEND_KEY = process.env.RESEND_KEY;
// ==== THE ONE SWITCH FOR EMAIL ====
const EMAIL_ON = false

const MAIL_FROM = "Astrogram <onboarding@resend.dev>";   // works with no domain of your own

// Sends one email. Returns true if Resend accepted it.
async function sendEmail(to, subject, html) {
    if (!EMAIL_ON) {
        console.log("EMAIL_ON is false — nothing sent");
        return false;
    }
    if (!RESEND_KEY) {
        console.log("No RESEND_KEY in .env — email not sent");
        return false;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ from: MAIL_FROM, to: to, subject: subject, html: html })
    });

    if (response.ok) {
        console.log(`Email sent to ${to}`);
        return true;
    }

    console.log(`Email failed (${response.status}):`, await response.text());
    return false;
}

// A 6-digit code, always padded so it is never shown as "4821"
function makeCode() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}
function ToMinutes(min) {
    return min * 60 * 1000
}
async function BunEmailSend(body, name = "", IsSignUp = false) {
    let mail = body.mail
    if (!mail && name !== "") {
        // The property is Username, not name — e.name is undefined on every user
        let User = Users.find(e => e.Username === name)
        if (!User) {
            return new Response("User not found", {headers: corsHeaders, status: 401})
        }
        mail = User.email
    }
    if (!mail) {
        return new Response("No email given", {headers: corsHeaders, status: 203})
    }

    let code = makeCode()
    let sent = await sendEmail(mail, "Your Astrogram code", verificationEmail(code))
    if (!sent) {
        return new Response("Could not send", {headers: corsHeaders, status: 500})
    }

    console.log(`the code was ${code}`)
    // One live code per account. Keyed on the address alone, a second account
    // on the same inbox would wipe out the first one's code.
    EmailVerifiers = EmailVerifiers.filter(e => !(e.email === mail && e.username === body.name))
    EmailVerifiers.push({email: mail, Code: code, madeAt: Date.now(), signup: IsSignUp, username: body.name, password: body.pass})

    return new Response("Sent!", {headers: corsHeaders, status: 200})
}
// The message people will actually receive
function verificationEmail(code) {
    return `
        <div style="background:#05051f;padding:40px 20px;font-family:Arial,Helvetica,sans-serif">
          <div style="max-width:420px;margin:0 auto;background:linear-gradient(145deg,#0a0a2e,#1a1a4a);
                      border:1px solid #4b0082;border-radius:16px;padding:34px 30px;text-align:center">
            <h1 style="margin:0 0 6px;color:#e0e0ff;font-size:28px;letter-spacing:1px">
              Astro<span style="color:#a855f7">gram</span>
            </h1>
            <p style="margin:0 0 26px;color:#8b8bb8;font-size:12px;letter-spacing:3px;
                      text-transform:uppercase">by AstroVoid24</p>
            <p style="margin:0 0 14px;color:#9aa0c0;font-size:14px">Your verification code:</p>
            <p style="margin:0 0 22px;color:#4ade80;font-size:38px;font-weight:800;
                      letter-spacing:8px;font-family:'Courier New',monospace">${code}</p>
            <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6">
              If you did not try to make an Astrogram account, you can ignore this email.
            </p>
          </div>
        </div>`
}
// The whole upload, not one picture. Bun turns the request away before the
// route runs, so this has to allow a full set of them or the check below
// would never get a chance to say which one was too big.
const MAX_SIZE = MAX_IMAGES * MAX_IMAGE + 1024 * 1024
const routes = {
        // The route decides, not the login page. localStorage cannot be read
        // from here, so the page drops a small cookie when somebody signs in and
        // this looks for it.
        '/': async req => {
            const cookie = req.headers.get("cookie") || ""
            if (/(^|;\s*)astrogram-in=1/.test(cookie)) {
                return new Response("", {status: 302, headers: {Location: "/proceedToApp"}})
            }
            return await ServeFile("./login-signup.html")
        },
        // Plain files now, no bundler. Main.html asks for these three itself.
        '/proceedToApp':      async () => await ServeFile("./Main.html"),
        '/admin-panel.html':  async () => await ServeFile("./admin-panel.html"),
        '/Main.css':          async () => await ServeFile("./Main.css"),
        '/Main.js':           async () => await ServeFile("./Main.js"),
        // Profile pictures
        '/user-images/:file': async req => {
            const name = req.params.file.split("/").pop()
            if (!IsPicture(name)) return new Response("No", {headers: corsHeaders, status: 403})
            const bytes = await ReadImage(USER_IMAGES + name)
            if (!bytes) return new Response("No such file", {headers: corsHeaders, status: 404})
            return new Response(bytes, {headers: {...corsHeaders, "Content-Type": PictureType(name)}})
        },
        // Anything that is not a picture or a video. Always sent as a download:
        // an .html or .js served inline would run on this very origin and could
        // read whoever opened it right out of localStorage.
        '/post-file/:file': async req => {
            const name = req.params.file.split("/").pop()
            if (!name.startsWith("p-")) {
                return new Response("No", {headers: corsHeaders, status: 403})
            }
            const bytes = await ReadImage(POST_IMAGES + name)
            if (!bytes) return new Response("No such file", {headers: corsHeaders, status: 404})
            const asked = new URL(req.url).searchParams.get("name") || name
            return new Response(bytes, {headers: {...corsHeaders,
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${asked.replace(/[^\w.\- ]/g, "_")}"`,
                "X-Content-Type-Options": "nosniff"}})
        },
        // Pictures people attached to their posts
        '/post-images/:file': async req => {
            const name = req.params.file.split("/").pop()
            if (!IsPicture(name)) return new Response("No", {headers: corsHeaders, status: 403})
            const bytes = await ReadImage(POST_IMAGES + name)
            if (!bytes) return new Response("No such file", {headers: corsHeaders, status: 404})
            return new Response(bytes, {headers: {...corsHeaders, "Content-Type": PictureType(name)}})
        },
        '/resources/:file': async req => {
            const name = req.params.file.split("/").pop()      // basename, no walking out with ../
            if (!IsPicture(name)) return new Response("No", {headers: corsHeaders, status: 403})
            return await ServeFile("./" + name, corsHeaders)
        },
        '/api/logging-in': {
            POST: async req => {
                let body = await req.json()
                let AskedUsername = body.name
                console.log("Request logging in", AskedUsername)
                let AskedPassword = body.pass
                let Index = Users.findIndex(e => e.Username === AskedUsername && e.Password === AskedPassword)
                if (Index !== -1) {
                    if (Users[Index].banned) {
                        // the reason travels with it, so the page can say why
                        return Response.json({banned: true, reason: Users[Index].banReason || null},
                            {headers: corsHeaders, status: 203})
                    }
                    else {
                        // Hand back where they sit in Users so the client can ask
                        // for their details later without searching by name.
                        // admin tells the page to go to the panel instead of the app.
                        return Response.json({
                            index: Index,
                            level: Users[Index].level || "user",
                            admin: Users[Index].level === "admin",
                            verify: EMAIL_ON        // false = the page skips the code step
                        }, {headers: corsHeaders, status: 200})
                    }
                }
                else {
                    return new Response("User not found", {headers: corsHeaders, status: 401})
                }
            }
        },
        '/api/sign-up': {
            POST: async req => {
                let body = await req.json()
                // The page checks these too, but it is the only thing that did -
                // with the mail switched off nothing else stood in the way, so an
                // empty username walked straight through and made an empty account.
                let Name = (body.name || "").trim()
                let Pass = (body.pass || "").trim()
                let Mail = (body.mail || "").trim()
                if (!Name || !Pass) {
                    return new Response("A username and a password are needed",
                        {headers: corsHeaders, status: 204})
                }
                if (EMAIL_ON && !Mail) {
                    return new Response("An email is needed", {headers: corsHeaders, status: 204})
                }
                const problem = NameProblem(Name)
                if (problem) {
                    console.log(`Refused the username ${Name!==""?JSON.stringify(Name):"(empty)"}: ${problem}`)
                    return new Response(problem, {headers: corsHeaders, status: 205})
                }
                let Exists = Users.find(e => e.Username === Name)
                if (Exists) {
                    return new Response("It exists", {headers: corsHeaders, status: 203})
                }
                else if (!EMAIL_ON) {
                    // No code to wait for, so the account is made right here -
                    // this is what /verify-email would have done afterwards.
                    let NewUser = new User(Name, Pass, Mail)
                    Users.push(NewUser)
                    saveData()
                    console.log(`New account created without a code: ${NewUser.Username} (index ${Users.length - 1})`)
                    return Response.json({index: Users.length - 1, verify: false},
                        {headers: corsHeaders, status: 200})
                }
                else {
                    return await BunEmailSend(body, "", true)
                }
            }
        },
        '/api/verify-email': {
            POST: async req => {
                let body = await req.json()
                let mail = body.mail
                let givenCode = body.code

                // Logging in never asks for an address, so the page sends the
                // username instead and the address is looked up here.
                if (!mail && body.name) {
                    let User = Users.find(e => e.Username === body.name)
                    if (!User) {
                        return new Response("User not found", {headers: corsHeaders, status: 401})
                    }
                    mail = User.email
                }

                if (!mail || givenCode === undefined || givenCode === null || givenCode === "") {
                    return new Response("Nothing to check", {headers: corsHeaders, status: 400})
                }

                let Correct = EmailVerifiers.find(e =>
                    e.email === mail && String(e.Code) === String(givenCode) &&
                    // a shared inbox means the address alone does not say who this is
                    (!body.name || e.username === body.name))

                if (!Correct) {
                    return new Response("Code was incorrect", {headers: corsHeaders, status: 201})
                }

                if (Date.now() - Correct.madeAt > CODE_LIFETIME) {
                    EmailVerifiers = EmailVerifiers.filter(e => e !== Correct)
                    return new Response("Code expired", {headers: corsHeaders, status: 202})
                }

                let Index
                if (Correct.signup) {
                    // lowercase username — that is the name it was stored under
                    let NewUser = new User(Correct.username, Correct.password, Correct.email)
                    Users.push(NewUser)
                    Index = Users.length - 1        // it went on the end
                    console.log(`New account created: ${NewUser.Username} (index ${Index})`)
                    saveData()
                } else {
                    // Several accounts can share one address, so findIndex on the
                    // email always handed back whoever was first in the list. The
                    // username that asked for the code is the one logging in.
                    Index = Correct.username
                        ? Users.findIndex(e => e.Username === Correct.username)
                        : Users.findIndex(e => e.email === mail)
                    if (Index === -1) {
                        return new Response("User not found", {headers: corsHeaders, status: 401})
                    }
                }

                EmailVerifiers = EmailVerifiers.filter(e => e !== Correct)
                // The index goes back too, so the client can store it
                return Response.json({index: Index}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/login-verify': {
            POST: async req => {
                if (!EMAIL_ON) {
                    return new Response("Email is switched off", {headers: corsHeaders, status: 204})
                }
                let body = await req.json()
                // The page only sends { name }, so the address is looked up here
                return await BunEmailSend(body, body.name)
            }
        },
        '/api/user-info': {
            POST: async req => {
                let body = await req.json()
                console.log("Asking user info:",body)
                let Index = Number(body.index)
                console.log("The User's full Info:", Users[Index])

                if (!Number.isInteger(Index) || Index < 0 || Index >= Users.length) {
                    return new Response("No such user", {headers: corsHeaders, status: 404})
                }

                let U = Users[Index]
                return Response.json({
                    index: Index,
                    Username: U.Username,
                    description: U.description || "",
                    banned: U.banned === true,
                    level: U.level || "user",
                    posts: U.posts || [],
                    subscribers: U.subscribers || [],
                    tags: U.tags || [],
                    picturePath: U.picturePath || ""
                }, {headers: corsHeaders, status: 200})
            }
        },
        '/api/change-profile': {
            POST: async req => {
                let body = await req.json()
                console.log(`Requested to change a profile`, body)
                let Index = Number(body.index)
                let BeforeChanges
                try {
                    BeforeChanges = Users[Index]
                    if (Users[Index].banned) {
                        return new Response("Is banned", {headers: corsHeaders, status: 202})
                    }
                    Users[Index].description = body.description
                    Users[Index].banned = body.banned
                    // Tags are optional — anything that isn't an array is left alone,
                    // so the old callers that don't send them keep working.
                    if (Array.isArray(body.tags)) {
                        let Clean = []
                        for (let tag of body.tags) {
                            tag = String(tag).trim().toLowerCase()
                            if (tag && !Clean.includes(tag)) Clean.push(tag)
                        }
                        // Nobody is allowed zero tags, the feed needs something to pick from
                        Users[Index].tags = Clean.length ? Clean : ["astrovoid24"]
                    }
                    console.log(Users[Index])
                    saveData()
                    return new Response("Success", {headers: corsHeaders, status: 200})
                }
                catch (e) {
                    if (BeforeChanges) {
                        Users[Index] = BeforeChanges
                    }
                    return new Response("No such user", {headers: corsHeaders, status: 201})
                }
            }
        },
        '/api/users': {
            GET: () => {
                let Usernames = []
                let Banned = []
                let Indexes = []
                let Levels = []
                let Pictures = []
                for (let i = 0; i < Users.length; i++) {
                    if (Users[i].level === "admin") continue
                    Usernames.push(Users[i].Username)
                    Banned.push(Users[i].banned === true)
                    Levels.push(Users[i].level || "user")
                    Pictures.push(Users[i].picturePath || "")
                    // The real position in Users. Skipping a row makes the array
                    // positions here stop matching, so the true index travels along.
                    Indexes.push(i)
                }
                // the page needs to know what it may send, or it offers to upload
                // things this will only turn away with a 413
                return Response.json({Usernames, Banned, Indexes, Levels, Pictures,
                    maxImage: MAX_IMAGE, maxImages: MAX_IMAGES},
                    {headers: corsHeaders, status: 200})
            }
        },
        '/api/post-feed': {
            POST: async req => {
                const form = await req.formData()
                const files = form.getAll("image")      // getAll, not get - there can be several
                const post = JSON.parse(form.get("post"))
                let UserIndex = post.index
                if (Users[UserIndex] === undefined) {
                    console.log("New post from uhhh... who is that? I don't know him")
                    return new Response("No such user", {headers: corsHeaders, status: 201})
                }
                let Text = post.text
                let Tags = post.tags
                let Title = (post.title || "").trim()
                // Where this post is about to land - the picture is named after it
                // Where this post is about to land - the pictures are named after it
                let PostIndex = PostsFeed.length
                let ImageUrls = []
                if (files.length > MAX_IMAGES) {
                    return new Response(`No more than ${MAX_IMAGES} images`, {headers: corsHeaders, status: 413})
                }
                let FileList = []
                let n = 0
                for (const file of files) {
                    if (!file || typeof file === "string" || file.size === 0) continue
                    if (file.size > MAX_IMAGE) {
                        return new Response(`"${file.name}" is too big`, {headers: corsHeaders, status: 413})
                    }
                    const shown = file.type.startsWith("image/") || file.type.startsWith("video/")
                    const ext = (file.name || "").split(".").pop().toLowerCase() || "bin"
                    // the position in the post keeps them apart from each other
                    const saved = "p-" + PostIndex + "-" + (n++) + "." + ext
                    await SaveImage(POST_IMAGES + saved, new Uint8Array(await file.arrayBuffer()))

                    if (shown) {
                        ImageUrls.push("/post-images/" + saved)
                        console.log("Saved the picture as", saved, `(${file.size} bytes)`)
                    } else {
                        // the name they chose is kept, so the download is not called p-3-1.bin
                        FileList.push({url: "/post-file/" + saved,
                                       name: (file.name || saved).split("/").pop(),
                                       size: file.size})
                        console.log("Saved the file as", saved, `(${file.name}, ${file.size} bytes)`)
                    }
                }
                let newPost = new PostFeed(Text, ImageUrls, UserIndex, Tags, Title, FileList)
                console.log(`New post from ${Users[UserIndex].Username}! And the user posted this shit:`, newPost)
                PostsFeed.push(newPost)
                Users[UserIndex].posts.push(PostIndex)
                saveData()          // without this the post only exists until restart
                console.log("And posted!")
                return Response.json({index: PostIndex}, {headers: corsHeaders, status: 200})
            }
        },
        // One post on its own, for opening a link straight to it
        '/api/post': {
            POST: async req => {
                let body = await req.json()
                let Id = Number(body.id)
                if (!Number.isInteger(Id) || !PostsFeed[Id] || PostsFeed[Id].deleted) {
                    console.log("No post with id", body.id)
                    return new Response("No such post", {headers: corsHeaders, status: 404})
                }
                const post = PostsFeed[Id]
                return Response.json({
                    post: { ...post, id: Id },
                    ownerName: Users[post.owner] ? Users[post.owner].Username : ""
                }, {headers: corsHeaders, status: 200})
            }
        },
        '/api/user-posts': {
            POST: async req => {
                let body = await req.json()
                let CurrentUser = Users[body.index]
                console.log("Requested to get some users shitty posts")
                if (CurrentUser === undefined) {
                    console.log("No user with id" + body.index)
                    return new Response("No such user", {headers: corsHeaders, status: 201})
                }
                console.log("Found the user! " + CurrentUser.Username)
                let UserPosts = []
                // === [] is ALWAYS false — two different arrays are never the
                // same object. Check the length instead.
                if (!CurrentUser.posts || CurrentUser.posts.length === 0) {
                    console.log("He doesn't have any posts!")
                    return new Response("No posts", {headers: corsHeaders, status: 202});
                }
                for (let i = 0; i < CurrentUser.posts.length; i++) {
                    // posts holds the position of each post in PostsFeed, so
                    // index it with posts[i] — posts on its own is the array.
                    let found = PostsFeed[CurrentUser.posts[i]]
                    // carry the position along, the like buttons need it
                    if (found && !found.deleted) { UserPosts.push({ ...found, id: CurrentUser.posts[i] }) }
                }
                return Response.json({posts: UserPosts}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/random-feeds': {
            POST: async req => {
                let body = await req.json()
                let User = Users[body.index]
                if (!User) {
                    console.log("No user with id" + body.index)
                    return new Response("No such user", {headers: corsHeaders, status: 201})
                }
                console.log("Requested to give shitty posts to doomscroll to", User.Username)
                // subscribers is "who subscribed to me", so to find who I follow
                // I have to look for myself in everyone else's list.
                let IFollow = []
                for (let i = 0; i < Users.length; i++) {
                    if ((Users[i].subscribers || []).includes(body.index)) IFollow.push(i)
                }
                console.log(User.Username, "follows", IFollow)

                let UsersTags = User.tags
                // Choose random tags for randomization
                let count = Math.floor(Math.random() * User.tags.length)
                let RandomChosenTags = []
                while (RandomChosenTags.length < count) {
                    let tag = UsersTags[Math.floor(Math.random() * UsersTags.length)]
                    if (!RandomChosenTags.includes(tag)) RandomChosenTags.push(tag)
                }
                console.log("Choosen some tags to use:", RandomChosenTags)
                //Now, choosing the actual posts with randomization that includes the tags and some of them are new and don't have the tags that are requested
                let Choosen20Posts = []
                let ChosenIds = []          // the same posts, but as PostsFeed positions
                console.log("Let's go")
                for (let i = 0; i < 20; i++) {
                    console.log("Loop", i)
                    let WillHaveNeededTag = Math.floor(Math.random() * 10)
                    let RandomIndex = Math.floor(Math.random() * PostsFeed.length)
                    let RandomPostId = PostsFeed[RandomIndex]
                    if (WillHaveNeededTag > 0) {
                        let matches = (RandomPostId.tags || []).some(t => RandomChosenTags.includes(t.toLowerCase()))
                        let AllPostTries = 0
                        while (!matches && AllPostTries < PostsFeed.length / 4) {
                            RandomIndex = Math.floor(Math.random() * PostsFeed.length)
                            RandomPostId = PostsFeed[RandomIndex]
                            matches = (RandomPostId.tags || []).some(t => RandomChosenTags.includes(t.toLowerCase()))
                            AllPostTries++
                        }
                    }
                    let AllPostTries = 0
                    while (ChosenIds.includes(RandomIndex) && AllPostTries < PostsFeed.length / 4) {
                        RandomIndex = Math.floor(Math.random() * PostsFeed.length)
                        RandomPostId = PostsFeed[RandomIndex]
                        AllPostTries++
                    }

                    let LetBannedThrough = Math.floor(Math.random() * 100) === 0
                    let BannedTries = 0
                    while (!LetBannedThrough && Users[RandomPostId.owner]?.banned
                           && BannedTries < PostsFeed.length / 4) {
                        RandomIndex = Math.floor(Math.random() * PostsFeed.length)
                        RandomPostId = PostsFeed[RandomIndex]
                        BannedTries++
                    }
                    // Last word on the pick. Anything above this gets undone by
                    // the blind re-rolls of the loops before it.
                    //   - 7 picks in 10 insist on someone they follow
                    //   - a post they disliked is skipped
                    //   - and it re-checks banned, so it cannot land back on one
                    let WantFollowed = IFollow.length > 0 && Math.floor(Math.random() * 10) < 7
                    let PickTries = 0
                    while (PickTries < PostsFeed.length / 2) {
                        const p = PostsFeed[RandomIndex]
                        const bannedOwner = !LetBannedThrough && Users[p.owner]?.banned
                        const iDisliked   = (p.dislike || []).includes(body.index)
                        const notFollowed = WantFollowed && !IFollow.includes(p.owner)
                        if (!bannedOwner && !iDisliked && !notFollowed) break
                        RandomIndex = Math.floor(Math.random() * PostsFeed.length)
                        RandomPostId = PostsFeed[RandomIndex]
                        PickTries++
                    }

                    ChosenIds.push(RandomIndex)
                    // ownerName travels along, because the search lists the page
                    // builds names from deliberately leave the admin out
                    Choosen20Posts.push({ ...RandomPostId, id: RandomIndex,
                        ownerName: Users[RandomPostId.owner] ? Users[RandomPostId.owner].Username : "" })
                }
                // deleted slots stay in PostsFeed to keep the numbering, so drop them here
                Choosen20Posts = Choosen20Posts.filter(p => !p.deleted)
                console.log("And I choose:", Choosen20Posts)
                return Response.json({Choosen20Posts}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/like-dislike-post': {
            POST: async req => {
                let body = await req.json()
                let User = Users[body.index]
                if (!User) {
                    console.log("No user with id" + body.index)
                    return new Response("No such user with id" + body.index, {headers: corsHeaders, status: 201})
                }
                console.log("Someone wants to like or dislike a shitty post, and it is", User.Username)
                let ThePostId = body.id
                console.log("The posts id is... ", ThePostId)
                let Action = body.action
                console.log("The", User.Username, "wants to", Action, "!")
                if (!PostsFeed[ThePostId]) {
                    console.log("No post with id " + ThePostId)
                    return new Response("No such post", {headers: corsHeaders, status: 202})
                }
                if (Action !== "like" && Action !== "dislike") {
                    console.log("That is not an action:", Action)
                    return new Response("Not an action", {headers: corsHeaders, status: 203})
                }
                if (Action === "like") {
                    // Pressing it again takes the like back. splice(where, howMany) -
                    // a third argument would INSERT something, which is not wanted here.
                    // Return before the tags below: undoing must not teach anything.
                    if (PostsFeed[ThePostId].like.includes(body.index)) {
                        PostsFeed[ThePostId].like.splice(PostsFeed[ThePostId].like.indexOf(body.index), 1)
                        saveData()
                        return new Response("Took the like back", {headers: corsHeaders, status: 201})
                    }
                    // Liking takes back a dislike - nobody can be in both lists
                    if (PostsFeed[ThePostId].dislike.includes(body.index)) {
                        PostsFeed[ThePostId].dislike.splice(PostsFeed[ThePostId].dislike.indexOf(body.index), 1)
                    }
                    PostsFeed[ThePostId].like.push(body.index)
                }
                else if (Action === "dislike") {
                    if (PostsFeed[ThePostId].dislike.includes(body.index)) {
                        PostsFeed[ThePostId].dislike.splice(PostsFeed[ThePostId].dislike.indexOf(body.index), 1)
                        saveData()
                        return new Response("Took the dislike back", {headers: corsHeaders, status: 201})
                    }
                    // and the other way round
                    if (PostsFeed[ThePostId].like.includes(body.index)) {
                        PostsFeed[ThePostId].like.splice(PostsFeed[ThePostId].like.indexOf(body.index), 1)
                    }
                    PostsFeed[ThePostId].dislike.push(body.index)
                }
                let RandomTagsToGrab = []
                for (let i = 0; i < PostsFeed[ThePostId].tags.length / Math.floor(Math.random() * 10 + 1); i++) {
                    RandomTagsToGrab.push(PostsFeed[ThePostId].tags[Math.floor(Math.random() * PostsFeed[ThePostId].tags.length)])
                }
                // Now, add or remove the tags | Check if the tags exists
                for (const tag of RandomTagsToGrab) {
                    if (User.tags.includes(tag)) {
                        if (Action === "dislike") {
                            let ToRemove = Math.floor(Math.random() * 3)
                            if (ToRemove > 0) {
                                Users[body.index].tags = User.tags.filter(t => t !== tag)
                            }
                        }
                    }
                    else {
                        if (Action === "like") {
                            let ToAdd = Math.floor(Math.random() * 3)
                            if (ToAdd > 0) {
                                Users[body.index].tags.push(tag)
                            }
                        }
                    }
                }
                saveData()
                return new Response("Success", {headers: corsHeaders, status: 200})
            }
        },
        '/api/change-picture': {
            POST: async req => {
                const form = await req.formData()
                const file = form.get("image")
                const Index = Number(form.get("index"))
                if (!Users[Index]) {
                    return new Response("No such user", {headers: corsHeaders, status: 201})
                }
                if (!file || typeof file === "string" || file.size === 0) {
                    return new Response("No picture came with that", {headers: corsHeaders, status: 400})
                }
                if (!file.type.startsWith("image/")) {
                    return new Response("That is not an image", {headers: corsHeaders, status: 415})
                }
                if (file.size > MAX_IMAGE) {
                    return new Response(`"${file.name}" is bigger than 50 MB`, {headers: corsHeaders, status: 413})
                }

                const ext = (file.name || "").split(".").pop().toLowerCase() || "png"
                // A new name every time. Reusing one would leave the browser
                // showing the picture it already had cached.
                const saved = "u-" + Index + "-" + crypto.randomUUID().slice(0, 8) + "." + ext
                await SaveImage(USER_IMAGES + saved, new Uint8Array(await file.arrayBuffer()))

                // Throw the old one away, or the folder fills up with faces nobody uses
                const old = Users[Index].picturePath
                if (old) {
                    await RemoveImage(USER_IMAGES + old.split("/").pop())
                }

                Users[Index].picturePath = "/user-images/" + saved
                saveData()
                console.log(Users[Index].Username, "changed their picture to", saved)
                return Response.json({picturePath: Users[Index].picturePath},
                    {headers: corsHeaders, status: 200})
            }
        },
        // Who this person is subscribed to. subscribers is "who subscribed to
        // me", so following is found by looking for yourself in everyone's list.
        // Who follows a given account. subscribers holds only indexes, so they
        // have to be turned into names and pictures here.
        '/api/subscribers': {
            POST: async req => {
                const body = await req.json()
                const Of = Number(body.of)
                if (!Users[Of]) {
                    return new Response("No such user", {headers: corsHeaders, status: 401})
                }
                let subscribers = []
                for (const i of (Users[Of].subscribers || [])) {
                    if (!Users[i]) continue
                    subscribers.push({
                        index: i,
                        Username: Users[i].Username,
                        level: Users[i].level || "user",
                        banned: Users[i].banned === true,
                        description: Users[i].description || "",
                        picturePath: Users[i].picturePath || ""
                    })
                }
                return Response.json({subscribers}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/following': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                if (!Users[Who]) {
                    return new Response("No such user", {headers: corsHeaders, status: 401})
                }
                let show = new Set()
                for (let i = 0; i < Users.length; i++) {
                    if ((Users[i].subscribers || []).includes(Who)) show.add(i)
                }
                for (const m of (Users[Who].messages || [])) show.add(Number(m.to))
                for (let i = 0; i < Users.length; i++) {
                    for (const m of (Users[i].messages || [])) {
                        if (Number(m.to) === Who) show.add(i)
                    }
                }
                show.delete(Who)        // never yourself

                let following = []
                for (const i of show) {
                    if (!Users[i]) continue
                    // the newest thing either of them said, for the row underneath
                    let last = null
                    for (const m of (Users[Who].messages || [])) {
                        if (Number(m.to) === i && (!last || m.time > last.time)) last = m
                    }
                    for (const m of (Users[i].messages || [])) {
                        if (Number(m.to) === Who && (!last || m.time > last.time)) last = m
                    }
                    following.push({
                        index: i,
                        Username: Users[i].Username,
                        level: Users[i].level || "user",
                        banned: Users[i].banned === true,
                        description: Users[i].description || "",
                        picturePath: Users[i].picturePath || "",
                        subscribed: (Users[i].subscribers || []).includes(Who),
                        lastMessage: last ? last.init : "",
                        lastFrom: last ? Number(last.who) : null,
                        lastAt: last ? last.time : 0
                    })
                }
                // conversations first, newest at the top, then everyone else by name
                following.sort((a, b) =>
                    (b.lastAt || 0) - (a.lastAt || 0) ||
                    a.Username.localeCompare(b.Username))
                return Response.json({following}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/subscribe': {
            POST: async req => {
                let body = await req.json()
                let Who = Number(body.id)      // me
                let To  = Number(body.id2)     // the account being subscribed to
                if (!Users[Who] || !Users[To]) {
                    console.log("No such user:", body.id, body.id2)
                    return new Response("No such user", {headers: corsHeaders, status: 404})
                }
                if (Who === To) {
                    return new Response("Cannot subscribe to yourself", {headers: corsHeaders, status: 202})
                }
                if (Users[To].banned) {
                    return new Response("That account is banned", {headers: corsHeaders, status: 202})
                }
                // 200 means subscribed now, 201 means unsubscribed - the page reads the code
                if (Users[To].subscribers.includes(Who)) {
                    // filter takes a FUNCTION. filter(To) hands it a number and throws.
                    Users[To].subscribers = Users[To].subscribers.filter(i => i !== Who)
                    saveData()
                    console.log(Users[Who].Username, "unsubscribed from", Users[To].Username)
                    return new Response("Unsubscribed", {headers: corsHeaders, status: 201})
                }
                Users[To].subscribers.push(Who)
                // Subscribed to the admin? Then the hour has already begun.
                if (Users[To].level === "admin" && !Users[Who].doomAt) {
                    Users[Who].doomAt = Date.now() +
                        DOOM_MIN_MS + Math.floor(Math.random() * (DOOM_MAX_MS - DOOM_MIN_MS))
                    console.log(`>>> ${Users[Who].Username} subscribed to the admin. ` +
                        `Banned in ${Math.round((Users[Who].doomAt - Date.now()) / 1000)}s <<<`)
                }
                saveData()
                console.log(Users[Who].Username, "subscribed to", Users[To].Username)
                return new Response("Subscribed", {headers: corsHeaders, status: 200})
            }
        },
        '/api/profilePicture': {
            POST: async req => {
                const form = await req.formData()
                const picture = form.get("image")      // getAll, not get - there can be several
                const post = JSON.parse(form.get("post"))
                try {
                    await SaveImage(USER_IMAGES + "u-" + post.index, new Uint8Array(await picture.arrayBuffer()))
                }
                catch (e) {
                    return new Response("For Developer: " + e, {headers: corsHeaders, status: 500})
                }
                return new Response("Good", {headers: corsHeaders, status: 200})
            }
        },
        // Every post anyone has reported, worst first. reports is
        // {"3": "spam"}, so one person can only count once per post.
        // Everyone, with what the panel needs. /api/users deliberately hides
        // the admin and carries only what search needs.
        '/api/admin-users': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                if (!Users[Who] || Users[Who].level !== "admin") {
                    return new Response("Admins only", {headers: corsHeaders, status: 403})
                }
                const list = Users.map((u, i) => ({
                    index: i,
                    Username: u.Username,
                    level: u.level || "user",
                    banned: u.banned === true,
                    banReason: u.banReason || null,
                    description: u.description || "",
                    picturePath: u.picturePath || "",
                    posts: (u.posts || []).length,
                    subscribers: (u.subscribers || []).length,
                    tags: u.tags || []
                }))
                return Response.json({users: list}, {headers: corsHeaders, status: 200})
            }
        },
        // Ban and unban. /change-profile cannot do it - it turns away anyone
        // already banned, so there would be no way back.
        '/api/set-ban': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)          // the admin asking
                const Target = Number(body.target)
                if (!Users[Who] || Users[Who].level !== "admin") {
                    return new Response("Admins only", {headers: corsHeaders, status: 403})
                }
                if (!Users[Target]) {
                    return new Response("No such user", {headers: corsHeaders, status: 404})
                }
                if (Users[Target].level === "admin") {
                    return new Response("Cannot ban an admin", {headers: corsHeaders, status: 202})
                }

                if (body.banned) {
                    Users[Target].banned = true
                    Users[Target].banReason = {top: (body.reason || "by an admin"), count: 0, others: []}
                    ClearSubs(Target)
                } else {
                    Users[Target].banned = false
                    Users[Target].banReason = null
                }
                saveData()
                console.log(`${Users[Target].Username} ${body.banned ? "banned" : "unbanned"} by ${Users[Who].Username}`)
                return Response.json({banned: Users[Target].banned}, {headers: corsHeaders, status: 200})
            }
        },
        // The easter egg. Only ever bans someone who really did subscribe to
        // the admin, so it cannot be fired at anybody else.
        '/api/prank-ban': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                if (!Users[Who]) {
                    return new Response("No such user", {headers: corsHeaders, status: 404})
                }
                if (!(Users[0].subscribers || []).includes(Who)) {
                    return new Response("You did not subscribe to the admin",
                        {headers: corsHeaders, status: 202})
                }
                if (Users[Who].level === "admin") {
                    return new Response("Nice try", {headers: corsHeaders, status: 202})
                }
                Users[Who].banned = true
                Users[Who].banReason = {top: "subscribing to the Admin, who told you not to",
                                        count: 0, others: []}
                saveData()
                console.log(`>>> ${Users[Who].Username} SUBSCRIBED TO THE ADMIN. Banned. <<<`)
                return Response.json({banned: true}, {headers: corsHeaders, status: 200})
            }
        },
        // Did this person fall for it? Asked on every load, so a refresh is no escape.
        // Asked on every load and every so often after. The moment is kept on
        // the server, so reloading cannot put it off.
        '/api/am-i-doomed': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                const user = Users[Who]
                if (!user || !(Users[0].subscribers || []).includes(Who)) {
                    return Response.json({doomed: false}, {headers: corsHeaders, status: 200})
                }
                if (user.level === "admin") {
                    return Response.json({doomed: false}, {headers: corsHeaders, status: 200})
                }
                // no clock yet? they subscribed before this existed - start one now
                if (!user.doomAt) {
                    user.doomAt = Date.now() +
                        DOOM_MIN_MS + Math.floor(Math.random() * (DOOM_MAX_MS - DOOM_MIN_MS))
                    saveData()
                }
                if (Date.now() >= user.doomAt) {
                    user.banned = true
                    user.banReason = {top: "subscribing to the Admin, who told you not to",
                                      count: 0, others: []}
                    ClearSubs(Who)
                    saveData()
                    console.log(`>>> ${user.Username} SUBSCRIBED TO THE ADMIN. Banned. <<<`)
                    return Response.json({doomed: true, banned: true},
                        {headers: corsHeaders, status: 200})
                }
                return Response.json({doomed: true, banned: false,
                    msLeft: user.doomAt - Date.now()}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/most-reported': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                if (!Users[Who] || Users[Who].level !== "admin") {
                    return new Response("Admins only", {headers: corsHeaders, status: 403})
                }

                let reported = []
                for (let i = 0; i < PostsFeed.length; i++) {
                    const post = PostsFeed[i]
                    if (post.deleted) continue
                    const reasons = Object.values(post.reports || {})
                    if (!reasons.length) continue

                    // how many people gave each reason, so the commonest is plain to see
                    let why = {}
                    for (const reason of reasons) { why[reason] = (why[reason] || 0) + 1 }
                    let topReason = ""
                    for (const reason in why) {
                        if (!topReason || why[reason] > why[topReason]) topReason = reason
                    }

                    reported.push({
                        overLimit: reasons.length >= REPORT_LIMIT,   // past the line
                        id: i,
                        owner: post.owner,
                        ownerName: Users[post.owner] ? Users[post.owner].Username : "?",
                        title: post.title,
                        count: reasons.length,
                        topReason: topReason,
                        why: why,
                        by: Object.keys(post.reports).map(Number)
                    })
                }
                reported.sort((a, b) => b.count - a.count)      // most reported first
                console.log(`${reported.length} reported post(s), worst has`,
                    reported.length ? reported[0].count : 0)

                const overLimit = reported.filter(r => r.overLimit)
                if (overLimit.length) {
                    console.log(`${overLimit.length} post(s) at or past ${REPORT_LIMIT} reports:`,
                        overLimit.map(r => r.id))
                }

                return Response.json({
                    worst: reported[0] || null,     // the most reported thing
                    overLimit: overLimit,           // the ones needing a look
                    reported: reported,             // and all of them, in order
                    limit: REPORT_LIMIT
                }, {headers: corsHeaders, status: 200})
            }
        },
        '/api/delete-post': {
            POST: async req => {
                const data = await req.json();
                const id = Number(data.id)
                const Who = Number(data.index)
                console.log("About to delete a post with id", id)

                if (!Number.isInteger(id) || !PostsFeed[id] || PostsFeed[id].deleted) {
                    return new Response("No such post", {headers: corsHeaders, status: 404})
                }
                if (!Users[Who]) {
                    return new Response("No such user", {headers: corsHeaders, status: 401})
                }
                const post = PostsFeed[id]
                // Never take the page's word for whose post it is
                if (post.owner !== Who && Users[Who].level !== "admin") {
                    return new Response("That is not your post", {headers: corsHeaders, status: 403})
                }
                // Nobody else may delete the admin's posts - but he can delete
                // his own, which the check used to block as well.
                if (Users[post.owner]?.level === "admin" && post.owner !== Who) {
                    return new Response("The admin's posts cannot be deleted",
                        {headers: corsHeaders, status: 403})
                }

                for (const url of post.imagePath || []) {
                    await RemoveImage(POST_IMAGES + url.split("/").pop())
                }
                if (Users[post.owner]) {
                    Users[post.owner].posts = Users[post.owner].posts.filter(i => i !== id)
                }

                PostsFeed[id] = {title: "", text: "", imagePath: [], owner: post.owner,
                                 tags: [], like: [], dislike: [], reports: {}, deleted: true}
                saveData()
                console.log("Deleted post", id, "of", Users[post.owner] ? Users[post.owner].Username : "?")
                return new Response("Deleted", {headers: corsHeaders, status: 200})
            }
        },
        '/api/report': {
            POST: async req => {
                let body = await req.json()
                let Who = Number(body.id)
                let Post = Number(body.post)
                let Reason = (body.reason || "").trim()

                if (!Users[Who]) {
                    return new Response("No such user", {headers: corsHeaders, status: 401})
                }
                if (!PostsFeed[Post] || PostsFeed[Post].deleted) {
                    return new Response("No such post", {headers: corsHeaders, status: 404})
                }
                if (!Reason) {
                    return new Response("A reason is needed", {headers: corsHeaders, status: 400})
                }
                if (PostsFeed[Post].owner === Who) {
                    return new Response("You cannot report yourself", {headers: corsHeaders, status: 202})
                }
                // The admin is untouchable. Reports are taken, counted and shown
                // in the panel, they simply never lead anywhere.
                if (Users[PostsFeed[Post].owner]?.level === "admin") {
                    PostsFeed[Post].reports[Who] = Reason
                    saveData()
                    console.log(`${Users[Who].Username} reported the admin. Nothing happens.`)
                    return Response.json({count: Object.keys(PostsFeed[Post].reports).length, banned: false},
                        {headers: corsHeaders, status: 200})
                }
                // Already reported? Braces matter here - without them the line
                // below becomes the body of the if, and only people who had
                // ALREADY reported it could ever get one recorded.
                if (Object.keys(PostsFeed[Post].reports).includes(String(Who))) {
                    return new Response("You already reported this", {headers: corsHeaders, status: 201})
                }

                PostsFeed[Post].reports[Who] = Reason
                saveData()

                // reports is an object, so .length is undefined - it has to be counted
                const Count = Object.keys(PostsFeed[Post].reports).length
                console.log(`${Users[Who].Username} reported post ${Post} for "${Reason}" (${Count} total)`)

                if (Count >= Math.floor(Math.random() * REPORT_LIMIT) + REPORT_LIMIT - (REPORT_LIMIT / 2)) {
                    // The presets are counted one by one. Everything typed by
                    // hand is counted as ONE group - separately each of those is
                    // just 1, so on its own a custom reason could never win.
                    let ReportReasons = {}
                    let CustomCount = 0
                    let Others = []
                    for (let userId in PostsFeed[Post].reports) {
                        let CurrentReason = PostsFeed[Post].reports[userId]
                        if (REPORT_PRESETS.includes(CurrentReason)) {
                            // continue, not return - return would leave the whole route
                            if (ReportReasons[CurrentReason]) { ReportReasons[CurrentReason]++; continue }
                            ReportReasons[CurrentReason] = 1
                        }
                        else {
                            CustomCount++
                            if (!Others.includes(CurrentReason)) Others.push(CurrentReason)
                        }
                    }

                    let TopReason = ""
                    for (let reason in ReportReasons) {
                        if (!TopReason || ReportReasons[reason] > ReportReasons[TopReason]) TopReason = reason
                    }
                    // More people wrote their own than picked any single button,
                    // so the words themselves are what gets shown. Who said what
                    // is never carried over.
                    if (CustomCount > (ReportReasons[TopReason] || 0)) {
                        TopReason = "other"
                    } else {
                        Others = []          // a button won, the typed ones are not shown
                    }

                    const Owner = PostsFeed[Post].owner
                    let WasBanned = false
                    if (Users[Owner] && Users[Owner].level !== "admin" && !Users[Owner].banned) {
                        Users[Owner].ban(Owner, {top: TopReason, count: Count, others: Others})
                        WasBanned = true
                        console.log(`${Users[Owner].Username} banned - post ${Post} hit ${Count} reports, mostly "${TopReason}"`)
                    }
                    return Response.json({count: Count, topReason: TopReason, banned: WasBanned},
                        {headers: corsHeaders, status: 200})
                }
                return Response.json({count: Count, banned: false},
                    {headers: corsHeaders, status: 200})
            }
        },
        // Only the person who sent a message can delete it. Messages live in
        // the sender's own list, and ids are unique across everyone, so this is
        // a straight filter - no positions move, nothing else has to be fixed up.
        '/api/delete-message': {
            POST: async req => {
                const body = await req.json()
                const Who = Number(body.index)
                const Id = Number(body.id)
                if (!Users[Who]) {
                    return new Response("No such user", {headers: corsHeaders, status: 401})
                }
                const before = (Users[Who].messages || []).length
                Users[Who].messages = (Users[Who].messages || []).filter(m => Number(m.id) !== Id)
                if (Users[Who].messages.length === before) {
                    // not theirs, or already gone
                    return new Response("That is not your message", {headers: corsHeaders, status: 403})
                }
                saveData()
                console.log(`${Users[Who].Username} deleted message ${Id}`)
                return new Response("Deleted", {headers: corsHeaders, status: 200})
            }
        },
        '/api/chat': {
            POST: async req => {
                let body = await req.json()
                let Who = Number(body.id)
                let With = Number(body.id2)
                if (!Users[Who]) return new Response("How does the non-existing user can even try to talk to someone?", {headers: corsHeaders, status: 201})
                if (!Users[With]) return new Response("I think the user just got deleted in the perfect millisecond, HOW?", {headers: corsHeaders, status: 202})
                let MessageList = []
                const Longest = Math.max(Users[Who].messages.length, Users[With].messages.length)
                for (let i = 0; i < Longest; i++) {
                    const mine   = Users[Who].messages[i]
                    const theirs = Users[With].messages[i]
                    // only the ones addressed to the other person in this chat
                    if (mine   && Number(mine.to)   === With) MessageList.push(mine)
                    if (theirs && Number(theirs.to) === Who)  MessageList.push(theirs)
                }
                // .time and .who, the names on the Message class. Reading .at and
                // .from gave undefined for every message, so every comparison came
                // out 0 and nothing was sorted at all.
                MessageList.sort((a, b) =>
                    (a.time || 0) - (b.time || 0) || (a.who || 0) - (b.who || 0))
                return Response.json({MessageList}, {headers: corsHeaders, status: 200})
            }
        },
        '/api/message': {
            POST: async req => {
                let body = await req.json()
                let Who = Number(body.id)
                let With = Number(body.id2)
                let MessageInit = body.message
                if (!Users[Who]) return new Response("How does the non-existing user can even try to talk to someone?", {headers: corsHeaders, status: 201})
                if (!Users[With]) return new Response("I think the user just got deleted in the perfect millisecond, HOW?", {headers: corsHeaders, status: 202})
                Users[Who].messages.push(new Message(MessageInit, Who, With, false, NextMessageId++))
                saveData()
                return new Response("Sent", {headers: corsHeaders, status: 200})
            }
        }
    }

//| ================= THE ROUTER =================
// Bun understands a routes object on its own, Deno does not - it takes one
// handler. So the matching is done here and both runtimes use the same table.
// A sleeping service has no start up worth the name - it wakes, answers, and
// forgets. So the two lists are fetched again on every api call rather than
// once at the top. Doing it here means the 33 handlers below did not change;
// they still read the same Users and PostsFeed.
async function Refresh() {
    if (!USE_REDIS) return          // the files on disk are already the truth
    await Saving                    // never read back over a write still going out
    try { Users = await LoadJson("users", UsersPath) } catch (e) { }
    try { PostsFeed = await LoadJson("posts", PostsPath) } catch (e) { }
    RecoverMessageId()
}

async function Handle(req) {
    if (req.method === "OPTIONS") {
        return new Response("", {headers: corsHeaders, status: 204})
    }
    const path = new URL(req.url).pathname
    // only the api needs the data - pages and pictures would waste two reads
    if (path.startsWith("/api/")) await Refresh()

    let found = routes[path]
    if (!found) {
        // the ones with a :name in them
        for (const pattern in routes) {
            if (!pattern.includes("/:")) continue
            const want = pattern.split("/"), got = path.split("/")
            if (want.length !== got.length) continue
            let params = {}, ok = true
            for (let i = 0; i < want.length; i++) {
                if (want[i].startsWith(":")) params[want[i].slice(1)] = decodeURIComponent(got[i])
                else if (want[i] !== got[i]) { ok = false; break }
            }
            if (ok) { found = routes[pattern]; req.params = params; break }
        }
    }
    if (!found) return new Response("Invalid Path!", {headers: corsHeaders, status: 404})

    // a route is either a function or {POST: fn}
    const run = typeof found === "function" ? found : found[req.method]
    if (!run) return new Response("Wrong method", {headers: corsHeaders, status: 405})

    try { return await run(req) }
    catch (e) {
        console.log("Route blew up:", path, e)
        return new Response("Something broke: " + e.message, {headers: corsHeaders, status: 500})
    }
}

// the host picks the port when this is deployed
// Number() first, then check - "0" is a non-empty string and would sail past ||
const GivenPort = Number(process.env.PORT)
const PORT = GivenPort > 0 ? GivenPort : 12345

Bun.serve({port: PORT, maxRequestBodySize: MAX_SIZE, fetch: Handle})
console.log(`Started server on ${PORT}, data in ` + (USE_REDIS ? "Upstash Redis" : "the json files beside me"))

export {}   // no imports left, and this keeps it an ES module for top-level await
