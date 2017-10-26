const chance = new require("chance")()
// const Promise = require('bluebird')
// const request = require('request')
// const pRequestPost = Promise.promisify(request.post.bind(request))

const Errors = require("../Errors")
const Cache = require("../cache/Cache")
const Extension = require("../Extension")

// 验证验证码
exports.aCheck = async function(target, code) {
    let expectedCode = await Cache.aGetString(["securityCodes", target])

    if (!(expectedCode && expectedCode.code === code))
        throw new Errors.UserError("SecurityCodeNotMatch")
    if (Date.now() - expectedCode.sendTime > 15 * 60 * 1000)
        throw new Errors.UserError("SecurityCodeExpired") // 过期

    await Cache.aUnset(["securityCodes"], [target])
}

// 发送验证码到邮箱
exports.aSendSecurityCodeToEmail = async function(toEmail) {
    let code = await aGenerateSecurityCode(toEmail)
    return Extension.aSendSecurityCodeToEmail(toEmail, code)
}

// 发送验证码到手机
exports.aSendSecurityCodeToPhone = async function(toPhone) {
    let code = await aGenerateSecurityCode(toPhone)
    return Extension.aSendSecurityCodeToPhone(toPhone, code)
}

async function aGenerateSecurityCode(address) {
    let code = chance.string({length: 6, pool: "0123456789"})
    await Cache.aSetString(["securityCodes", address],
        {code: code, sendTime: new Date().getTime()})
    return code
}
