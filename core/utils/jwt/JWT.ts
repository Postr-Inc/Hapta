import crypto from "crypto";
import { ErrorCodes, ErrorHandler } from "../../controllers/ErrorHandler";

export class TokenManager {
  devKeys: Map<string, any>;
  clientKeys: Map<string, any>;
  secretKey: string;

  constructor(secretKey: string) {
    this.clientKeys = new Map();
    this.devKeys = new Map();
    this.secretKey = secretKey;
  }

  // Helper function to encode data to base64
  private base64Encode(data: string) {
    return Buffer.from(data).toString("base64url");
  }

  // Helper function to decode base64 data
  private base64Decode(data: string) {
    return Buffer.from(data, "base64url").toString("utf8");
  }

  // Create a signature using HMAC-SHA256
  private createSignature(header: string, payload: string) {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(`${header}.${payload}`)
      .digest("base64url");
  }

  generateToken(payload: any, expiresIn: number): string {
    const header = this.base64Encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const payloadWithExp = { ...payload, exp };
    const payloadStr = this.base64Encode(JSON.stringify(payloadWithExp));
    const signature = this.createSignature(header, payloadStr);

    return `${header}.${payloadStr}.${signature}`;
  }

  // Verify a token
  verifyToken(token: string): boolean {
    const [header, payload, signature] = token.split(".");

    if (!header || !payload || !signature) {
      return false;
    }

    const validSignature = this.createSignature(header, payload);

    return signature === validSignature;
  }

  // Decode a token without verification
  decodeToken(token: string): any {
    const [header, payload] = token.split(".");

    if (!header || !payload) {
      return null;
    }

    const decodedPayload = this.base64Decode(payload);

    return JSON.parse(decodedPayload) as { 
      id: string;
      exp: number;
      [key: string]: any;
    }
  }

  // Generate a signing key for a user or developer and store it in-memory
  async generateSigningKey(Uid: any, client: any = null):  Promise<string | any> {
    const randomKey = crypto.randomBytes(64).toString("hex");

    try {
      if (this.clientKeys.has(Uid) || this.devKeys.has(Uid)) {
        const keyMap = client ? this.clientKeys : this.devKeys;
        keyMap.set(Uid, { key: randomKey });
      } else {
        if (client) {
          this.clientKeys.set(Uid, { key: randomKey });
        } else {
          this.devKeys.set(Uid, { key: randomKey });
        }
      }
    } catch (error) {
      return new ErrorHandler(error).handle({
        code: ErrorCodes.AUTHKEYGENERATION_FAILED,
      });
    }
    return randomKey;
  }

  // Remove a signing key
  removeSigningKey(id: string, client: any = null) {
    if (client) {
      this.clientKeys.delete(id);
    } else {
      this.devKeys.delete(id);
    }
  }

  // Get a signing key
  async getSigningKey(id: string, client: any = null): Promise<string | null> {
    if (!id) return null;

    if (this.clientKeys.has(id) || this.devKeys.has(id)) {
      return client ? this.clientKeys.get(id).key : this.devKeys.get(id).key;
    } else { 
      return await this.generateSigningKey(id, client);
    }
  } 
  async isValid(token: string, client: any = null): Promise<boolean> {
    try {
      if (!this.verifyToken(token)) {
        console.log("Invalid token: signature mismatch");
        return false;
      }

      const decoded = this.decodeToken(token);
      const signingKey = await this.getSigningKey(decoded.id, client);
      if (!signingKey) {
        return false;
      } 
      const currentTime =  Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTime) {
        console.log("Token has expired");
        return false;
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}
