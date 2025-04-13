import Health from "../HealthStatus";
import TokenManager from "../TokenManager";
import RateLimiter from "../RateLimiter";
import Cache from "../cache";
export interface HandlerProps {
    req: Request;
    health: Health;
    tokenmanager: TokenManager;
    ratelimiter: RateLimiter;
    cache: Cache;
}