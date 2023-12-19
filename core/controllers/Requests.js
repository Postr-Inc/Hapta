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
var JWT_1 = require("../utils/jwt/JWT");
var AuthState_1 = require("./AuthState");
var CrudManager_1 = require("./CrudManager");
var oauth2_1 = require("./oauth2");
var RequestHandler = /** @class */ (function () {
    function RequestHandler(ws, req, pb, Config) {
        var _this = this;
        this.ws = function () { return ws; };
        this.req = req;
        this.Config = Config;
        this.rateLimits = new Map();
        this.ratelimitsClients = new Array();
        this.addedLimits = false;
        this.isServer = false;
        this.sendMsg = function (msg) {
            _this.waitForSocketConnection(function () {
                _this.ws().send(JSON.stringify(msg));
            });
        };
        this.pb = pb;
        this.addLimits();
        this.TokenManager = new JWT_1.TokenManager(this.pb);
        this.authState = new AuthState_1.default(this.pb, this.TokenManager);
        this.crudManager = new CrudManager_1.default(this.pb, this.Config, this.TokenManager);
    }
    RequestHandler.prototype.addLimits = function () {
        var _this = this;
        if (this.addedLimits)
            return;
        Object.keys(this.Config.ratelimits).forEach(function (key) {
            console.log("Setting rate limit for ".concat(key));
            _this.rateLimits.set(key, {
                limit: _this.Config.ratelimits[key].limit,
                every: _this.Config.ratelimits[key].every,
            });
        });
        this.addedLimits = true;
    };
    RequestHandler.prototype.waitForSocketConnection = function (callback) {
        var _this = this;
        setTimeout(function () {
            if (_this.ws && _this.ws().readyState === 1) {
                if (callback != null) {
                    callback();
                }
                return;
            }
            else {
                _this.waitForSocketConnection(callback);
            }
        }, 5);
    };
    RequestHandler.prototype.waitForRateLimit = function (token, type) {
        var _this = this;
        console.log("Waiting for ".concat(type, " rate limit to clear"));
        return new Promise(function (resolve) {
            var checkRateLimit = function () {
                if (!_this.isRatelimited(token, type)) {
                    resolve();
                    console.log("\n".concat(type, " rate limit cleared for ").concat(_this.TokenManager.decode(token).id));
                }
                else {
                    _this.clearExpiredLimits(type, token);
                    setTimeout(checkRateLimit, _this.rateLimits.has(type) ? _this.rateLimits.get(type).every : 1000);
                }
            };
            checkRateLimit();
        });
    };
    RequestHandler.prototype.updateTokenUsage = function (token, type) {
        if (this.ratelimitsClients.find(function (client) { return client.token === token; })) {
            var client = this.ratelimitsClients.find(function (client) { return client.token === token; });
            client.used += 1;
            client.lastUsed = Date.now();
        }
        else {
            this.ratelimitsClients.push({ token: token, used: 1, lastUsed: Date.now(), type: type });
        }
    };
    RequestHandler.prototype.isRatelimited = function (token, type) {
        var _a, _b;
        if (this.ratelimitsClients.find(function (client) { return client.token === token && client.type === type; })) {
            var tokenUsage = this.ratelimitsClients.find(function (client) { return client.token === token; });
            if (!tokenUsage || !this.rateLimits.get(type))
                return false;
            if (Date.now() - tokenUsage.lastUsed > ((_a = this.rateLimits.get(type)) === null || _a === void 0 ? void 0 : _a.every)) {
                return false;
            }
            else if (tokenUsage.used >= ((_b = this.rateLimits.get(type)) === null || _b === void 0 ? void 0 : _b.limit)) {
                return true;
            }
        }
        return false;
    };
    RequestHandler.prototype.clearExpiredLimits = function (type, token) {
        var _a, _b;
        var tokenUsage = this.ratelimitsClients.find(function (client) { return client.token === token; });
        if (!tokenUsage)
            return;
        if (Date.now() - tokenUsage.lastUsed >= ((_a = this.rateLimits.get(type)) === null || _a === void 0 ? void 0 : _a.every) || tokenUsage.used >= ((_b = this.rateLimits.get(type)) === null || _b === void 0 ? void 0 : _b.limit)) {
            console.log("\nCleared ".concat(type, " rate limit for ").concat(this.TokenManager.decode(token).id));
            this.ratelimitsClients = this.ratelimitsClients.filter(function (client) { return client.token !== token; });
        }
    };
    RequestHandler.prototype.handleRequest = function (msg) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var _e, _f, _g, _h, _j, username, res;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        msg = JSON.parse(msg);
                        if (msg.server)
                            this.isServer = true;
                        if (!(msg.type !== "oauth" && msg.type !== "authwithpassword" && msg.type !== "isRatelimited")) return [3 /*break*/, 2];
                        if (!this.TokenManager.isValid(msg.token, true))
                            return [2 /*return*/, this.sendMsg({ error: true, message: 'Invalid token' })];
                        this.updateTokenUsage(msg.token, msg.type);
                        return [4 /*yield*/, this.waitForRateLimit(msg.token || ((_a = msg.data) === null || _a === void 0 ? void 0 : _a.token), msg.type)];
                    case 1:
                        _k.sent();
                        _k.label = 2;
                    case 2:
                        _e = msg.type;
                        switch (_e) {
                            case "authWithPassword": return [3 /*break*/, 3];
                            case "isRatelimited": return [3 /*break*/, 5];
                            case "oauth": return [3 /*break*/, 6];
                            case "authUpdate": return [3 /*break*/, 8];
                            case "list": return [3 /*break*/, 10];
                            case "subscribe": return [3 /*break*/, 12];
                            case "unsubscribe": return [3 /*break*/, 13];
                            case "update": return [3 /*break*/, 14];
                            case "getUserByUsername": return [3 /*break*/, 16];
                        }
                        return [3 /*break*/, 18];
                    case 3:
                        _f = this.sendMsg;
                        return [4 /*yield*/, this.authState.authWithPassword(msg.data)];
                    case 4:
                        _f.apply(this, [_k.sent()]);
                        return [3 /*break*/, 19];
                    case 5:
                        !msg.method ? this.sendMsg({ error: true, message: 'method is required' }) : this.sendMsg({ error: false, ratelimited: this.isRatelimited(msg.token, msg.method), duration: (_b = this.rateLimits.get(msg.method)) === null || _b === void 0 ? void 0 : _b.every, limit: (_c = this.rateLimits.get(msg.method)) === null || _c === void 0 ? void 0 : _c.limit,
                            used: (_d = this.ratelimitsClients.find(function (client) { return client.token === msg.token; })) === null || _d === void 0 ? void 0 : _d.used, key: msg.key });
                        return [3 /*break*/, 19];
                    case 6:
                        if (this.isServer)
                            return [2 /*return*/, this.sendMsg({ error: true, message: 'Cannot use client oauth instead use the server oauth gateway' })];
                        return [4 /*yield*/, (0, oauth2_1.default)(this.TokenManager, this.sendMsg, msg.data)];
                    case 7:
                        _k.sent();
                        return [3 /*break*/, 19];
                    case 8:
                        _g = this.sendMsg;
                        return [4 /*yield*/, this.authState.authUpdate(msg)];
                    case 9:
                        _g.apply(this, [_k.sent()]);
                        return [3 /*break*/, 19];
                    case 10:
                        _h = this.sendMsg;
                        return [4 /*yield*/, this.crudManager.list(msg)];
                    case 11:
                        _h.apply(this, [_k.sent()]);
                        return [3 /*break*/, 19];
                    case 12:
                        this.crudManager.subscribe(msg, this.sendMsg);
                        return [3 /*break*/, 19];
                    case 13:
                        this.crudManager.unsubscribe(msg);
                        return [3 /*break*/, 19];
                    case 14:
                        _j = this.sendMsg;
                        return [4 /*yield*/, this.crudManager.update(msg)];
                    case 15:
                        _j.apply(this, [_k.sent()]);
                        return [3 /*break*/, 19];
                    case 16:
                        username = msg.data.username;
                        return [4 /*yield*/, this.crudManager.read({ collection: 'users', filter: "username = \"".concat(username, "\"") })];
                    case 17:
                        res = _k.sent();
                        return [3 /*break*/, 19];
                    case 18:
                        this.sendMsg({ error: true, message: "Invalid request type" });
                        return [3 /*break*/, 19];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    return RequestHandler;
}());
exports.default = RequestHandler;
