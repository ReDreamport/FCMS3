const bunyan = require('bunyan')

exports.debug = true // TODO 远程开关

exports.config = function (config) {
    let logConfigs = config.log || {}
    logConfigs.system = logConfigs.system || { name: "system", level: "trace" }
    for (let name in logConfigs) {
        let config = logConfigs[name]
        exports[name] = bunyan.createLogger(config)
    }
}

exports.debug = function () {
    exports.system.debug.apply(exports.system, arguments)
}
