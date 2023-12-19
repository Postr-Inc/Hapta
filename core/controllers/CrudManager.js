"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var server_1 = require("../../server");
var CrudManager = /** @class */ (function () {
    function CrudManager(pb, Config, tokenManager) {
        this.pb = pb;
        this.Config = Config;
        this.tokenManager = tokenManager;
        this.subscriptions = new Map();
    }
    CrudManager.prototype.list = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, collection, limit, offset, filter, sort, expand, returnable, _b, res, newItems, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = data.data, collection = _a.collection, limit = _a.limit, offset = _a.offset, filter = _a.filter, sort = _a.sort, expand = _a.expand, returnable = _a.returnable;
                        _b = true;
                        switch (_b) {
                            case collection === "authState" || collection === "devAuthState": return [3 /*break*/, 2];
                            case !collection: return [3 /*break*/, 3];
                            case !data.token: return [3 /*break*/, 4];
                            case limit && typeof limit !== "number": return [3 /*break*/, 5];
                            case offset && typeof offset !== "number": return [3 /*break*/, 6];
                            case filter && typeof filter !== "string": return [3 /*break*/, 7];
                            case sort && typeof sort !== "string": return [3 /*break*/, 8];
                            case expand && !Array.isArray(expand): return [3 /*break*/, 9];
                            case returnable && !Array.isArray(returnable): return [3 /*break*/, 10];
                        }
                        return [4 /*yield*/, this.tokenManager.isValid(data.token, true)];
                    case 1:
                        switch (_b) {
                            case !(_c.sent()): return [3 /*break*/, 11];
                        }
                        return [3 /*break*/, 12];
                    case 2: return [2 /*return*/, { error: true, message: null, key: data.key }];
                    case 3: return [2 /*return*/, {
                            error: true,
                            message: "collection name is required",
                            key: data.key,
                        }];
                    case 4: return [2 /*return*/, {
                            error: true,
                            message: "client auth token is required",
                            key: data.key,
                        }];
                    case 5: return [2 /*return*/, {
                            error: true,
                            message: "limit must be a number",
                            key: data.key,
                        }];
                    case 6: return [2 /*return*/, { error: true, message: "page must be a number", key: data.key }];
                    case 7: return [2 /*return*/, {
                            error: true,
                            message: "filter must be a string",
                            key: data.key,
                        }];
                    case 8: return [2 /*return*/, { error: true, message: "sort must be a string", key: data.key }];
                    case 9: return [2 /*return*/, {
                            error: true,
                            message: "expand must be an array",
                            key: data.key,
                        }];
                    case 10: return [2 /*return*/, {
                            error: true,
                            message: "returnable must be an array",
                            key: data.key,
                        }];
                    case 11: return [2 /*return*/, { error: true, message: "Invalid token", key: data.key }];
                    case 12:
                        _c.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, server_1.pb.admins.client
                                .collection(collection)
                                .getList(offset, limit, {
                                filter: filter || "",
                                sort: sort || "",
                                expand: expand || [],
                            })];
                    case 13:
                        res = _c.sent();
                        collection === "users" && res.items.length > 0 && res.items.forEach(function (item) {
                            if (item.emailVisibility === false)
                                delete item.email;
                        });
                        newItems = res.items.map(function (item) {
                            var newRecord = {
                                id: item.id,
                                expand: {},
                            };
                            if (item.expand && Object.keys(item.expand).length > 0) {
                                Object.keys(item.expand).forEach(function (key) {
                                    Object.keys(item.expand[key]).forEach(function (key2) {
                                        key2 === 'email' && item.expand[key]['emailVisibility'] === false ? delete item.expand[key]['email'] : null;
                                        if (returnable && returnable.includes(key2)) {
                                            newRecord.expand[key2] = item.expand[key][key2];
                                        }
                                        newRecord.expand[key2] = item.expand[key][key2];
                                    });
                                });
                            }
                            Object.keys(item).forEach(function (key) {
                                if (returnable && returnable.includes(key)) {
                                    newRecord[key] = item[key];
                                }
                                newRecord[key] = item[key];
                            });
                            return newRecord;
                        });
                        res.items = newItems;
                        return [2 /*return*/, { error: false, key: data.key, data: res }];
                    case 14:
                        error_1 = _c.sent();
                        return [2 /*return*/, { error: true, message: error_1.message, key: data.key }];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.subscribe = function (data, msg) {
        return __awaiter(this, void 0, void 0, function () {
            var collection, key, event, returnable, _a, _b, error_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        collection = data.collection, key = data.key, event = data.event, returnable = data.returnable;
                        _a = true;
                        switch (_a) {
                            case collection === "authState" || collection === "devAuthState": return [3 /*break*/, 3];
                        }
                        _b = !data.token;
                        if (_b) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.tokenManager.isValid(data.token, true)];
                    case 1:
                        _b = !(_c.sent());
                        _c.label = 2;
                    case 2:
                        switch (_a) {
                            case _b: return [3 /*break*/, 4];
                            case !data.collection: return [3 /*break*/, 5];
                            case !data.id: return [3 /*break*/, 6];
                            case !data.key: return [3 /*break*/, 7];
                            case returnable && !Array.isArray(returnable): return [3 /*break*/, 8];
                        }
                        return [3 /*break*/, 9];
                    case 3:
                        msg({ error: true, message: null });
                        _c.label = 4;
                    case 4:
                        msg({ error: true, message: "Invalid token" });
                        _c.label = 5;
                    case 5:
                        msg({ error: true, message: "collection is required" });
                        _c.label = 6;
                    case 6:
                        msg({ error: true, message: "record id is required" });
                        _c.label = 7;
                    case 7:
                        msg({ error: true, message: "key is required" });
                        _c.label = 8;
                    case 8:
                        msg({ error: true, message: "returnable must be an array", from: "subscribe" });
                        _c.label = 9;
                    case 9:
                        _c.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, this.pb.admins.client
                                .collection(data.collection)
                                .subscribe(data.id, function (data) {
                                var newRecord = {
                                    id: data.record.id,
                                };
                                // Iterate over each key in res
                                if (data.collection === 'users' && data.record.emailVisibility === false) {
                                    delete data.record.email;
                                }
                                newRecord = data.record;
                                event == data.record.action ? msg({
                                    type: "subscription",
                                    key: key,
                                    data: newRecord,
                                    event: data.action,
                                }) : null;
                            })];
                    case 10:
                        _c.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        error_2 = _c.sent();
                        console.log(error_2);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.unsubscribe = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case !data.collection: return [3 /*break*/, 1];
                            case !data.id: return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 3];
                    case 1: return [2 /*return*/, {
                            error: true,
                            message: "collection is required",
                        }];
                    case 2: return [2 /*return*/, {
                            error: true,
                            message: "id is required",
                        }];
                    case 3: return [4 /*yield*/, this.pb.admins.client
                            .collection(data.collection)
                            .unsubscribe(data.id)];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.read = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, idFromToken, res_1, newRecord_1, _loop_1, k, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case !data.collection ||
                                data.collection === "authState" ||
                                data.collection === "devAuthState": return [3 /*break*/, 1];
                            case !data.id: return [3 /*break*/, 2];
                            case data.returnable && !Array.isArray(data.returnable): return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 4];
                    case 1: return [2 /*return*/, {
                            error: true,
                            message: "Valid collection is required",
                        }];
                    case 2: return [2 /*return*/, {
                            error: true,
                            message: "id is required",
                        }];
                    case 3: return [2 /*return*/, {
                            error: true,
                            message: "returnable must be an array",
                        }];
                    case 4:
                        idFromToken = this.tokenManager.decode(data.token).id;
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.pb.admins.client
                                .collection(data.collection)
                                .getOne(data.id, {
                                expand: data.expand || [],
                            })];
                    case 6:
                        res_1 = _b.sent();
                        // Modify data based on specific conditions
                        if (data.collection === "users" &&
                            idFromToken !== data.id &&
                            res_1.emailVisibility === false) {
                            delete res_1.email;
                        }
                        // Check for expand and returnable arrays
                        if (data.expand &&
                            Array.isArray(data.expand) &&
                            ((data.returnable && Array.isArray(data.returnable)) ||
                                (data.expand && !data.returnable))) {
                            newRecord_1 = {
                                id: res_1.id,
                                expand: {},
                            };
                            _loop_1 = function (k) {
                                Object.keys(res_1.expand[k]).forEach(function (key) {
                                    if (data.returnable.includes(key)) {
                                        newRecord_1.expand[key] = res_1.expand[k][key];
                                        // Handle specific condition for 'emailVisibility'
                                        if (res_1.expand[k][key].email &&
                                            res_1.expand[k][key].emailVisibility === false) {
                                            delete newRecord_1.expand[key].email;
                                        }
                                    }
                                });
                            };
                            // Iterate over each key in res.expand
                            for (k in res_1.expand) {
                                _loop_1(k);
                            }
                            // Iterate over each key in res
                            Object.keys(res_1).forEach(function (key) {
                                // Only keep keys that are in the returnable array
                                if (data.returnable.includes(key)) {
                                    newRecord_1[key] = res_1[key];
                                }
                            });
                            return [2 /*return*/, { error: false, key: data.key, data: newRecord_1 }];
                        }
                        else {
                            // If no modifications are needed, return the original item
                            return [2 /*return*/, { error: false, key: data.key, data: res_1 }];
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_3 = _b.sent();
                        global.shouldLog && console.log(error_3);
                        return [2 /*return*/, { error: true, message: error_3.message, key: data.key }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.create = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, res, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case data.collection === 'authState' || data.collection.includes('authState'): return [3 /*break*/, 1];
                            case !data.collection: return [3 /*break*/, 2];
                            case !data.record: return [3 /*break*/, 3];
                            case !data.token && data.collection !== 'users' || !this.tokenManager.isValid(data.token): return [3 /*break*/, 4];
                        }
                        return [3 /*break*/, 5];
                    case 1: return [2 /*return*/, { error: true, message: null, key: data.key }];
                    case 2: return [2 /*return*/, { error: true, message: 'collection name is required', key: data.key }];
                    case 3: return [2 /*return*/, { error: true, message: 'record data is required', key: data.key }];
                    case 4: return [2 /*return*/, { error: true, message: 'Invalid token', key: data.key }];
                    case 5:
                        _b.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.pb.admins.client.collection(data.collection).create(data.record)];
                    case 6:
                        res = _b.sent();
                        return [2 /*return*/, { error: false, key: data.key, data: res }];
                    case 7:
                        error_4 = _b.sent();
                        return [2 /*return*/, { error: true, message: error_4.message, key: data.key }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.update = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, i, array, blob, res, error_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case data.collection === 'authState' || data.collection.includes('authState'): return [3 /*break*/, 2];
                            case !data.collection: return [3 /*break*/, 3];
                            case !data.id: return [3 /*break*/, 4];
                            case !data.token: return [3 /*break*/, 5];
                            case data.collection === 'users' && this.tokenManager.decode(data.token).id !== data.id: return [3 /*break*/, 6];
                        }
                        return [4 /*yield*/, this.tokenManager.isValid(data.token, true)];
                    case 1:
                        switch (_a) {
                            case !(_b.sent()): return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [2 /*return*/, { error: true, message: null, key: data.key }];
                    case 3: return [2 /*return*/, { error: true, message: 'collection name is required', key: data.key }];
                    case 4: return [2 /*return*/, { error: true, message: 'record id is required', key: data.key }];
                    case 5: return [2 /*return*/, { error: true, message: 'client auth token is required', key: data.key }];
                    case 6: return [2 /*return*/, { error: true, message: 'You are not authorized to perform this action', key: data.key }];
                    case 7: return [2 /*return*/, { error: true, message: 'Invalid token', key: data.key }];
                    case 8:
                        _b.trys.push([8, 10, , 11]);
                        for (i in data.data) {
                            if (data.data[i].isFile && data.data[i].file) {
                                array = new Uint8Array(data.data[i].file);
                                blob = new Blob([array], { type: data.data[i].type });
                                data.data[i] = new File([blob], data.data[i].name, { type: data.data[i].type });
                            }
                        }
                        return [4 /*yield*/, this.pb.admins.client.collection(data.collection).update(data.id, data.data)];
                    case 9:
                        res = _b.sent();
                        return [2 /*return*/, { error: false, key: data.key, data: res }];
                    case 10:
                        error_5 = _b.sent();
                        return [2 /*return*/, { error: true, message: error_5.message, key: data.key }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    CrudManager.prototype.delete = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_6;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case data.collection === 'authState' || data.collection.includes('authState'): return [3 /*break*/, 2];
                        }
                        return [4 /*yield*/, this.tokenManager.isValid(data.token, true)];
                    case 1:
                        switch (_a) {
                            case !(_b.sent()): return [3 /*break*/, 3];
                            case !data.collection: return [3 /*break*/, 4];
                            case !data.id: return [3 /*break*/, 5];
                            case !data.token: return [3 /*break*/, 6];
                            case data.collection === 'users' && this.tokenManager.decode(data.token).id !== data.id: return [3 /*break*/, 7];
                        }
                        return [3 /*break*/, 8];
                    case 2: return [2 /*return*/, { error: true, message: null, key: data.key }];
                    case 3: return [2 /*return*/, { error: true, message: 'Invalid token', key: data.key }];
                    case 4: return [2 /*return*/, { error: true, message: 'collection name is required', key: data.key }];
                    case 5: return [2 /*return*/, { error: true, message: 'record id is required', key: data.key }];
                    case 6: return [2 /*return*/, { error: true, message: 'client auth token is required', key: data.key }];
                    case 7: return [2 /*return*/, { error: true, message: 'You are not authorized to perform this action', key: data.key }];
                    case 8:
                        _b.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, this.pb.admins.client.collection(data.collection).delete(data.id)];
                    case 9:
                        _b.sent();
                        return [2 /*return*/, { error: false, key: data.key, data: { message: 'success', code: 200 } }];
                    case 10:
                        error_6 = _b.sent();
                        return [2 /*return*/, { error: true, message: error_6.message, key: data.key }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    return CrudManager;
}());
exports.default = CrudManager;
