const rp = require('request-promise-native')

const Log = require('../Log')
const Config = require('../Config')
const Error = require('../Error')
const EntityService = require('../service/EntityService')
const UserService = require('../security/UserService')

// SSO 客户端接收 SSO 服务器的 TOKEN 回调
exports.aAcceptToken = async function (ctx) {
    let token = ctx.query.token
    let origin = ctx.request.origin

    let originConfig = Config.originConfigs[origin]
    if (!originConfig) throw new Error.UserError("BadClient", "Bad Client")

    let callback = ctx.query.callback
    callback = callback ? decodeURIComponent(callback)
        : originConfig.defaultCallbackUrl

    let options = {
        method: 'POST',
        uri: originConfig.validateSsoTokenUrl,
        body: { key: originConfig.ssoKey, token, origin },
        json: true
    }
    try {
        let res = await rp(options)
        Log.debug("res", res)
        if (!res)
            throw new Error.SystemError("ValidateTokenFail",
                "Failed to Validate Token")

        let userId = res.userId
        let user = await EntityService.aFindOneById({}, 'F_User', userId)

        let session = await UserService.aSignInSuccessfully(origin, user)

        // TODO 把设置本机登录 Cookies 的放在一处
        ctx.cookies.set('UserId', session.userId,
            { signed: true, httpOnly: true })
        ctx.cookies.set('UserToken', session.userToken,
            { signed: true, httpOnly: true })

        ctx.redirect(callback)
    } catch (e) {
        Log.system.error(e, "Failed to validate SSO token")
        throw e
    }
}
