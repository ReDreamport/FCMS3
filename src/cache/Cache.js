const Config = require('../Config')
const Log = require('../Log')

if (Config.cluster)
    module.exports = require('./RedisCache')
else
    module.exports = require('./MemoryCache')