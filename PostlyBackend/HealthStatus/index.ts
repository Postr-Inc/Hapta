import fs from 'fs';

export default class Health {
    _data: any[];
    outputFile: string;
    CheckInterval: number;

    constructor(data: {outputFile: string, CheckInterval: number}) {
        this._data = JSON.parse(fs.readFileSync(data.outputFile, 'utf-8')).logs || [] as any[];
        this.outputFile = data.outputFile;
        this.CheckInterval = data.CheckInterval;
        setInterval(()=> {
            this.save()
        }, this.CheckInterval)
    }

    // Method to analyze the system health and return its status
    forge() {
        let errorCount = 0;
        let slowRequestCount = 0;
        let systemErrorCount = 0;

        // Loop through the logs to analyze errors, slow requests, and system errors
        for (const entry of this._data) {
            if (entry.type === 'error') {
                errorCount++;
            }
            if (entry.type === 'slowRequest') {
                slowRequestCount++;
            }
            if (entry.type === 'systemError') {
                systemErrorCount++;
            }
        }

        // Determine the system status based on the conditions
        if (errorCount >  10 || systemErrorCount > 10) {
            return 'instable';  // Too many errors or system-related failures
        }
        if (slowRequestCount > 3) {
            return 'degrading';  // Several slow requests indicating performance issues
        }
        return 'stable';  // No significant issues
    }

    // Method to save the data
    save() {
        fs.writeFileSync(this.outputFile, JSON.stringify(this._data, null, 2));
        return true;
    }

    // Method to log errors
    error(text: string) {
        this._data.push({ 'type': 'error', message: text });
    }

    // Method to log slow requests
    slowRequest() {
        this._data.push({ 'type': 'slowRequest', message: 'Request was slow' });
    }

    // Method to log system errors
    systemError(text: string) {
        this._data.push({ 'type': 'systemError', message: text }); 
    }
}
