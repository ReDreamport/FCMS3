const _ = require("lodash")

exports.Actions = {
    Create: "Create",
    Update: "Update",
    Remove: "Remove",
    Get: "Get",
    List: "List"
}

async function defaultInterceptor() {
    let aFunc = arguments[arguments.length - 1]
    return aFunc()
}

const interceptors = {}

exports.setInterceptor = function(entityName, actions, asyncInterceptor) {
    if (!_.isArray(actions)) actions = [actions]

    interceptors[entityName] = interceptors[entityName] || {}
    for (let action of actions)
        interceptors[entityName][action] = asyncInterceptor
}

exports.getInterceptor = function(entityName, action) {
    let icts = interceptors[entityName]
    return icts && icts[action] || defaultInterceptor
}
