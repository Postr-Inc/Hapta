//@ts-nocheck
import config from "./config.toml" 
const { dataset: trainingData } = await import(config.model.model_path).then(module => module.default);

// Define sigmoid and its derivative
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function sigmoidDerivative(x) {
    return x * (1 - x);
}

// Neural Network class definition
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;

        // Initialize weights
        this.weights1 = Array.from({ length: this.inputSize * this.hiddenSize }, () => Math.random());
        this.weights2 = Array.from({ length: this.hiddenSize * this.outputSize }, () => Math.random());
    }

    forward(input) {
        this.input = input;

        // Calculate hidden layer values
        this.hidden = Array.from({ length: this.hiddenSize }, (_, i) =>
            this.weights1.slice(i * this.inputSize, (i + 1) * this.inputSize).reduce((sum, weight, j) => sum + weight * input[j], 0)
        ).map(sigmoid);

        // Calculate output layer values
        this.output = Array.from({ length: this.outputSize }, (_, i) =>
            this.weights2.slice(i * this.hiddenSize, (i + 1) * this.hiddenSize).reduce((sum, weight, j) => sum + weight * this.hidden[j], 0)
        ).map(sigmoid);

        return this.output;
    }

    backward(target) {
        // Calculate output layer error and gradient
        this.outputError = this.output.map((value, i) => target[i] - value);
        this.outputGradient = this.output.map((value, i) => this.outputError[i] * sigmoidDerivative(value));

        // Calculate hidden layer error and gradient
        this.hiddenError = Array.from({ length: this.hiddenSize }, (_, i) =>
            this.outputGradient.reduce((sum, grad, j) => sum + this.weights2[j * this.hiddenSize + i] * grad, 0)
        );
        this.hiddenGradient = this.hidden.map((value, i) => this.hiddenError[i] * sigmoidDerivative(value));

        // Update weights
        for (let i = 0; i < this.outputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.weights2[i * this.hiddenSize + j] += this.hidden[j] * this.outputGradient[i];
            }
        }

        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.inputSize; j++) {
                this.weights1[i * this.inputSize + j] += this.input[j] * this.hiddenGradient[i];
            }
        }
    }

    train(input, target) {
        this.forward(input);
        this.backward(target);
    } 
    trainBatch(inputs, targets) {
        // Initialize accumulators for gradients
        const outputGradientSum = Array.from({ length: this.outputSize }, () => 0);
        const hiddenGradientSum = Array.from({ length: this.hiddenSize }, () => 0);

        const weights2Delta = Array.from({ length: this.hiddenSize * this.outputSize }, () => 0);
        const weights1Delta = Array.from({ length: this.inputSize * this.hiddenSize }, () => 0);

        // Iterate over each example in the batch
        inputs.forEach((input, index) => {
            const target = targets[index];

            // Forward pass
            this.forward(input);

            // Calculate output layer error and gradient
            const outputError = this.output.map((value, i) => target[i] - value);
            const outputGradient = this.output.map((value, i) => outputError[i] * sigmoidDerivative(value));

            // Calculate hidden layer error and gradient
            const hiddenError = Array.from({ length: this.hiddenSize }, (_, i) =>
                outputGradient.reduce((sum, grad, j) => sum + this.weights2[j * this.hiddenSize + i] * grad, 0)
            );
            const hiddenGradient = this.hidden.map((value, i) => hiddenError[i] * sigmoidDerivative(value));

            // Accumulate gradients
            for (let i = 0; i < this.outputSize; i++) {
                outputGradientSum[i] += outputGradient[i];
                for (let j = 0; j < this.hiddenSize; j++) {
                    weights2Delta[i * this.hiddenSize + j] += this.hidden[j] * outputGradient[i];
                }
            }

            for (let i = 0; i < this.hiddenSize; i++) {
                hiddenGradientSum[i] += hiddenGradient[i];
                for (let j = 0; j < this.inputSize; j++) {
                    weights1Delta[i * this.inputSize + j] += this.input[j] * hiddenGradient[i];
                }
            }
        });

        // Average gradients and update weights
        const batchSize = inputs.length;
        for (let i = 0; i < this.outputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                this.weights2[i * this.hiddenSize + j] += weights2Delta[i * this.hiddenSize + j] / batchSize;
            }
        }

        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.inputSize; j++) {
                this.weights1[i * this.inputSize + j] += weights1Delta[i * this.inputSize + j] / batchSize;
            }
        }
    }

}

// Convert text to vector based on vocabulary
function textToVector(text, vocabulary) {
    const words = text.split(/\W+/);
    const vector = Array.from({ length: vocabulary.length }, () => 0);
    words.forEach(word => {
        const index = vocabulary.indexOf(word.toLowerCase());
        if (index !== -1) vector[index] += 1;
    });
    return vector;
}

// Convert summary to target vector
function summaryToTarget(summary, summaryVocabulary) {
    const vector = Array.from({ length: summaryVocabulary.length }, () => 0);
    const index = summaryVocabulary.indexOf(summary.toLowerCase());
    if (index !== -1) vector[index] = 1;
    return vector;
}

function generateHashtext(text) { 
     const words = text.split(" ");
     const hashTags = words.filter(word => word.startsWith("#"));
     // now makeUp some hash tags
     const hashTagCount = Math.floor(Math.random() * 3) + 1;
     for (let i = 0; i < hashTagCount; i++) {
         const word = words[Math.floor(Math.random() * words.length)];
         hashTags.push("#" + word);
     }
     return hashTags;
}
// Create vocabulary and summary vocabulary
const vocabulary = Array.from(new Set(
    trainingData.flatMap(data => data.text.split(/\W+/).map(word => word.toLowerCase()))
)) as string[];

const summaryVocabulary = Array.from(new Set(trainingData.map(data => data.summary.toLowerCase())));

// Initialize the neural network
const neuralNetwork = new NeuralNetwork(vocabulary.length, 10, summaryVocabulary.length); // Adjust hidden size as needed
 
const start = Date.now()
const batchSize = 32; // Number of samples per batch
const batchesPerInterval = 100; // Number of batches to process per interval
const intervalDuration = 5000; // Duration of interval in milliseconds (5 seconds)

let currentBatch = 0;
const totalBatches = Math.ceil(trainingData.length / batchSize);

const trainInterval = setInterval(() => {
    let batchesProcessed = 0;
    while (batchesProcessed < batchesPerInterval && currentBatch < totalBatches) {
        const start = currentBatch * batchSize;
        const end = start + batchSize;
        const batch = trainingData.slice(start, end);
        const inputs = batch.map(data => textToVector(data.text, vocabulary));
        const targets = batch.map(data => summaryToTarget(data.summary, summaryVocabulary));
        neuralNetwork.trainBatch(inputs, targets);

        currentBatch++;
        batchesProcessed++;
    }

    if (currentBatch >= totalBatches) {
        clearInterval(trainInterval);
        
        const end = Date.now()
        console.log(`Nueral Network ✨ Training complete`);
    }
}, intervalDuration); 
 
 

export  {NeuralNetwork, textToVector, summaryToTarget, vocabulary, summaryVocabulary, neuralNetwork, testData, generateHashtext}