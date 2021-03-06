const _ = require("lodash")

// const Log = require('../Log')
const Errors = require("../Errors")
const Meta = require("../Meta")
const Util = require("../Util")

const Service = require("../service/EntityService")
const {aWithTransaction, aWithoutTransaction} = Service
const Interceptor = require("./EntityInterceptor")
const {Create, Update, Remove, Get, List} = Interceptor.Actions

const Cache = require("../cache/Cache")

exports.aCreateEntity = async function(ctx) {
    let entityName = ctx.params.entityName

    let instance = ctx.request.body
    if (!instance) throw new Errors.UserError("EmptyOperation")

    let r = await exports._aCreateEntity(ctx, entityName, instance)

    ctx.body = {id: r._id}
}

exports.aCreateEntitiesInBatch = async function(ctx) {
    let entityName = ctx.params.entityName
    let ignoreError = Util.stringToBoolean(ctx.query.ignore)

    let instances = ctx.request.body
    if (!(instances && _.isArray(instances) && instances.length))
        throw new Errors.UserError("EmptyOperation")

    let promises = _.map(instances, async i => {
        try {
            let r = await exports._aCreateEntity(ctx, entityName, i)
            return r._id
        } catch (e) {
            if (ignoreError)
                return null
            else
                throw e
        }
    })

    ctx.body = await Promise.all(promises)
}

exports._aCreateEntity = async function(ctx, entityName, instance) {
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")
    if (entityMeta.noCreate) throw new Errors.UserError("CreateNotAllow")

    instance = Meta.parseEntity(instance, entityMeta)
    exports.removeNoCreateFields(entityMeta, ctx.state.user, instance)

    let fieldCount = 0
    for (let key in instance) {
        let value = instance[key]
        if (_.isNull(value))
            delete instance[key]
        else
            fieldCount++
    }
    if (!fieldCount) throw new Errors.UserError("EmptyOperation")

    let operator = ctx.state.user
    instance._createdBy = operator && operator._id

    let ai = Interceptor.getInterceptor(entityName, Create)

    let r = await aWithTransaction(entityMeta, async conn =>
        ai(conn, instance, operator, async() =>
            Service.aCreate(conn, entityName, instance)))

    return {id: r._id}
}

exports.aUpdateEntityById = async function(ctx) {
    let entityName = ctx.params.entityName
    await exports._aUpdateEntityById(ctx,
        entityName, ctx.params.id, ctx.request.body)
    ctx.status = 204
}

exports._aUpdateEntityById = async function(ctx, entityName, _id, instance) {
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")
    if (entityMeta.noEdit) throw new Errors.UserError("EditNotAllow")

    _id = Meta.parseId(_id, entityMeta)
    let criteria = {_id}

    instance = Meta.parseEntity(instance, entityMeta)
    exports.removeNoEditFields(entityMeta, ctx.state.user, instance)

    let operator = ctx.state.user
    instance._modifiedBy = operator && operator._id

    let ai = Interceptor.getInterceptor(entityName, Update)

    await aWithTransaction(entityMeta, async conn =>
        ai(conn, instance, operator, criteria, async() =>
            Service.aUpdateOneByCriteria(conn, entityName, criteria, instance)))
}

exports.aUpdateEntityInBatch = async function(ctx) {
    let entityName = ctx.params.entityName
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")
    if (entityMeta.noEdit) throw new Errors.UserError("EditNotAllow")

    let patch = ctx.request.body

    let idStrings = patch.ids
    delete patch.ids
    if (!(idStrings && idStrings.length > 0))
        throw new Errors.UserError("EmptyOperation")
    let ids = Meta.parseIds(idStrings)
    if (!(ids && ids.length > 0)) throw new Errors.UserError("EmptyOperation")

    patch = Meta.parseEntity(patch, entityMeta)
    exports.removeNoEditFields(entityMeta, ctx.state.user, patch)

    let operator = ctx.state.user
    patch._modifiedBy = operator && operator._id

    let ai = Interceptor.getInterceptor(entityName, Update)

    await aWithTransaction(entityMeta, async conn => {
        for (let id of ids) {
            let criteria = {_id: id}
            await ai(conn, patch, operator, criteria, async() =>
                Service.aUpdateOneByCriteria(conn, entityName, criteria, patch))
        }
    })

    ctx.status = 204
}

