class RateLimitHandler{
    private IpRateLimit: Map<string, number> = new Map<string, number>();
    constructor(){
        setInterval(() => {
            this.IpRateLimit.clear();
        }, 60000);
    }

    public has(ip: string): boolean{
        return this.IpRateLimit.has(ip);
    }
    public async checkRateLimit(ip: string): Promise<boolean>{
        if(this.IpRateLimit.has(ip)){
            let rate = this.IpRateLimit.get(ip) as number;
            if(rate >= 10){
                return false;
            }else{
                this.IpRateLimit.set(ip, rate + 1);
                return true;
            }
        }else{
            this.IpRateLimit.set(ip, 1);
            return true;
        }
    }

     public setRateLimit(ip: string): void{
        if(this.IpRateLimit.has(ip)){
            let rate = this.IpRateLimit.get(ip) as number;
            this.IpRateLimit.set(ip, rate + 1);
        }else{
            this.IpRateLimit.set(ip, 1);
        }
     }
    public async resetRateLimit(ip: string): Promise<void>{
        this.IpRateLimit.delete(ip);
    }





}

export default RateLimitHandler;