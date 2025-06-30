import Pocketbase from 'pocketbase';
import { sign } from 'hono/jwt'
import { setCookie } from 'hono/cookie';
import { ErrorCodes } from '../../Enums/Errors';
import config from '../../../config';
import { HttpCodes } from '../../Enums/HttpCodes';


export default class AuthHandler {
    pb: Pocketbase;
    SuccessFulLogins: Map<string, string>
    tokenStore: Map<string, string>
    ipStore: Map<string, string>
    adminTokenStore: Map<string, string>
    userStore: Map<string, string>
    constructor(
        pb: Pocketbase
    ) {
        this.pb = pb;
        this.SuccessFulLogins = new Map()
        this.tokenStore = new Map()
        this.ipStore = new Map()
        this.adminTokenStore = new Map()
        this.userStore = new Map()
    }

    public async rollNewToken(oldToken: string, data: any, isBasicToken?: boolean) {
        let tokenBody = {
            ...data,
            ...(isBasicToken && { isBasic: true, permissions: ["read"] }),
            ...(!isBasicToken && { isBasic: false, permissins: ["read", "write", "delete"] }),
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
        }
        let newSig = config.Security.Secret + oldToken.split('-')[1] + Math.random().toString(36).substring(2, 15);
        let newToken = await sign(tokenBody, newSig, "HS256") as string;
        this.SuccessFulLogins.set(data.id, oldToken.split('-')[0] + "-" + newToken)
        this.tokenStore.set(newToken, newSig)
        this.tokenStore.delete(oldToken)
        return newToken;
    }

    public async trackDevice({
        userId,
        deviceInfo,
        ipAddress,
    }: {
        userId: string;
        deviceInfo: Record<string, any> | null;
        ipAddress: string;
    }) {
        const activeDevices = (await this.pb.collection("Devices").getFullList({
            filter: `account="${userId}"`,
            batch: Number.MAX_SAFE_INTEGER,
        })) as any[];

        const deviceName =
            typeof deviceInfo === "object" && deviceInfo !== null && deviceInfo.userAgent
                ? deviceInfo.userAgent.split(")")[0].split("(")[1] || "Unknown Device"
                : "Unknown Device";

        const existingDevice = activeDevices.find(
            (device: any) => device.ip === ipAddress
        );

        if (existingDevice) {
            // Device exists → update last login
            await this.pb.collection("Devices").update(existingDevice.id, {
                lastLogin: new Date().toISOString(),
            });
        } else {
            // New device → create + link to user
            const newDevice = await this.pb.collection("Devices").create({
                ip: ipAddress,
                account: userId,
                lastLogin: new Date().toISOString(),
                name_of_device: deviceName,
            });

            await this.pb.collection("users").update(userId, {
                ActiveDevices: [...activeDevices.map((d) => d.id), newDevice.id],
            });
        }
    }

    public async resetPassword(resetToken: string, password: string, hono: any) {
        try {
            await this.pb.collection('users').confirmPasswordReset(resetToken, password, password)
            return hono.json({
                status: HttpCodes.OK,
                message: 'Password Reset Successful'
            })
        } catch (error) {
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while resetting password',
                details: error
            })
        }
    }
    public async requestPasswordReset(email: string, hono: any) {
        try {
            await this.pb.collection('users').requestPasswordReset(email)
            return hono.json({
                status: HttpCodes.OK,
                message: 'Password Reset Request Sent'
            })
        } catch (error) {
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while sending password reset request'
            })
        }
    }
    public async register(data: any, hono: any) {
        try {
            // 🚫 Prevent malicious field injection
            if ('followers' in data || 'following' in data) {
                hono.status(ErrorCodes.UNAUTHORIZED_REQUEST);
                return hono.json({
                    status: ErrorCodes.UNAUTHORIZED_REQUEST,
                    message: "You cannot set 'followers' or 'following' manually.",
                });
            }

            // ✅ Always ensure passwordConfirm matches PB expectation
            const user = await this.pb.collection('users').create({
                ...data,
                passwordConfirm: data.password,
                ActiveDevices: [],
            })
 

            return hono.json({
                status: HttpCodes.OK,
                message: "User created successfully.",
                data: user
            });
        } catch (error: any) {
            console.error("[REGISTER ERROR]", error);

            // ✅ Handle PocketBase API validation errors cleanly
            if (error?.data?.data) {
                const validationIssues = Object.entries(error.data.data).map(([field, detail]: any) => ({
                    field,
                    message: detail?.message || "Invalid value",
                }));

                hono.status(ErrorCodes.FIELD_MISSING);
                return hono.json({
                    status: ErrorCodes.FIELD_MISSING,
                    message: "Validation failed. Check your input.",
                    errors: validationIssues,
                });
            }

            // ✅ Fallback for unknown errors
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR);
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: "Something went wrong while creating the user.",
            });
        }
    }


    public async check(email: string, username: string, hono: any) {
        try {
            let emailExists = await this.pb.collection('users').getFullList({ batch: 1, filter: `email="${email}"` }) as any;
            let usernameExists = await this.pb.collection('users').getFullList({ batch: 1, filter: `username="${username}" || username="${username.toLowerCase()}" || username="${username.toUpperCase()}"` }) as any;
            return hono.json({
                status: HttpCodes.OK,
                message: 'Check Successful',
                data: {
                    emailExists: emailExists.length > 0,
                    usernameExists: usernameExists.length > 0
                }
            })
        } catch (error) {
            console.log(error)
            hono.status(ErrorCodes.INTERNAL_SERVER_ERROR)
            return hono.json({
                status: ErrorCodes.INTERNAL_SERVER_ERROR,
                message: 'An error occured while checking email'
            })
        }
    }


    public async login(
        emailOrUsername: string,
        password: string,
        deviceInfo: Record<string, any> | null,
        ipAddress: string,
        hono: any
    ) {
        try {
            const user = await this.pb
                .collection("users")
                .authWithPassword(emailOrUsername, password);

            await this.trackDevice({
                userId: user.record.id,
                deviceInfo,
                ipAddress,
            });

            // JWT, tokens, etc...
            const payload = {
                id: user.record.id,
                username: user.record.username,
                created: user.record.created,
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
            };

            const token = await sign(
                payload,
                config.Security.Secret + password,
                "HS256"
            ) as string;

            // Session store
            const lastToken = this.SuccessFulLogins.get(user.record.id);
            if (lastToken) {
                this.tokenStore.delete(lastToken.split("-")[1]);
                this.ipStore.delete(lastToken.split("-")[1]);
            }

            this.SuccessFulLogins.set(user.record.id, ipAddress + "-" + token);
            this.tokenStore.set(token, config.Security.Secret + password);
            this.ipStore.set(token, ipAddress);

            return hono.json({
                success: true,
                status: 200,
                message: "Login Successful",
                data: {
                    token,
                    ...user.record,
                },
            });
        } catch (error: any) {
            return hono.json(
                {
                    success: false,
                    error: {
                        name: "AuthError",
                        issues: [
                            {
                                code: "custom",
                                message: "Invalid email or password",
                                path: [],
                            },
                        ],
                    },
                },
                401
            );
        }
    }
}