import { pb } from "../../server";
import fs from "fs";
export default class CDN {
  pb: any;
  collections: any;
  dbURL: string;
  constructor(pb) {
    this.pb = pb;
    this.collections = new Map();
    this.getCollections();
    this.dbURL = process.env.DB_URL || "http://127.0.0.1:8090";
  }

  async getCollections() {
    let collections = await this.pb.admins.client.collections.getFullList();
    collections.forEach((d) => {
      this.collections.set(d.name, {
        id: d.id,
      });
    });
  }

  async fetchFile(file: any) {
    try {
      switch (true) {
        case !file.collection:
          return {
            error: true,
            message: "collection is required",
          };
        case !file.key:
          return {
            error: true,
            message: "key is required",
          };
        case !file.recordID:
          return {
            error: true,
            message: "record id is required",
          };
        case !file.field:
          return {
            error: true,
            message: "field is required",
          };
        default:
          break;
      }
      
      let res = await pb.admins.client.collection(file.collection).getOne(file.recordID);
      let url = `${this.dbURL}/api/files/${
        this.collections.get(file.collection).id
      }/${file.recordID}/${res[file.field]}`;
      let blob = await fetch(url).then((r) => r.blob());
      let array = new Uint8Array(await blob.arrayBuffer()) as any;
      array = Array.from(array);
      return { key: file.key, file: array, fileName: res[file.field] , fileType: res[file.field] , erorr: false };
    } catch (error) {
      return { error: true, message: error.message, key: file.key };
    }
  }
}
