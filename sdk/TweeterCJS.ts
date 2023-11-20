export default class TweeterCJS {
    token: string;
    ws: WebSocket;
    sendMessage: Function;
    constructor(options: { token: string}){
        this.token = options.token;
        this.ws = new WebSocket("ws://localhost:8080");
        this.sendMessage = (message: string)=>{
            this.ws.send(message);
        }
    }

    public on: Function = (event: string, callback: Function)=>{
       switch(event){
              case "open":
                 this.ws.onopen = (event: Event)=>{
                      if (callback != null){
                            callback(event);
                      }
                 }
                 break;
                case "close":
                 this.ws.onclose = (event: CloseEvent)=>{
                      if (callback != null){
                            callback(event);
                      }
                 }
                 break;
                case "message":
                 this.ws.onmessage = (event: MessageEvent)=>{
                      if (callback != null){
                            callback(event);
                      }
                 }
                 break;
                case "error":
                 this.ws.onerror = (event: Event)=>{
                      if (callback != null){
                            callback(event);
                      }
                 }
                 break;
         
       }
    }
    private WaitForSocketConnection: Function = (callback: Function)=>{
        let timer = setTimeout(  ()=> {
                if (this.ws.readyState === 1) {
                    if (callback != null){
                        callback();
                        clearTimeout(timer);
                    }
                    return;

                } else {
                    this.WaitForSocketConnection(callback);
                    clearTimeout(timer);
                }

            }, 5); // wait 5 milisecond for the connection...
    }

    public getUser: Function = (identifier: string, callback: Function)=>{

    }
}


let client = new TweeterCJS({ token: "token"});