const instances: { id: string, status: string, instance: any, label: string }[] = [];
import { watch, copyFileSync, existsSync, statSync, mkdirSync, rename, renameSync } from "fs"; 
import { $ } from "bun";
import path from "path"; 
function SpinUpInstance(label: string, env: string) { 
    const instanceID = Math.random().toString(36).substring(7);
    let instance = Bun.spawn({
        cmd: [path.join(process.cwd(), "/hapta-server")],
        cwd: process.cwd(),
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env: {
            INSTANCE_ID: instanceID,
            INSTANCE_LABEL: label,
            INSTANCE_ENVIRONMENT: env, // fixed typo
        },
        onExit(subprocess, exitCode, signalCode, error) { 
            if(exitCode === 12 || !exitCode){
                return;
            }
            console.log("\n")
            console.log("Instance has exited");
            console.log("Exit code: ", exitCode);
            console.log("Signal code: ", signalCode);
            console.log("Error: ", error);
            console.log("\n")
            console.log("Restarting instance...");
            if(label === "BLUE") {
                SpinUpInstance("GREEN", "GREEN");
                // delete the old instance
                KillInstance("BLUE");
            } else {
                SpinUpInstance("BLUE", "BLUE");
                // delete the old instance
                KillInstance("GREEN");
            }
        },
    });
 

    if (instances.find((i) => i.label === label)) {
        console.log("Instance already exists");
        return;
    }
    console.log("Instance created");
    instances.push({ id: instanceID, status: "running", instance: instance, label: label });
}

function UpdateInstance() {
    console.log("Updating an instance");
}

function KillInstance(label: string) {
    let instance = instances.find((i) => i.label === label);
    if (!instance) {
        console.log("Instance not found");
        return;
    }
    instance.instance.kill();
    instances.splice(instances.indexOf(instance), 1);
    console.log("Instance deleted");
}

function checkInstance() {
    console.log("Checking an instance");
}

function listInstances() {
    let instanceList = instances.map((i) => i.label);
    console.log("\n");
    console.log("Instance list:");
    console.log(instanceList.join('\n')); // fixed formatting
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestions() {
    console.log("\n");
     
    readline.question('What would you like to do? (spinup, update, delete, check, list, exit):  ', (input: string) => {
        input = input.trim().toLowerCase(); 
        if (input === "spinup") {
            readline.question('What label would you like to give this instance?: ', (label: string) => {
                SpinUpInstance(label, "BLUE");
                askQuestions(); // Ask again after the action
            });
             
        } else if (input === "update") {
            readline.question('What label would you like to update?:  ', (label: string) => {
                UpdateInstance();
                askQuestions(); // Ask again after the action
            });
        } else if (input === "delete") {
            readline.question('What label would you like to delete?: ', (label: string) => {
                KillInstance(label);
                askQuestions(); // Ask again after the action
            });
        } else if (input === "check") {
            readline.question('What label would you like to check?:  ', (label: string) => {
                checkInstance();
                askQuestions(); // Ask again after the action
            });
        } else if (input === "list") {
            listInstances();
            askQuestions(); // Ask again after the action
        } else if (input === "exit") {
            for (let instance of instances) {
                instance.instance.kill();
            }
            readline.close();
            process.exit();
        } else {
            console.log("Invalid option, please try again.");
            askQuestions(); // Ask again if the input is invalid
        }
    });
}

askQuestions(); // Initial call



// if hapta-server file changes, or is new, restart the instance to apply changes

watch(path.join(process.cwd(), "/hapta-server"), { recursive: true }, (eventType, filename) => {
    console.log("File change detected", eventType, filename);
    if (eventType === "change" || eventType === "rename") {
        for (let instance of instances) {
            instance.instance.kill();
        }
        console.log("Restarting all instances...");
        SpinUpInstance("BLUE", "BLUE");
    }
});

if(!existsSync(path.join(process.cwd(), "/Updates"))) {
    mkdirSync(path.join(process.cwd(), "/Updates"));
} 

async function isFileInUse(filePath: string) {
    // Directly check if the file exists first
    if (!existsSync(filePath)) {
        return false; // The file is already gone
    }

    try { 
        renameSync(filePath, filePath); // Try to rename the file, this will throw an error if the file is in use
        return false; // The file is not in use
    } catch (error) { 
        return false; // Consider the file free in case of error
    }
}

  
  // Function to wait until the file is free
  async function waitForFileToBeFree(filePath: string ) {
    
    while (true) {
        const isFileFree = await isFileInUse(filePath);
        console.log("File is in use: ", isFileFree);
        if (!isFileFree) {
           break;
        } 
    }


}
let hasUpdate = false;
 

watch(path.join(process.cwd(), "/Updates"), { recursive: true }, async (eventType, filename) => {
    // If we have an ongoing update, ignore the events
    if (hasUpdate) return;

    if (eventType === "change" || eventType === "rename") { 
       hasUpdate = true;
        console.log("Update detected");
        // Wait for the file to be free
        await waitForFileToBeFree(path.join(process.cwd(), "/Updates/hapta-server"));
        console.log("File is free");
        
    }
});