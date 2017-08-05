const _ = require('lodash')
const Promise = require('bluebird')

const Log = require('../Log')

let cache = {}
exports.cache = cache

async function aGet(keysArray, alternative) {
    let r = await Promise.resolve(_.get(cache, keysArray) || alternative)
    // Log.debug('get memory cache', keysArray)
    return r
}

async function aSet(keysArray, value) {
    // Log.debug('set memory cache', keysArray)
    await Promise.resolve(_.set(cache, keysArray, value))
}

exports.aGetString = aGet
exports.aSetString = aSet

exports.aGetCachedString = aGet
exports.aSetCachedString = aSet

exports.aGetObject = aGet
exports.aSetObject = aSet

// keysArray, lastKeys 都是数组
// 例如 aUnset(["a","b"],["1","2"] 可以删除键 "a.b.1" 和 "a.b.2"
exports.aUnset = async function (keysArray, lastKeys) {
    // Log.debug('unset memory cache', keys, lastKeys)
    if (lastKeys && lastKeys.length) {
        let keys = _.clone(keysArray)
        let keysLength = keys.length
        for (let lastKey of lastKeys) {
            keys[keysLength] = lastKey
            _.unset(cache, keys)
        }
    } else {
        _.unset(cache, keysArray)
    }
}

exports.aClearAllCache = async function () {
    Log.system.info("clear all cache / memory")
    cache = {}
    exports.cache = cache

}