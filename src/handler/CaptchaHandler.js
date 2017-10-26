// cSpell:words Captcha

const chance = new require("chance")()
const Cache = require("../cache/Cache")

exports.aGenerate = async function(ctx) {
    const simpleCaptcha = require("simple-captcha")
    const captcha = simpleCaptcha.create({width: 100, height: 40})
    const text = captcha.text()
    captcha.generate()

    const id = chance.hash()
    ctx.cookies.set("captcha_id", id, {signed: true, httpOnly: true})
    await Cache.aSetString(["captcha", id], text)

    ctx.set("X-Captcha-Id", id)
    ctx.body = captcha.buffer("image/png")
    ctx.type = "image/png"
}

exports.aCheck = async function(id, text) {
    if (!(id && text)) return false
    const expected = await Cache.aGetString(["captcha", id])
    return expected === text
}

exports.aClearById = async function(id) {
    await Cache.aUnset(["captcha"], [id])
}

