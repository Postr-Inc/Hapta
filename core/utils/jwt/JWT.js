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
exports.TokenManager = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var crypto_1 = require("crypto");
var TokenManager = /** @class */ (function () {
    function TokenManager(Pocketbase) {
        this.clientKeys = new Map();
        this.devKeys = new Map();
        this.pb = Pocketbase;
        this.startUp();
    }
    TokenManager.prototype.startUp = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pb.admins.client.collection('authState').getFullList().then(function (res) {
                            res.forEach(function (d) {
                                _this.clientKeys.set(d.User, { key: d.signing_key, id: d.id });
                            });
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.pb.admins.client.collection('devAuthState').getFullList().then(function (res) {
                                res.forEach(function (d) {
                                    _this.devKeys.set(d.dev, { key: d.signing_key, id: d.id });
                                });
                            })];
                    case 2:
                        _a.sent();
                        console.log("Token manager started");
                        return [2 /*return*/];
                }
            });
        });
    };
    TokenManager.prototype.sign = function (Uid, signingKey) {
        return new Promise(function (resolve, reject) {
            jsonwebtoken_1.default.sign({ id: Uid }, signingKey, { expiresIn: '30d' }, function (err, token) {
                if (err)
                    reject(err);
                resolve(token);
            });
        });
    };
    /**
     * @description Generates a signing key for a user
     * @param Uid
     * @param client
     * @returns
     */
    TokenManager.prototype.generateSigningKey = function (Uid, client) {
        if (client === void 0) { client = null; }
        return __awaiter(this, void 0, void 0, function () {
            var randomKey, error_1, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pb.admins.authWithPassword(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD)];
                    case 1:
                        _a.sent();
                        randomKey = crypto_1.default.randomUUID();
                        if (!(client ? this.clientKeys.has(Uid) : this.devKeys.has(Uid))) return [3 /*break*/, 5];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.pb.admins.client.collection(client ? 'authState' : 'devAuthState').update(client ? this.clientKeys.get(Uid).id : this.devKeys.get(Uid).id, { signing_key: randomKey })];
                    case 3:
                        _a.sent();
                        this.clientKeys.set(Uid, { key: randomKey, id: this.clientKeys.get(Uid).id });
                        return [2 /*return*/, randomKey];
                    case 4:
                        error_1 = _a.sent();
                        console.log(error_1);
                        return [2 /*return*/, null];
                    case 5: return [4 /*yield*/, this.pb.admins.client.collection(client ? 'authState' : 'devAuthState').create(client ? { User: Uid, signing_key: randomKey } : { dev: Uid, signing_key: randomKey })];
                    case 6:
                        res = _a.sent();
                        client ? this.clientKeys.set(Uid, { key: randomKey, id: res.id }) : this.devKeys.set(Uid, { key: randomKey, id: res.id });
                        return [2 /*return*/, randomKey];
                }
            });
        });
    };
    TokenManager.prototype.decode = function (token) {
        return jsonwebtoken_1.default.decode(token);
    };
    TokenManager.prototype.removeSigningKey = function (id, client) {
        if (client === void 0) { client = null; }
        client ? this.clientKeys.delete(id) : this.devKeys.delete(id);
    };
    TokenManager.prototype.getSigningKey = function (id, client) {
        if (client === void 0) { client = null; }
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case !id: return [3 /*break*/, 1];
                            case this.clientKeys.has(id) || this.devKeys.has(id): return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 3];
                    case 1: return [2 /*return*/, null];
                    case 2: return [2 /*return*/, client ? this.clientKeys.get(id).key : this.devKeys.get(id).key];
                    case 3: return [4 /*yield*/, this.generateSigningKey(id, client)];
                    case 4: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    TokenManager.prototype.isValid = function (token, client) {
        if (client === void 0) { client = null; }
        return __awaiter(this, void 0, void 0, function () {
            var signingKey, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.getSigningKey(this.decode(token).id, client)];
                    case 1:
                        signingKey = _a.sent();
                        jsonwebtoken_1.default.verify(token, signingKey);
                        return [2 /*return*/, true];
                    case 2:
                        error_2 = _a.sent();
                        console.log(error_2);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return TokenManager;
}());
exports.TokenManager = TokenManager;
