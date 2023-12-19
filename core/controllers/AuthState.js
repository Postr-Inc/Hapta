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
var AuthSate = /** @class */ (function () {
    function AuthSate(pb, tokenManager) {
        this.pb = pb;
        this.tokenManager = tokenManager;
    }
    AuthSate.prototype.authUpdate = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, d, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case !data.token: return [3 /*break*/, 1];
                            case !this.tokenManager.isValid(data.token, true) || this.tokenManager.decode(data.token).id !== data.data.record.id: return [3 /*break*/, 2];
                            case !data.data.record: return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 4];
                    case 1: return [2 /*return*/, {
                            error: true,
                            message: 'token is required'
                        }];
                    case 2: return [2 /*return*/, {
                            error: true,
                            message: 'You are not authorized to perform this action'
                        }];
                    case 3: return [2 /*return*/, {
                            error: true,
                            message: 'auth record is required'
                        }];
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, server_1.pb.admins.client.collection('users').getOne(data.data.record.id)];
                    case 5:
                        d = _b.sent();
                        return [2 /*return*/, { error: false, message: 'success', key: data.data.key, clientData: d }];
                    case 6:
                        error_1 = _b.sent();
                        return [2 /*return*/, { error: true, message: error_1.message, key: data.key }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    AuthSate.prototype.authWithPassword = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, res, token, _b, _c, _d, error_2;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = true;
                        switch (_a) {
                            case !data.email || !data.username: return [3 /*break*/, 1];
                            case !data.password: return [3 /*break*/, 2];
                        }
                        return [3 /*break*/, 3];
                    case 1: return [2 /*return*/, {
                            error: true,
                            message: 'email or username are required'
                        }];
                    case 2: return [2 /*return*/, {
                            error: true,
                            message: 'password is required'
                        }];
                    case 3:
                        _e.trys.push([3, 7, , 8]);
                        return [4 /*yield*/, server_1.pb.admins.client.collection('users').authWithPassword(data.email || data.username, data.password)];
                    case 4:
                        res = _e.sent();
                        _c = (_b = this.tokenManager).sign;
                        _d = [res.record.id];
                        return [4 /*yield*/, this.tokenManager.generateSigningKey(res.record.id, true)];
                    case 5: return [4 /*yield*/, _c.apply(_b, _d.concat([_e.sent()]))];
                    case 6:
                        token = _e.sent();
                        res['token'] = token;
                        return [2 /*return*/, { error: false, message: 'success', key: data.key, clientData: res }];
                    case 7:
                        error_2 = _e.sent();
                        return [2 /*return*/, { error: true, message: error_2.message, key: data.key }];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return AuthSate;
}());
exports.default = AuthSate;
