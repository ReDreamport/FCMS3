// cSpell:words Captcha

const CaptchaHandler = require("./CaptchaHandler")
const Errors = require("../Errors")

const SecurityCodeService = require("../security/SecurityCodeService")

// 发送验证码到手机
exports.aSendSignUpCodeToPhone = async function(ctx) {
    await aCheckCaptcha(ctx)

    const phone = ctx.params.phone
    if (!phone) return ctx.status = 400
    await SecurityCodeService.aSendSecurityCodeToPhone(phone)

    ctx.status = 204
}

// 发送验证码到邮箱
exports.aSendSignUpCodeToEmail = async function(ctx) {
    await aCheckCaptcha(ctx)

    const email = ctx.params.email
    if (!email) return ctx.status = 400

    await SecurityCodeService.aSendSecurityCodeToEmail(email)
    ctx.status = 204
}

async function aCheckCaptcha(ctx) {
    const req = ctx.request.body || {}
    const captchaId = req.captchaId ||
        ctx.cookies.get("captcha_id", {signed: true})
    const captchaText = req.captchaText

    if (!(captchaId && captchaText))
        throw new Errors.UserError("CaptchaWrong")

    if (!await CaptchaHandler.aCheck(captchaId, captchaText)) {
        await CaptchaHandler.aClearById(captchaId)
        throw new Errors.UserError("CaptchaWrong")
    }

    // 现在是不管验证码是否输入正确了一律只能用一次的策略
    await CaptchaHandler.aClearById(captchaId)
}
