const bunyan = require('bunyan')

exports.debug = true // TODO 远程开关

exports.config = function (config) {
    let logConfig = config.log && config.log.system
        || { name: "system", level: "trace" }
    exports.system = bunyan.createLogger(logConfig)
}

exports.debug = function () {
    exports.system.debug.apply(exports.system, arguments)
}
