export class ErrorHandler {
    static handle(error: any) {
         
        return {
            error: true,
            message: error.message,
        };
    }
}