exports.aDeleteEntityInBatch = async function(ctx) {
    let entityName = ctx.params.entityName
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")
    if (entityMeta.noDelete) throw new Errors.UserError("DeleteNotAllow")

    let ids = ctx.query && ctx.query._ids
    if (!ids) return ctx.status = 400

    ids = Util.splitString(ids, ",")
    ids = Meta.parseIds(ids, entityMeta)
    if (!ids.length > 0) throw new Errors.UserError("EmptyOperation")

    let criteria = {
        __type: "relation", relation: "and",
        items: [{field: "_id", operator: "in", value: ids}]
    }

    let operator = ctx.state.user
    let ai = Interceptor.getInterceptor(entityName, Remove)

    await aWithTransaction(entityMeta, async conn =>
        ai(conn, null, operator, criteria, async() =>
            Service.aRemoveManyByCriteria(conn, entityName, criteria)))

    ctx.status = 204
}

exports.aRecoverInBatch = async function(ctx) {
    let entityName = ctx.params.entityName
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")

    let req = ctx.request.body || {}
    let ids = req.ids
    if (!(ids && ids.length > 0)) throw new Errors.UserError("EmptyOperation")

    ids = Meta.parseIds(ids, entityMeta)
    if (!ids.length > 0) throw new Errors.UserError("EmptyOperation")

    await aWithTransaction(entityMeta, async conn =>
        Service.aRecoverMany(conn, entityName, ids))

    ctx.status = 204
}

exports.aFindOneById = async function(ctx) {
    let entity = await exports._aFindOneById(ctx,
        ctx.params.entityName, ctx.params.id)

    if (entity) {
        ctx.body = entity
    } else {
        ctx.status = 404
    }
}

exports._aFindOneById = async function(ctx, entityName, id) {
    let entityMeta = Meta.getEntityMeta(entityName)

    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")

    let _id = Meta.parseId(id, entityMeta)
    if (!_id) return ctx.status = 404

    let ai = Interceptor.getInterceptor(entityName, Get)
    let operator = ctx.state.user

    let criteria = {_id}

    let repo = ctx.query && ctx.query._repo

    let entity = await aWithoutTransaction(entityMeta, async conn =>
        ai(conn, criteria, operator, async() =>
            Service.aFindOneByCriteria(conn, entityName, criteria, {repo})))

    if (entity) {
        exports.removeNotShownFields(entityMeta, ctx.state.user, entity)
        entity = Meta.formatEntityToHttp(entity, entityMeta)
        ctx.body = entity
    }

    return entity
}

exports.aList = async function(ctx) {
    let entityName = ctx.params.entityName

    let r = await exports._aList(ctx, entityName, null)

    ctx.body = r
}

exports._aList = async function(ctx, entityName, queryModifier) {
    let entityMeta = Meta.getEntityMeta(entityName)
    if (!entityMeta) throw new Errors.UserError("NoSuchEntity")

    let query = exports.parseListQuery(entityMeta, ctx.query)
    if (queryModifier) queryModifier(query)

    let ai = Interceptor.getInterceptor(entityName, List)
    let operator = ctx.state.user

    let r = await aWithoutTransaction(entityMeta, async conn =>
        ai(conn, query, operator, async() =>
            Service.aList(conn, entityName, query)))

    let page = r.page
    exports.removeNotShownFields(entityMeta, ctx.state.user, ...page)

    r.page = _.map(page, i => Meta.formatEntityToHttp(i, entityMeta))

    r.pageNo = query.pageNo
    r.pageSize = query.pageSize

    return r
}

