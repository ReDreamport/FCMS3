const Promise = require('bluebird')

const Log = require('../Log')
const Error = require('../Error')
const Config = require('../Config')

const Extension = require('../Extension')

let server = null

exports.aStart = async function () {
    let Koa = require('koa')
    let koaServer = new Koa()
    koaServer.keys = [Config.cookieKey]
    koaServer.proxy = true

    // pug
    let Pug = require('./Pug')
    Pug.pug.use(koaServer)

    let Router = require('./Router')
    Router.refresh()

    koaServer.use(Router.aParseRoute)

    koaServer.use(aCatchError) // 匹配路由的过程不需要拦截错误

    let ac = require('../handler/AccessController')
    koaServer.use(ac.aIdentifyUser)
    koaServer.use(ac.aControlAccess)

    // 控制访问之后再解析正文
    let koaBody = require('koa-body')
    let formidableConfig = {
        uploadDir: Config.uploadPath,
        keepExtensions: true,
        maxFieldsSize: Config.httpBodyMaxFieldsSize
    }
    koaServer.use(koaBody({ multipart: true, formidable: formidableConfig }))

    if (Extension.aKoaMiddlewareBeforeHandler)
        koaServer.use(Extension.aKoaMiddlewareBeforeHandler)

    koaServer.use(Router.aHandleRoute) // 开始处理路由

    server = require('http').createServer(koaServer.callback())

    server.on('error', (err) => Log.system.error(err, 'Error on server!'))

    let enableDestroy = require('server-destroy')
    enableDestroy(server)

    await Promise.promisify(server.listen.bind(server))(Config.serverPort)
}

exports.stop = function (stopOther) {
    if (server) {
        server.on('close', () => stopOther())
        server.destroy()
    } else {
        stopOther()
    }
}

async function aCatchError(ctx, next) {
    let routeInfo = ctx.route.info || {}
    let aErrorCatcher = routeInfo.aErrorCatcher
    if (aErrorCatcher)
        await aErrorCatcher(ctx, next)
    else
        try {
            await next()
        } catch (e) {
            if (e instanceof Error.Error401) {
                ctx.status = 401
                if (routeInfo.isPage) {
                    let len = Config.urlPrefix.length + 1
                    let url = ctx.request.originalUrl.substring(len)
                    ctx.redirect('sign-in?callback=' + encodeURIComponent(url))
                } else {
                    ctx.body = e.describe()
                }
            } else if (e instanceof Error.Error403) {
                ctx.status = 403
                ctx.body = e.describe()
            } else if (e instanceof Error.UserError) {
                ctx.status = 400
                ctx.body = e.describe()
            } else {
                ctx.status = 500
                Log.system.error(e, e.message, 'catch all')
            }
        }
}
