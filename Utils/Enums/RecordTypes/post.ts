export interface Post {
    created: string | number | Date;
    author: string;
    content: string;
    type: string;
    files: string[];
    comments: string[];
    bookmarked: string[];
    pinned: boolean,
    likes: string[];
    mentioned: string[];
    shares: string[];
    whoCanSee:  "public" | "private" | "following";
    engaged: string[];
    profile_visited_after_view: string[];
    followed_after_profile_view: string[];
    related_topics: string[];
    isRepost: boolean;
    repost: string;
    hasPoll: boolean;
    pollEnds: string;
    pollVotes: string[];
    people_who_reposted: string[];
    blocks: string[];
    reportAsAbuse: string[];
    reportAsSpam: string[];
    isAd: boolean;
    End_Date_of_Ad: string;
    Publish_At: string;
    isNSFW: boolean;
    links: null | string[];
    rank: number;
    expand: {
        author:{
            [key: string] : any;
        }
    }
}
 