exports.parseListQuery = function(entityMeta, query) {
    if (!query) return {}
    let criteria, sort
    let includedFields = Util.splitString(query._includedFields, ",")

    let digest = query._digest === "true"
    if (digest)
        if (entityMeta.digestFields) { // "username|email,admin"
            let fs = []
            let fields = entityMeta.digestFields.split(",")
            for (let field of fields) fs = fs.concat(field.split("|"))
            includedFields = fs
        } else {
            includedFields = ["_id"]
        }

    let pageNo = Util.stringToInt(query._pageNo, 1)
    let pageSize = Util.stringToInt(query._pageSize, (digest && -1 || 20))
    if (pageSize > 200) pageSize = 200 // TODO 控制量

    // 整理筛选查询条件
    let fastFilter = query._filter
    if (fastFilter) {
        let orList = []
        orList.push({field: "_id", operator: "==", value: fastFilter})

        for (let fieldName in entityMeta.fields) {
            let fieldMeta = entityMeta.fields[fieldName]
            if (fieldMeta.asFastFilter) orList.push({
                field: fieldName,
                operator: "contain",
                value: fastFilter
            })
        }
        criteria = {__type: "relation", relation: "or", items: orList}
    } else {
        if (query._criteria) {
            try {
                criteria = JSON.parse(query._criteria)
            } catch (e) {
                throw new Errors.UserError("BadQueryCriteria")
            }
        } else {
            let criteriaList = []
            for (let key in query) {
                let value = query[key]
                if (entityMeta.fields[key]) criteriaList.push({
                    field: key,
                    operator: "==",
                    value: value
                })
            }

            criteria = criteriaList.length ? {
                __type: "relation",
                relation: "and",
                items: criteriaList
            } : null
        }

        if (criteria) {
            Meta.parseListQueryValue(criteria, entityMeta)
            criteria.__type = "relation"
        }
    }

    // Log.debug('criteria', criteria)

    // 整理排序所用字段
    if (query._sort) {
        try {
            sort = JSON.parse(query._sort)
        } catch (e) {
            sort = null
        }
    } else {
        let sortBy = query._sortBy || "_modifiedOn"
        let sortOrder = query._sortOrder === "asc" ? 1 : -1
        sort = {[sortBy]: sortOrder}
    }

    return {
        repo: query._repo,
        criteria,
        includedFields,
        sort,
        pageNo,
        pageSize
    }
}

exports.aSaveFilters = async function(ctx) {
    let entityMeta = Meta.getEntityMeta("F_ListFilters")

    let req = ctx.request.body
    if (!req) return ctx.status = 400

    let instance = Meta.parseEntity(req, entityMeta)

    let criteria = {name: instance.name, entityName: instance.entityName}
    let includedFields = ["_id", "_version"]

    let lf = await Service.aFindOneByCriteria({}, "F_ListFilters",
        criteria, {includedFields})
    if (lf)
        await Service.aUpdateOneByCriteria({}, "F_ListFilters", {
            _id: lf._id,
            _version: lf._version
        }, instance)
    else
        await Service.aCreate({}, "F_ListFilters", instance)

    ctx.status = 204
}

exports.aRemoveFilters = async function(ctx) {
    let query = ctx.query
    if (!(query && query.name && query.entityName)) return ctx.status = 400

    await Service.aRemoveManyByCriteria({}, "F_ListFilters", {
        name: query.name,
        entityName: query.entityName
    })

    ctx.status = 204
}

// 过滤掉不显示的字段
exports.removeNotShownFields = function(entityMeta, user, ...entities) {
    if (!(entities && entities.length)) return

    let fields = entityMeta.fields

    let removedFieldNames = []
    for (let fieldName in fields) {
        let fieldMeta = fields[fieldName]
        if (fieldMeta.type === "Password")
            removedFieldNames.push(fieldName)
        else if (fieldMeta.notShow &&
            !Util.isUserOrRoleHasFieldAction(user,
                entityMeta.name, fieldName, "show")) {
            removedFieldNames.push(fieldName)
        }
    }

    if (!removedFieldNames.length) return

    for (let e of entities) {
        if (!e) continue
        for (let field of removedFieldNames) delete e[field]
    }
}

// 过滤掉不允许创建的字段
exports.removeNoCreateFields = function(entityMeta, user, entity) {
    if (!entity) return

    let fields = entityMeta.fields

    let removedFieldNames = []
    for (let fieldName in fields) {
        let fieldMeta = fields[fieldName]
        if (fieldMeta.noCreate &&
            !Util.isUserOrRoleHasFieldAction(user,
                entityMeta.name, fieldName, "create")) {
            removedFieldNames.push(fieldName)
        }
    }

    if (!removedFieldNames.length) return

    for (let field of removedFieldNames) delete entity[field]
}

// 过滤掉不允许编辑的字段
exports.removeNoEditFields = function(entityMeta, user, entity) {
    if (!entity) return

    let fields = entityMeta.fields

    let removedFieldNames = []
    for (let fieldName in fields) {
        let fieldMeta = fields[fieldName]
        if ((fieldMeta.noEdit || fieldMeta.editReadonly) &&
            !Util.isUserOrRoleHasFieldAction(user,
                entityMeta.name, fieldName, "edit")) {
            removedFieldNames.push(fieldName)
        }
    }

    if (!removedFieldNames.length) return

    for (let field of removedFieldNames) delete entity[field]
}

exports.aViewMemoryCache = async function(ctx) {
    ctx.body = require("../cache/MemoryCache").cache
}

exports.aClearAllCache = async function(ctx) {
    await Cache.aClearAllCache()
    ctx.status = 204
}
