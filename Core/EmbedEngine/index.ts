import { create } from 'domain';
import fs from 'fs'
import path from 'path'
const created = (created: any) => {
  let date = new Date(created);
  let now = new Date();
  let diff = now.getTime() - date.getTime();
  let seconds = diff / 1000;
  let minutes = seconds / 60;
  let hours = minutes / 60;
  let days = hours / 24;
  let weeks = days / 7;
  let months = weeks / 4;
  let years = months / 12;
  switch (true) {
    case seconds < 60:
      return `${Math.floor(seconds)}s`;
      break;
    case minutes < 60:
      return `${Math.floor(minutes)}m`;
      break;
    case hours < 24:
      return `${Math.floor(hours)}h`;
      break;
    case days < 7:
      return `${Math.floor(days)}d`;
      break;
    case weeks < 4:
      return `${Math.floor(weeks)}w`;
      break;
    case months < 12:
      return `${Math.floor(months)}mo`;
      break;
    case years > 1:
      return `${Math.floor(years)}y`;
      break;
    default:
      break;
  }
};
export default class EmbedEngine {
    type: string;
    data: any;
    constructor(type: string, data: any) {
        this.type = type;
        this.data = data;  
        console.log(this.data)
    }
    async init() {
        
    }
    async render() {
      return `
      <html data-theme="light">
       <head>
        <title>${this.data._payload.content}</title>
        ${
            fs.readFileSync(path.join(process.cwd(), "/Core/EmbedEngine/styles.txt"), "utf-8")
        }
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta charset="UTF-8">
       <head>
       <body>
        <div class="" onClick="window.location.href='http://localhost:3000/view/posts/${this.data._payload.id}'">
   <div class="flex p-[0.3rem] mt-2 flex-row gap-3 space-y-0 relative">
      ${
        this.data._payload.expand.author.avatar === null  ? ` <div class="w-10 h-10  text-center p-2 rounded  bg-[#e2e1e1] text-black">${this.data._payload.expand.author.username.slice(0, 1).charAt(0).toUpperCase()}</div>` : `
        <img class="w-10 h-10 rounded object-cover" src="http://localhost:8080/api/files/users/${this.data._payload.expand.author.id}/${this.data._payload.expand.author.avatar}" alt="${this.data._payload.expand.author.id}">
        `
      }
      <div class="flex gap-2">
         <div class="flex">
            <h1 class="font-semibold leading-none tracking-tight cursor-pointer items-center gap-5">${this.data._payload.expand.author.username}</h1>
         </div>
         <h1 class="font-semibold tracking-tight text-sm opacity-50"> @${this.data._payload.expand.author.username}</h1>
         <h1 class="font-semibold tracking-tight text-sm opacity-50">·</h1>
         <h1 class="font-semibold tracking-tight text-sm opacity-50">${created(this.data._payload.created)}</h1>
      </div>
      <h1 class="font-semibold leading-none tracking-tight absolute right-5">
         <div class="dropdown z-[99999]  dropdown-left dropdown-start">
            <div tabindex="0" role="button">
               <span class="dropdown-header">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 ">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"></path>
                  </svg>
               </span>
            </div>
            <ul tabindex="0" class="dropdown-content justify-center flex flex-col menu bg-base-100 rounded-[.4rem] z-[99999] w-64  h-fit p-2 shadow-lg border-[#d7d6d6] border">
               <span class="p-2 flex hero gap-2 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"></path>
                  </svg>
                  <p class="font-bold"> Embed Post</p>
               </span>
               <span class="p-2 flex hero gap-2 cursor-pointer">
                  <svg viewBox="0 0 24 24" aria-hidden="true" class="cursor-pointer hover:rounded-full hover:bg-sky-500 hover:bg-opacity-20  size-6 hover:p-2 hover:text-sky-500  fill-black">
                     <g>
                        <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path>
                     </g>
                  </svg>
                  <p class="font-bold w-full"> View Post Engagement </p>
               </span>
               <span class="p-2 flex hero gap-2 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokewidth="1.5" stroke="currentColor" class="size-6">
                     <path strokelinecap="round" strokelinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"></path>
                  </svg>
                  <p class="font-bold"> Report @${this.data._payload.expand.author.username}</p>
               </span>
               <span class="p-2 flex hero gap-2 cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"></path>
                  </svg>
                  <p class="font-bold"> Block @${this.data._payload.expand.author.username}</p>
               </span>
            </ul>
         </div>
      </h1>
   </div>
   <div class="p-1 cursor-pointer">
      <a>
         <p class="text-md">${this.data._payload.content}</p>
      </a>
   </div>
   <div class="p-1"></div>
   <div class="p-1 flex gap-3 relative items-start">
      <div class="flex items-center gap-2">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h- cursor-pointer fill-red-500 stroke-red-500">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"></path>
         </svg>
         <span class="countdown"> <span style="--value: ${this.data._payload.likes.length};"></span></span>
      </div>
      <div class="flex items-center gap-2 ">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 cursor-pointer">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"></path>
         </svg>
         ${this.data._payload.comments.length}
      </div>
      <div class=" flex items-center gap-2 ">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class=" hover:rounded-full hover:bg-green-400 hover:bg-opacity-20 hover:text-green-600 cursor-pointer w-6 h-6 size-6 ">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"></path>
         </svg>
      </div>
      <div class="flex hero gap-2">
         <svg viewBox="0 0 24 24" aria-hidden="true" class="cursor-pointer hover:rounded-full hover:bg-sky-500 hover:bg-opacity-20  size-6 hover:p-2 hover:text-sky-500  fill-black">
            <g>
               <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path>
            </g>
         </svg>
       ${this.data._payload.views.length}
      </div>
      <div class="flex absolute right-5 gap-5">
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"></path>
         </svg>
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"></path>
         </svg>
      </div>
   </div>
</div>
       </body>
      </html>
      `
    }
}