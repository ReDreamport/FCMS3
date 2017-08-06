const chance = new require('chance')()
const { URL } = require('url')

const Log = require('../Log')
const Config = require('../Config')
const Error = require('../Error')
const EntityService = require('../service/EntityService')

// SSO 客户端请求该接口
// 如果 SSO 已登录，则产生一个 TOKEN 回调客户端校验 TOKEN 的接口
// 如果 SSO 没有登录，则让客户端跳转到 SSO 登录页
exports.aAuth = async function (ctx) {
    let userId = ctx.cookies.get('SsoUserId', { signed: true })
    let userToken = ctx.cookies.get('SsoUserToken', { signed: true })

    let session = await aValidSsoSession(userId, userToken)
    if (!session) {
        let redirect = ctx.request.origin + "/sso/sign-in"
        ctx.body = { redirect, auth: false }
        return
    }

    let callback = ctx.query.callback
    if (!callback)
        throw new Error.UserError("MissingCallback", "Missing Callback")
    let encodedCallback = encodeURIComponent(callback)

    let callbackUrl = new URL(callback)
    let callbackOrigin = callbackUrl.origin // http://www.baidu.com:80
    let clientConfig = Config.ssoServer.clients[callbackOrigin]
    if (!clientConfig)
        throw new Error.UserError("UnkownClient",
            "Unkown Client: " + callbackOrigin)

    let { validateSsoTokenUrl } = clientConfig

    let token = await aNewClientToken(callbackOrigin)
    validateSsoTokenUrl += `?callback=${encodedCallback}&token=${token}`

    ctx.body = { redirect: validateSsoTokenUrl, auth: true }
}

// SSO 客户端校验 TOKEN 的真实性。真实返回 204，否则返回 400。
exports.aValidateToken = async function (ctx) {
    let req = ctx.request.body
    if (!req) return ctx.status = 400

    let clientConfig = Config.ssoServer.clients[req.origin]
    if (!clientConfig)
        throw new Error.UserError("UnkownClient",
            "Unkown Client: " + req.origin)
    // 校验客户端的通信密钥
    if (clientConfig.key !== req.key)
        throw new Error.UserError("BadClientKey", "Bad Client Key")

    let ct = await EntityService.aFindOneByCriteria({},
        'F_SsoClientToken', { origin: req.origin, token: req.token })
    if (!ct) throw new Error.UserError("BadToken", "Bad Token")

    // 只能用一次，检验后就删除
    await EntityService.aRemoveManyByCriteria({}, 'F_SsoClientToken',
        { _id: ct._id })

    // 判断是否过期
    if (Date.now() - ct._createdOn.getTime() > 10000)
        throw new Error.UserError("TokenExpired", "Token Expired")

    ctx.status = 204
}

async function aValidSsoSession(userId, userToken) {
    let session = await EntityService.aFindOneByCriteria({},
        'F_SsoSession', { userId })
    if (!session) return false

    if (session.userToken !== userToken) {
        let errObj = { userId, userToken, sessionUserToken: session.userToken }
        Log.debug('token not match', errObj)
        return false
    }

    if (session.expireAt < Date.now()) {
        // Log.debug('token expired', { userId, expireAt: session.expireAt })
        return false
    }
    return session
}

// origin 的形式是 http://www.baidu.com:80
async function aNewClientToken(origin) {
    let token = chance.string({ length: 24 })

    // TODO 记录客户浏览器的 IP，记录此 TOKEN 授予的 IP
    let ct = { origin, token, _createdOn: new Date() }
    await EntityService.aCreate({}, 'F_SsoClientToken', ct)
    return token
}
