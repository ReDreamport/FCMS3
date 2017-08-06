const Log = require('../Log')
const Error = require('../Error')
const Config = require('../Config')

const UserService = require('../security/UserService')

exports.aIdentifyUser = async function (ctx, next) {
    // Log.debug("originalUrl", ctx.request.originalUrl)
    // Log.debug("url", ctx.request.url)
    // Log.debug("origin", ctx.request.origin)
    // Log.debug("href", ctx.request.href)
    // Log.debug("host", ctx.request.host)
    // Log.debug("hostname", ctx.request.hostname)
    // Log.debug("URL", ctx.request.URL)
    // Log.debug("ip", ctx.request.ip)
    // Log.debug("ips", ctx.request.ips)

    let originConfig = Config.originConfigs[ctx.request.origin]
    if (!originConfig) throw new Error.UserError("BadOrigin", "BadOrigin")

    ctx.state.trackId = ctx.cookies.get('TID', { signed: true })

    let userId = ctx.cookies.get('UserId', { signed: true })
    let userToken = ctx.cookies.get('UserToken', { signed: true })
    let origin = ctx.request.origin

    if (userId && userToken)
        try {
            let user = await UserService.aAuthToken(origin, userId, userToken)
            // Log.debug('auth token: ', user)
            if (user) ctx.state.user = user
        } catch (e) {
            return false
        }

    await next()
}

exports.aControlAccess = async function (ctx, next) {
    let pass = await aCheckAll(ctx)
    if (!pass)
        throw ctx.state.user ? new Error.Error403() : new Error.Error401()
    await next()
}

async function aCheckAll(httpCtx) {
    let route = httpCtx.route
    let state = httpCtx.state

    let ri = route.info
    if (!(ri.auth || ri.action)) return true // 明确表示不需要登录直接返回 true

    if (state.user && state.user.admin) return true // admin 跳过一切权限

    if (ri.action) {
        // 有指定权限的
        return await aCheckUserHasAction(state.user, ri.action)
    } else if (ri.auth) {
        // 只要登录即可，无权限
        return !!state.user
    } else {
        let aAuthHandler = authHandlers[ri.auth]
        if (!aAuthHandler) {
            Log.system.error('No auth handler for ' + ri.auth)
            return false
        }

        await aAuthHandler(httpCtx)
    }
}

// 检查用户是否有固定权限
async function aCheckUserHasAction(user, action) {
    if (!user) return false

    if (user.acl && user.acl.action && user.acl.action[action]) return true

    let roles = user.roles
    if (roles)
        for (let roleId of roles) {
            let role = await UserService.aRoleById(roleId)
            if (role && role.acl && role.acl.action && role.acl.action[action])
                return true
        }
    return false
}

const authHandlers = {
    async listEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user, 'List',
            httpCtx.params.entityName)
    },
    async getEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user, 'Get',
            httpCtx.params.entityName)
    },
    async createEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user, 'Create',
            httpCtx.params.entityName)
    },
    async updateOneEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user,
            'UpdateOne', httpCtx.params.entityName)
    },
    async updateManyEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user,
            'UpdateMany', httpCtx.params.entityName)
    },
    async removeEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user, 'Remove',
            httpCtx.params.entityName)
    },
    async recoverEntity(httpCtx) {
        return await aCheckUserHasEntityAction(httpCtx.state.user,
            'Recover', httpCtx.params.entityName)
    }
}

async function aCheckUserHasEntityAction(user, action, entityName) {
    if (user) {
        let entityAcl = user.acl && user.acl.entity &&
            user.acl.entity[entityName]
        if (entityAcl && (entityAcl['*'] || entityAcl[action])) return true

        let roles = user.roles
        if (roles)
            for (let roleId of roles) {
                let role = await UserService.aRoleById(roleId)
                if (role) {
                    let entityAcl = role && role.acl && role.acl.entity &&
                        role.acl.entity[entityName]
                    if (entityAcl && (entityAcl['*'] || entityAcl[action]))
                        return true
                }
            }
    } else {
        let role = await UserService.aGetAnonymousRole()
        if (role) {
            let entityAcl = role.acl && role.acl.entity &&
                role.acl.entity[entityName]
            if (entityAcl && (entityAcl['*'] || entityAcl[action])) return true
        }
    }
    return false
}
