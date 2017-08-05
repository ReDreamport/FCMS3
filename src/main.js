const moment = require('moment')
moment.locale("zh-cn")

const Log = require('./Log')
const Config = require('./Config')

const Mongo = require('./storage/Mongo')
const Mysql = require('./storage/Mysql')
const Redis = require('./storage/Redis')

const WebServer = require('./web/WebServer')

let webStarted = false

exports.start = function (appConfig, addRouteRules) {
    process.on('SIGINT', onProcessTerm)
    process.on('SIGTERM', onProcessTerm)

    return aStart(appConfig, addRouteRules).catch(function (e) {
        Log.system.error(e, 'Fail to start')
        stop()
    })
}

async function aStart(appConfig, addRouteRules) {
    "use strict"
    Object.assign(Config, appConfig)
    Log.config(Config)

    console.log("\n\n\n\n\n")
    Log.system.info('Starting FCMS...')

    // 持久层初始化
    Mongo.init()
    Mysql.init()

    if (Config.cluster) await Redis.aInit()

    // 元数据
    const Meta = require('./Meta')
    await Meta.aLoad()

    // 初始化数据库结构、索引
    const MongoIndex = require('./storage/MongoIndex')
    await MongoIndex.aSyncWithMeta()

    if (Mysql.mysql) {
        let RefactorMysqlTable = require('./storage/RefactorMysqlTable')
        await RefactorMysqlTable.aSyncSchema(exports.mysql)
        let MysqlIndex = require('./storage/MysqlIndex')
        await MysqlIndex.aSyncWithMeta(exports.mysql)
    }

    // 用户
    const UserService = require('./security/UserService')
    UserService.init()

    //
    await require('./SystemInit').aInit()

    // 路由表
    const router = require('./web/Router')
    const rrr = new router.RouteRuleRegisters(Config.urlPrefix, Config.errorCatcher)

    const CommonRouterRules = require('./web/CommonRouterRules')
    CommonRouterRules.addCommonRouteRules(rrr)
    addRouteRules && addRouteRules(rrr)

    Log.system.info('Starting the web server...')
    await WebServer.aStart()
    webStarted = true
    Log.system.info('Web server started!')
}

async function aStop() {
    Log.system.info('Disposing all other resources...')

    // TODO await require('./service/PromotionService').aPersist()

    if (Config.cluster) await Redis.aDispose()

    await Mongo.aDispose()
    await Mysql.aDispose()

    Log.system.info("ALL CLOSED!\n\n")
}

function stop() {
    return aStop().catch(function (e) {
        Log.system.error(e, 'stop')
    })
}

function onProcessTerm() {
    console.log("\n\n\n\n\n")
    Log.system.info("The process terminating...")

    if (webStarted) {
        Log.system.info("Closing web server firstly...")
        // 先等待服务器关闭，再关闭 Mongo 等
        WebServer.stop(stop)
    } else {
        stop()
    }
}