import { Hono } from "hono";
import { HttpCodes } from "../../Utils/Enums/HttpCodes";
import { zValidator } from "@hono/zod-validator";
import { MetricsSchema } from "../utils/validationSchemas";
import Pocketbase from "pocketbase";
import CrudManager from "../../Utils/Core/CrudManager";
import { ErrorCodes } from "../../Utils/Enums/Errors";
const metrics = new Hono();
type MetricsStore = {
    user: string;
    viewed_hashtags: string[];
    viewed_profiles: string[];
    posts_liked: string[];
    posts_bookmarked: string[];
    commented_on_post: string[];
    followed_after_post_view: string[];
};

export default (CrudManager: CrudManager) => {
    metrics.post("/user", zValidator('json', MetricsSchema, (result, c) => {
        if (!result.success) {
            c.status(HttpCodes.BAD_REQUEST);
            return c.json({
                status: "FIELD_MISSING",
                message: "Validation Error for metrics.",
                errors: result.error.errors,
            })
        }
    }), async (c) => {
        const { user, viewed_hashtags, viewed_profiles, posts_liked, posts_bookmarked, commented_on_post, followed_after_post_view } = c.req.valid('json');
        const token = c.req.header("Authorization");

        console.log("test")
        const metricsData: MetricsStore = {
            user,
            viewed_hashtags,
            viewed_profiles,
            posts_liked,
            posts_bookmarked,
            commented_on_post,
            followed_after_post_view
        };
        const userRecord = await CrudManager.list({
            collection: "statistic_tracking",
            options: {
                filter: `user.id="${user}"`,
                expand: ["user"],
                sort: "-created",
            },
            cacheKey: `statistic_tracking-${user}`,
            limit: 1,
            page: 1
        }, token as string)
 
        let firstRecordId: string | undefined = undefined;
        if (userRecord._payload && userRecord._payload.length > 0) {
            if (Array.isArray(userRecord._payload) && userRecord._payload.length > 0) {
                firstRecordId = userRecord._payload[0].id;
            }
            else if (
                typeof userRecord._payload === 'object' &&
                userRecord._payload !== null &&
                'items' in userRecord._payload &&
                Array.isArray((userRecord._payload as any).items) &&
                (userRecord._payload as any).items.length > 0
            ) {
                firstRecordId = (userRecord._payload as any).items[0].id;
            }
        }

        if (firstRecordId) {
            await CrudManager.update({
                collection: "statistic_tracking",
                id: firstRecordId,
                cacheKey: `statistic_tracking-${user}`,
                data: {
                    viewed_hashtags: viewed_hashtags || [],
                    viewed_profiles: viewed_profiles || [],
                    posts_liked: posts_liked || [],
                    posts_bookmarked: posts_bookmarked || [],
                    commented_on_post: commented_on_post || [],
                    followed_after_post_view: followed_after_post_view || []
                }
            }, token as string, true);
            c.status(HttpCodes.OK);
        } else {
            await CrudManager.create({
                collection: "statistic_tracking",
                invalidateCache: [`statistic_tracking-${user}`],
                data: {
                    user,
                    viewed_hashtags: viewed_hashtags || [],
                    viewed_profiles: viewed_profiles || [],
                    posts_liked: posts_liked || [],
                    posts_bookmarked: posts_bookmarked || [],
                    commented_on_post: commented_on_post || [],
                    followed_after_post_view: followed_after_post_view || []
                },
                cacheKey: `statistic_tracking-${user}`,
            }, token as string).catch((err) => {
                console.error("Error creating user metrics record:", err);
                c.status(ErrorCodes.INTERNAL_SERVER_ERROR);
                return c.json({
                    status: "ERROR_CREATING_RECORD",
                    message: "Failed to create user metrics record.",
                });
            })
        }
        c.status(HttpCodes.OK);
        return c.json({
            status: "OK",
            message: "Metrics recorded successfully.",
            data: metricsData
        });


    });
 

    return metrics;
}