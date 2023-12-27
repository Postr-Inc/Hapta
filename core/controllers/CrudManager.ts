//@ts-nocheck
import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT";
import EventEmitter from "events";
import CacheController from "./CacheController";
import { ErrorCodes, ErrorHandler } from "./ErrorHandler";
import Pocketbase from "pocketbase";
let config = await import(process.cwd() + "/config.ts").then(
  (res) => res.default
);
export default class CrudManager {
  pb: Pocketbase;
  Config: any;
  tokenManager: TokenManager;
  evt: EventEmitter;
  subscriptions: Map<string, any>;
  Cache: CacheController;
  constructor(pb: any, Config: any, tokenManager: TokenManager) {
    this.pb = pb;
    this.Config = Config;
    this.tokenManager = tokenManager;
    this.subscriptions = new Map();
    this.evt = new EventEmitter();
    this.Cache = new CacheController();
    this.worker = config.rules
      ? new Worker(new URL(process.cwd() + config.rules, import.meta.url))
      : null;
  }
  async list(data: any) {
    let {
      collection,
      limit,
      offset,
      filter,
      sort,
      expand,
      returnable,
      cacheKey,
      cacheTime,
    } = data.data;

    switch (true) {
      case collection === "authState" || collection === "devAuthState":
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TRIED_TO_ACCESS_AUTHSTATE,
          }),
          key: data.key,
          session: data.session,
        };
      case !collection:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "collection",
        };
      case !data.token:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
          key: data.key,
          session: data.session,
        };
      case limit && typeof limit !== "number":
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.TYPE_MISMATCH }),
          key: data.key,
          session: data.session,
          expected: "number",
          got: typeof limit,
        };
      case offset && typeof offset !== "number":
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.TYPE_MISMATCH }),
          key: data.key,
          session: data.session,
          expected: "number",
          got: typeof offset,
        };
      case filter && typeof filter !== "string":
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TYPEOF_FILTER_NOT_STRING,
          }),
          key: data.key,
          session: data.session,
        };
      case sort && typeof sort !== "string":
        return { error: true, message: "sort must be a string", key: data.key };
      case expand && !Array.isArray(expand):
        return {
          error: true,
          message: "expand must be an array",
          key: data.key,
        };
      case returnable && !Array.isArray(returnable):
        return {
          error: true,
          message: "returnable must be an array",
          key: data.key,
        };
      case !(await this.tokenManager.isValid(data.token, true)):
        return { error: true, message: "Invalid token", key: data.key };
      default:
        try {
          let expansion = "";
          expand
            ? expand.forEach((d) => {
                expansion += `${d},`;
              })
            : null;

          let cacheKey =
            data.data.cacheKey ||
            `${collection}_${offset}_${limit}_${
              filter ? filter.replace(/ /g, "") : ""
            }_${sort ? sort.replace(/ /g, "") : ""}_${
              expansion ? expansion.replace(/ /g, "") : ""
            }`;

          if (
            this.Cache.tableExists(collection) &&
            this.Cache.exists(collection, cacheKey)
          ) {
            let result = await this.Cache.getCache(collection, cacheKey);
            if (result) {
              let dt = JSON.parse(result.data);
              return {
                error: false,
                key: data.key,
                data: dt,
                session: data.session,
              };
            }
          } else {
            this.Cache.createTable(collection);
          }

          let res: any = await pb.admins.client
            .collection(collection)
            .getList(offset, limit, {
              filter: filter || "",
              sort: sort || "created",
              expand: expansion || "",
            });

          collection === "users" &&
            res.items.length > 0 &&
            res.items.forEach((item) => {
              if (item.emailVisibility === false) delete item.email;
            });
          let newItems = res.items.map((item: any) => {
            let newRecord = {
              id: item.id,
              expand: {},
            };

            function recursiveObject(item: any) {
              switch (true) {
                case item.emailVisibility === false &&
                  item.email &&
                  item.email !== null:
                  delete item.email;
                  break;
                case item.expand && item.expand !== null:
                  Object.keys(item.expand).forEach((key) => {
                    recursiveObject(item.expand[key]);
                  });
                  break;
                case Array.isArray(item):
                  item.forEach((d) => {
                    recursiveObject(d);
                  });
                  break;
                default:
                  break;
              }
            }

            if (item.expand && item.expand !== null) {
              Object.keys(item.expand).forEach((key) => {
                recursiveObject(item.expand[key]);
              });
            }

            Object.keys(item).forEach((key) => {
              if (returnable && returnable.includes(key)) {
                newRecord[key] = item[key];
              }
              newRecord[key] = item[key];
            });

            return newRecord;
          });

          res.items = newItems;

          this.Cache.setCache(
            collection,
            cacheKey,
            JSON.stringify(res),
            Date.now() + 1200
          );

          return {
            error: false,
            key: data.key,
            data: res,
            session: data.session,
          };
        } catch (error) {
          console.log(error.data);
          return {
            ...new ErrorHandler(data).handle({
              code: ErrorCodes.INVALID_REQUEST,
            }),
            key: data.key,
            session: data.session,
          };
        }
    }
  }

  async read(data: any) {
    switch (true) {
      case !data.collection ||
        data.collection === "authState" ||
        data.collection === "devAuthState":
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TRIED_TO_ACCESS_AUTHSTATE,
          }),
          key: data.key,
          session: data.session,
        };
      case !data.id:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "id",
        };
      case data.returnable && !Array.isArray(data.returnable):
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TYPEOF_RETURNABLE_NOT_ARRAY,
          }),
          key: data.key,
          session: data.session,
        };
      default:
        let idFromToken = this.tokenManager.decode(data.token).id || null;

        try {
          let res = await this.pb.admins.client
            .collection(data.collection)
            .getOne(data.id, {
              expand: data.expand ? data.expand.join(",") : "",
            });

          // Modify data based on specific conditions
          if (
            data.collection === "users" &&
            idFromToken !== data.id &&
            res.emailVisibility === false
          ) {
            delete res.email;
          }

          let newRecord = {
            id: res.id,
            expand: {},
          };

          function recursiveObject(item: any) {
            switch (true) {
              case item.emailVisibility === false &&
                item.email &&
                item.email !== null:
                delete item.email;
                break;
              case item.expand && item.expand !== null:
                Object.keys(item.expand).forEach((key) => {
                  recursiveObject(item.expand[key]);
                });
                break;
              case Array.isArray(item):
                item.forEach((d) => {
                  recursiveObject(d);
                });
                break;
              default:
                break;
            }
          }
          if (res.expand && res.expand !== null) {
            Object.keys(res.expand).forEach((key) => {
              recursiveObject(res.expand[key]);
            });
          }
          Object.keys(res).forEach((key) => {
            if (data.returnable && data.returnable.includes(key)) {
              newRecord[key] = res[key];
            }
            newRecord[key] = res[key];
          });
          switch (true) {
            case !this.Cache.tableExists(data.collection):
              this.Cache.createTable(data.collection);
              break;
            case this.Cache.tableExists(data.collection) &&
              !this.Cache.exists(data.collection, res.id):
              this.Cache.setCache(
                data.collection,
                newRecord.id,
                JSON.stringify(newRecord),
                Date.now() + 1200
              );
              break;
            default:
              let cache = await this.Cache.getCache(data.collection, res.id);
              if (cache) {
                console.log("cache", cache);
              }
          }

          return {
            error: false,
            key: data.key,
            data: newRecord,
            session: data.session,
          };
        } catch (error) {
          console.log(error);
          return {
            ...new ErrorHandler(data).handle({ code: ErrorCodes.READ_FAILED }),
            key: data.key,
            session: data.session,
          };
        }
    }
  }
  async create(data: any) {
    switch (true) {
      case data.collection === "authState" ||
        data.collection.includes("authState"):
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TRIED_TO_ACCESS_AUTHSTATE,
          }),
          key: data.key,
          session: data.session,
        };
      case !data.collection:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "collection",
        };
      case !data.record:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "record",
        };
      case (!data.token && data.collection !== "users") ||
        !this.tokenManager.isValid(data.token, true):
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
          key: data.key,
          session: data.session,
        };
      case data.epand && !Array.isArray(data.expand):
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TYPEOF_EXPAND_NOT_ARRAY,
          }),
          key: data.key,
          session: data.session,
          missing: "expand",
        };

      default:
        try {
          let expand = "";
          data.expand
            ? data.expand.forEach((d) => {
                expand += `${d},`;
              })
            : null;

          if (this.Cache.tableExists(data.collection) && data.cacheKey) {
            this.Cache.clear(data.collection, data.cacheKey);
          }

          function validateFiles(files: any) {
            let valid = true;
            files.forEach((file: any) => {
              if (
                !config.files.mimeTypes.includes(file.type) ||
                file.size > config.files.maxFileSize
              ) {
                valid = false;
              }
            });
            return valid;
          }
          for (var i in data.record) {
            if (data.record[i].isFile && data.record[i].file) {
              let files: any = [];
              if (Array.isArray(data.record[i].file)) {
                let invalidFiles = [];
                data.record[i].file.forEach((file: any) => {
                  const array = new Uint8Array(file);
                  const blob = new Blob([array], { type: file.type });
                  file = new File([blob], file.name, {
                    type: file.type,
                  });
                  if (!validateFiles([file])) invalidFiles.push(file);

                  files.push(file);
                });

                if (invalidFiles.length > 0)
                  return {
                    ...new ErrorHandler(data).handle({
                      code: ErrorCodes.INVALID_FILE_TYPE,
                    }),
                    key: data.key,
                    session: data.session,
                    invalidFiles: invalidFiles,
                    validFiles: files,
                  };
                data.record[i] = files;
              } else {
                const array = new Uint8Array(data.record[i].file);
                const blob = new Blob([array], { type: data.record[i].type });
                data.record[i] = Array.from(
                  new File([blob], data.record[i].name, {
                    type: data.record[i].type,
                  })
                );
                if (!validateFiles(data.record[i]))
                  return {
                    ...new ErrorHandler(data).handle({
                      code: ErrorCodes.INVALID_FILE_TYPE,
                    }),
                    key: data.key,
                    session: data.session,
                  };
              }
            }
          }

          let res = await this.pb.admins.client
            .collection(data.collection)
            .create(data.record, { expand: expand || "" });
          this.evt.emit("create", {
            collection: data.collection,
            record: res,
            action: "create",
          });
          return {
            error: false,
            key: data.key,
            data: res,
            session: data.session,
          };
        } catch (error) {
          return {
            ...new ErrorHandler(error).handle({
              code: ErrorCodes.CREATE_FAILED,
            }),
            key: data.key,
            session: data.session,
          };
        }
    }
  }

  parseRules(rules: any) {
    let rule = new URLSearchParams(rules);
    let ruleKeys = [...rule.keys()];
    let ruleValues = [...rule.values()];
    let ruleObj: any = {};
    ruleKeys.forEach((key, index) => {
      ruleObj[key] = ruleValues[index];
    });
    return ruleObj;
  }

  async update(data: any) {
    switch (true) {
      case data.collection === "authState" ||
        data.collection.includes("authState"):
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.TRIED_TO_ACCESS_AUTHSTATE,
          }),
          key: data.key,
          session: data.session,
        };

      case !data.collection:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "collection",
        };

      case !data.id:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "id",
        };

      case !data.token:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "token",
        };

      case !this.tokenManager.isValid(data.token, true):
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
        };
    }

    if (this.worker) {
      this.worker.postMessage({
        ...data,
        decodedToken: this.tokenManager.decode(data.token),
      });
      let promise = await new Promise((resolve, reject) => {
        this.worker.onmessage = (e: any) => {
          let res = e.data;
          if (res.error) {
            resolve({
              ...new ErrorHandler(res).handle({
                code: res.code || ErrorCodes.UPDATE_FAILED,
              }),
              key: data.key,
              session: data.session,
              type: "update",
            });
          }
          resolve({ error: false });
        };
      });

      if (promise.error) return promise;
    } else {
      console.log(
        `⚠️ No  rule validator   found  all connections are vulnerable to attacks without validation!`
      );
    }

    try {
      // handle files

      function validateFiles(files: any) {
        let valid = true;
        files.forEach((file: any) => {
          if (
            !config.files.mimeTypes.includes(file.type) ||
            file.size > config.files.maxFileSize
          ) {
            valid = false;
          }
        });
        return valid;
      }

      for (var i in data.data) {
        if (data.data[i].isFile && data.data[i].file) {
          let files: any = [];
          if (Array.isArray(data.data[i].file)) {
            let invalidFiles = [];
            data.data[i].file.forEach((file: any) => {
              const array = new Uint8Array(file);
              const blob = new Blob([array], { type: file.type });
              file = new File([blob], file.name, {
                type: file.type,
              });
              if (!validateFiles([file])) invalidFiles.push(file);

              files.push(file);
            });

            if (invalidFiles.length > 0)
              return {
                ...new ErrorHandler(data).handle({
                  code: ErrorCodes.INVALID_FILE_TYPE,
                }),
                key: data.key,
                session: data.session,
                invalidFiles: invalidFiles,
                validFiles: files,
              };
            data.data[i] = files;
          } else {
            const array = new Uint8Array(data.data[i].file);
            const blob = new Blob([array], { type: data.data[i].type });
            data.data[i] = Array.from(
              new File([blob], data.data[i].name, {
                type: data.data[i].type,
              })
            );
            if (!validateFiles(data.data[i]))
              return {
                ...new ErrorHandler(data).handle({
                  code: ErrorCodes.INVALID_FILE_TYPE,
                }),
                key: data.key,
                session: data.session,
              };
          }
        }
      }

      let idFromToken = this.tokenManager.decode(data.token).id;

      if (this.Cache.tableExists(data.collection) && data.cacheKey) {
        this.Cache.clear(data.collection, data.cacheKey);
      }

      let expand = "";
      data.expand
        ? data.expand.forEach((d) => {
            expand += `${d},`;
          })
        : null;
      let res = await this.pb.admins.client
        .collection(data.collection)
        .update(data.id, data.data, { expand: expand || "" });
      if (
        data.collection === "users" &&
        idFromToken !== data.id &&
        res.emailVisibility === false
      ) {
        delete res.email;
      }

      this.evt.emit("update", {
        collection: data.collection,
        record: res,
        action: "update",
      });
      return { error: false, key: data.key, data: res, session: data.session };
    } catch (error) {
      return {
        ...new ErrorHandler(data).handle({ code: ErrorCodes.UPDATE_FAILED }),
        key: data.key,
        session: data.session,
      };
    }
  }
  async delete(data: any) {
    switch (true) {
      case data.collection === "authState" ||
        data.collection.includes("authState"):
        return {
          ...new ErrorHandler(data).handle({ code: 102 }),
          key: data.key,
          session: data.session,
        };
      case !(await this.tokenManager.isValid(data.token, true)):
        return {
          ...new ErrorHandler(data).handle({ code: 101 }),
          key: data.key,
          session: data.session,
        };
      case !data.collection:
        return {
          ...new ErrorHandler(data).handle({ code: 100 }),
          key: data.key,
          session: data.session,
          missing: "collection",
        };
      case !data.id:
        return {
          ...new ErrorHandler(data).handle({ code: 100 }),
          key: data.key,
          session: data.session,
          missing: "id",
        };
      case !data.token:
        return {
          ...new ErrorHandler(data).handle({ code: 1 }),
          key: data.key,
          session: data.session,
          missing: "token",
        };
      case data.collection === "users" &&
        this.tokenManager.decode(data.token).id !== data.id:
        return {
          ...new ErrorHandler().handle({ code: 105 }),
          key: data.key,
          session: data.session,
        };
      case !data.ownership:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.FIELD_MISSING }),
          key: data.key,
          session: data.session,
          missing: "ownership",
        };

      default:
        if (this.worker) {
          let promise = await new promise((resolve, reject) => {
            this.worker.postMessage({ record: data });
            this.worker.onmessage = (e: any) => {
              let res = e.data;
              if (res.error) {
                resolve();
                return {
                  ...new ErrorHandler(res).handle({
                    code: res.code || ErrorCodes.DELETE_FAILED,
                  }),
                  key: data.key,
                  session: data.session,
                };
              }
              resolve(res);
            };
          });
          if (promise.error) return promise;
        }
        try {
          if (this.Cache.tableExists(data.collection) && data.cacheKey) {
            this.Cache.clear(data.collection, data.cacheKey);
          }
          let res = await this.pb.admins.client
            .collection(data.collection)
            .delete(data.id);
          this.evt.emit("delete", {
            collection: data.collection,
            record: res,
            action: "delete",
          });
          return {
            error: false,
            key: data.key,
            data: res,
            session: data.session,
          };
        } catch (error) {
          console.log(error);
          return {
            error: true,
            message: error.message,
            key: data.key,
            token: data.token,
            session: data.session,
          };
        }
    }
  }
}
