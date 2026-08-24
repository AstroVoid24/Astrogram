// Pushes Users.json, Posts.json and every picture beside it into Upstash Redis.
// Run it once, after the two env vars are set:
//     bun Import-To-Redis.js
// Bun reads .env by itself, so nothing else is needed.

const URL_ = process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!URL_ || !TOKEN) {
    console.log("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing from .env")
    process.exit(1)
}

async function RedisSet(key, value) {
    const r = await fetch(`${URL_}/set/${key}`, {
        method: "POST",
        headers: {Authorization: `Bearer ${TOKEN}`},
        body: JSON.stringify(value)
    })
    if (!r.ok) throw new Error(`${key}: ${r.status} ${await r.text()}`)
}

function ToBase64(bytes) {
    let out = ""
    for (const b of bytes) out += String.fromCharCode(b)
    return btoa(out)
}

// ---- the two lists ----
for (const [key, path] of [["users", "./Users.json"], ["posts", "./Posts.json"]]) {
    const value = await Bun.file(path).json()
    await RedisSet(key, value)
    console.log(`${key}: ${value.length} rows`)
}

// ---- the pictures ----
// p-... is attached to a post, u-... is somebody's profile picture
const glob = new Bun.Glob("{p,u}-*.{png,jpg,jpeg,webp,gif}")
let sent = 0, skipped = 0
for await (const name of glob.scan(".")) {
    const bytes = new Uint8Array(await Bun.file(name).arrayBuffer())
    const asText = ToBase64(bytes)
    // Upstash will not take a huge value, and base64 is a third bigger again
    if (asText.length > 900_000) {
        console.log(`  SKIPPED ${name} - ${(bytes.length / 1024).toFixed(0)}KB is too big for Redis`)
        skipped++
        continue
    }
    await RedisSet("img:" + name, asText)
    console.log(`  ${name}  ${(bytes.length / 1024).toFixed(0)}KB`)
    sent++
}

console.log(`\n${sent} picture(s) in, ${skipped} too big.`)
if (skipped) {
    console.log("The big ones need shrinking, or somewhere else to live (Cloudinary, R2).")
}
console.log("Done. Start the server and it will read all of this from Redis.")
