const Config = require('../Config')

const pugLocals = {}
exports.pugLocals = pugLocals

const Pug = require('koa-pug')
const pug = new Pug({viewPath: Config.serverPugPath, locals: pugLocals, noCache: process.env.DEV === '1'})
exports.jade = pug