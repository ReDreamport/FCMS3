// 菜单权限、按钮权限、端点权限、实体权限（增删改查）、字段权限（读、填、改）

const Util = require('../Util')

exports.permissionArrayToMap = function (acl) {
    if (!acl) return acl
    acl.menu = Util.arrayToTrueObject(acl.menu)
    acl.button = Util.arrayToTrueObject(acl.button)
    acl.action = Util.arrayToTrueObject(acl.action)

    if (acl.entity) {
        let entities = acl.entity
        _.forEach(entities, (entityName, v) => entities[entityName] = Util.arrayToTrueObject(v))
    }
    if (acl.field) {
        let entities = acl.field
        _.forEach(entities, (entityName, e) => {
            _.forEach(e, (fieldName, field) => field && (e[fieldName] = Util.arrayToTrueObject(field)))
        })
    }
}