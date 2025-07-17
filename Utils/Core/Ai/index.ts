//@ts-nocheck
import config from "./config.toml"
const { dataset: trainingData } = {

    "dataset": [
        { "text": "Just finished my morning coffee ☕️ Ready to tackle the day!", "summary": "morning motivation" },
        { "text": "This view is unreal 😍 #sunset", "summary": "sharing sunset photo" },
        { "text": "Does anyone have book recommendations for summer reading?", "summary": "asking for book recs" },
        { "text": "Monday mood: trying to get my life together 🤦‍♀️", "summary": "monday mood" },
        { "text": "Check out our new product launch happening tomorrow!", "summary": "product announcement" },
        { "text": "Feeling grateful for small wins today. 💪", "summary": "gratitude post" },
        { "text": "When the WiFi drops during a meeting... 🙃", "summary": "wifi meme" },
        { "text": "What’s your go-to comfort food?", "summary": "asking about comfort food" },
        { "text": "Throwback to last year’s vacation! 🏖️", "summary": "throwback travel" },
        { "text": "New blog post is up! Link in bio.", "summary": "blog promotion" },
        { "text": "Can’t believe it’s already July. Where did the time go?", "summary": "time flies" },
        { "text": "This puppy made my day 🐶", "summary": "cute puppy post" },
        { "text": "Poll: Do you prefer working from home or the office?", "summary": "work preference poll" },
        { "text": "So ready for the weekend! 🎉", "summary": "weekend plans" },
        { "text": "Starting my fitness journey today 💪 Wish me luck!", "summary": "fitness journey" },
        { "text": "Coffee first, adulting second.", "summary": "coffee meme" },
        { "text": "Here’s a sneak peek of our upcoming feature 👀", "summary": "product teaser" },
        { "text": "Anyone else obsessed with true crime podcasts?", "summary": "true crime fan" },
        { "text": "This song has been on repeat all day 🎶", "summary": "sharing music" },
        { "text": "Rainy days call for Netflix and chill. ☔️", "summary": "rainy day plans" },
        { "text": "New recipe: easy 15-min pasta 🍝", "summary": "sharing recipe" },
        { "text": "Manifesting good vibes only ✨", "summary": "positive vibes" },
        { "text": "Who remembers these? 😂 #nostalgia", "summary": "nostalgia post" },
        { "text": "Working on some exciting updates, stay tuned!", "summary": "update teaser" },
        { "text": "This meme sums up my life rn 😂", "summary": "funny meme" },
        { "text": "Finally hit 1k followers! Thank you!!", "summary": "milestone celebration" },
        { "text": "Just started a new book 📚", "summary": "reading update" },
        { "text": "How do you stay productive working from home?", "summary": "productivity tips" },
        { "text": "Can’t wait for the new season to drop! 📺", "summary": "tv show hype" },
        { "text": "Best thing I bought this month 🔥", "summary": "product recommendation" },
        { "text": "Good morning! What’s everyone up to today?", "summary": "morning check-in" },
        { "text": "Weekend getaway starts now! ✈️", "summary": "travel plans" },
        { "text": "Life lately 📸", "summary": "life update" },
        { "text": "Late night thoughts...", "summary": "late night post" },
        { "text": "New tattoo, who dis? 😎", "summary": "new tattoo" },
        { "text": "Just baked these cookies 🍪", "summary": "baking post" },
        { "text": "Self-care Sunday 🧖‍♀️", "summary": "self-care" },
        { "text": "Today’s outfit vibes ✨", "summary": "ootd" },
        { "text": "Birthday week starts now! 🎂", "summary": "birthday post" },
        { "text": "Started journaling again 📝", "summary": "journaling" },
        { "text": "What’s the best way to unwind after work?", "summary": "relaxation tips" },
        { "text": "Trying out a new hobby 🎨", "summary": "new hobby" },
        { "text": "I need vacation ideas! Drop yours below.", "summary": "asking for vacation ideas" },
        { "text": "Anyone else drink 3+ cups of coffee daily? ☕️", "summary": "coffee addiction" },
        { "text": "Current mood: sleepy 💤", "summary": "sleepy mood" },
        { "text": "Random act of kindness today 💙", "summary": "kindness" },
        { "text": "Back to the grind.", "summary": "work hustle" },
        { "text": "New hair, who dis? 💇‍♀️", "summary": "new hairstyle" },
        { "text": "Throwing it back to good times. 📷", "summary": "throwback memories" },
        { "text": "Made it to Friday, barely. 😂", "summary": "friday mood" },
        { "text": "Daily reminder: drink your water! 💧", "summary": "hydration reminder" },
        { "text": "Game night with the crew 🎲", "summary": "game night" },
        { "text": "Today’s vibe: cozy and chill.", "summary": "cozy mood" },
        { "text": "Trying a new workout routine today 🏋️", "summary": "new workout" },
        { "text": "When in doubt, nap it out.", "summary": "nap meme" },
        { "text": "Craving sushi so bad 🍣", "summary": "sushi craving" },
        { "text": "Could use a beach day right now 🏝️", "summary": "beach mood" },
        { "text": "So proud of this little win today 👏", "summary": "small win" },
        { "text": "Mood: blasting old school hits 🎧", "summary": "music mood" },
        { "text": "It’s the little things ✨", "summary": "appreciating small things" },
        { "text": "Currently obsessed with this show 📺", "summary": "tv show binge" },
        { "text": "Does pineapple belong on pizza? 🍍🍕", "summary": "pizza debate" },
        { "text": "Love this community ❤️", "summary": "community love" },
        { "text": "The struggle is real 😂", "summary": "relatable struggle" },
        { "text": "New day, same hustle.", "summary": "hustle motivation" },
        { "text": "Early morning run done! 🏃‍♀️", "summary": "morning run" },
        { "text": "This filter tho 😂", "summary": "filter fun" },
        { "text": "Pets make everything better 🐱🐶", "summary": "pet love" },
        { "text": "Trying to adult but failing miserably.", "summary": "adulting struggle" },
        { "text": "Life hack: take breaks.", "summary": "life hack" },
        { "text": "Date night vibes 💕", "summary": "date night" },
        { "text": "Sharing some Monday motivation 💪", "summary": "monday motivation" },
        { "text": "Can we normalize naps at work?", "summary": "workplace naps" },
        { "text": "Thankful for good friends 🫶", "summary": "friend appreciation" },
        { "text": "Feeling cute, might delete later.", "summary": "selfie" },
        { "text": "Rainy day playlist on repeat.", "summary": "music share" },
        { "text": "Today’s goal: survive.", "summary": "daily goal" },
        { "text": "Life’s too short for bad vibes.", "summary": "good vibes only" },
        { "text": "So many emails, so little motivation.", "summary": "work email rant" },
        { "text": "New vlog is live! 🎥", "summary": "vlog post" },
        { "text": "Trying to stay positive.", "summary": "positivity" },
        { "text": "Weekend mood: pajamas all day.", "summary": "weekend chill" },
        { "text": "Just because. 💐", "summary": "random post" },
        { "text": "Mondays should be optional.", "summary": "monday rant" },
        { "text": "What’s your favorite quote?", "summary": "quote question" },
        { "text": "Could use a nap right now.", "summary": "nap mood" },
        { "text": "Best part of today: coffee.", "summary": "coffee love" },
        { "text": "Stay weird.", "summary": "quirky post" },
        { "text": "Making moves, silently.", "summary": "silent hustle" },
        { "text": "Adulting is hard.", "summary": "adulting rant" },
        { "text": "What’s everyone watching lately?", "summary": "tv question" },
        { "text": "Here’s to growth 🌱", "summary": "growth mindset" },
        { "text": "Sleep? Never heard of her.", "summary": "sleep joke" },
        { "text": "Trying to read more this month.", "summary": "reading goal" },
        { "text": "Blessed & stressed.", "summary": "life update" },
        { "text": "What’s your go-to productivity hack?", "summary": "productivity tips" },
        { "text": "eee glock ", "summary": "unproductive" },
        { "text": "Just voted! Every voice counts. 🗳️ #ElectionDay", "summary": "civic engagement" },
        { "text": "Can’t wait to try this new vegan recipe! 🌱", "summary": "vegan food" },
        { "text": "Monday blues hitting hard today...", "summary": "monday mood" },
        { "text": "Throwback to the best concert ever 🎤🎶", "summary": "concert memories" },
        { "text": "Feeling anxious about the future. Anyone else?", "summary": "anxiety" },
        { "text": "Tips for better time management? Drop yours below!", "summary": "asking for tips" },
        { "text": "Celebrating small wins today! 🎉 #progress", "summary": "celebration" },
        { "text": "New podcast episode just dropped! Tune in 🎧", "summary": "podcast promotion" },
        { "text": "Stuck in traffic... send help! 🚗", "summary": "commute struggles" },
        { "text": "Trying to unplug for the weekend. Phone off! 📵", "summary": "digital detox" },
        { "text": "Here’s my workout playlist, what’s yours?", "summary": "music share" },
        { "text": "Can anyone recommend a good therapist?", "summary": "mental health" },
        { "text": "Today’s office snack: homemade granola bars 🥣", "summary": "food post" },
        { "text": "Meetup this Friday! Who’s coming?", "summary": "event announcement" },
        { "text": "Just adopted a puppy! Meet Max 🐕", "summary": "pet adoption" },
        { "text": "Why is adulting so hard?", "summary": "adulting struggle" },
        { "text": "Celebrating pride month with love and support 🌈", "summary": "pride month" },
        { "text": "Best way to stay motivated while working remotely?", "summary": "work motivation" },
        { "text": "Got my vaccine today 💉 feeling relieved!", "summary": "health update" },
        { "text": "Working on my side hustle grind.", "summary": "hustle" },
        { "text": "Need a vacation ASAP. Suggestions?", "summary": "vacation ideas" },
        { "text": "Just finished watching the finale, what a twist!", "summary": "tv show finale" },
        { "text": "What’s the best self-care routine?", "summary": "self-care" },
        { "text": "Sharing my latest artwork! 🎨", "summary": "art share" },
        { "text": "Trying meditation for the first time. Tips?", "summary": "meditation" },
        { "text": "Feeling overwhelmed, need a break.", "summary": "stress" },
        { "text": "Who else loves spontaneous road trips?", "summary": "road trips" },
        { "text": "Celebrating my birthday with family 🎂", "summary": "birthday celebration" },
        { "text": "Here’s to new beginnings!", "summary": "new beginnings" },
        { "text": "Update: The server will be down for maintenance at midnight.", "summary": "system update" },
        { "text": "Reminder: Meeting rescheduled to 3 PM.", "summary": "meeting reminder" },
        { "text": "What’s everyone’s weekend plans?", "summary": "weekend plans" },
        { "text": "ICYMI: Here’s a recap of today’s news.", "summary": "news recap" },
        { "text": "Is anyone else struggling with motivation today?", "summary": "motivation struggles" },
        { "text": "CNN just released a new documentary series.", "summary": "media update" }
    ]

}

// Define sigmoid and its derivative
// Enhanced text processing and neural network implementation
function extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
}
// Improved text preprocessing with stemming and stopword removal
function preprocessText(text: string): string[] {
    const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of']);

    // Simple stemmer (consider using a library like natural for production)
    const stem = (word: string) => {
        if (word.length > 4) {
            if (word.endsWith('ing')) return word.slice(0, -3);
            if (word.endsWith('ly')) return word.slice(0, -2);
            if (word.endsWith('s')) return word.slice(0, -1);
        }
        return word;
    };

    return text ? text.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .map(stem) : [""]
}

// Enhanced text to vector with TF-IDF weighting
function textToVector(text: string, vocabulary: string[], idfWeights?: number[]): number[] {
    const words = preprocessText(text);
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
        if (vocabulary.includes(word)) {
            wordCount[word] = (wordCount[word] || 0) + 1;
        }
    }
    );
    const vector = Array.from({ length: vocabulary.length }, () => 0);
    vocabulary.forEach((word, index) => {
        const tf = wordCount[word] || 0;
        const idf = idfWeights ? idfWeights[index] : 1; // Use IDF if provided
        vector[index] = tf * idf;
    });
    return vector;
}

// Calculate IDF weights for vocabulary
function calculateIDFWeights(vocabulary: string[], documents: string[]): number[] {
    const docCount = documents.length;
    return vocabulary.map(word => {
        const docsWithWord = documents.filter(doc =>
            preprocessText(doc).includes(word)
        ).length;
        return Math.log((docCount + 1) / (docsWithWord + 1)) + 1;
    });
}

// Enhanced summary to target with multi-label support
function summaryToTarget(summary: string, summaryVocabulary: string[]): number[] {
    const targets = Array.from({ length: summaryVocabulary.length }, () => 0);
    const summaryTerms = preprocessText(summary);
    summaryTerms.forEach(term => {
        const index = summaryVocabulary.indexOf(term);
        if (index !== -1) targets[index] = 1;
    });
    return targets;
}

// Enhanced hashtag generation with relevance scoring
function generateHashtags(text: string, numTags = 3): string[] {
    const words = preprocessText(text);
    const wordScores: Record<string, number> = {};

    // Score words by frequency and position
    words.forEach((word, index) => {
        wordScores[word] = (wordScores[word] || 0) + 1 + (1 / (index + 1));
    });

    // Sort by score and take top N
    return Object.entries(wordScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, numTags)
        .map(([word]) => `#${word}`);
}

// Enhanced Neural Network with dropout and momentum
class EnhancedNeuralNetwork {
    private inputSize: number;
    private hiddenSize: number;
    private outputSize: number;
    private learningRate: number;
    private momentum: number;
    private dropoutRate: number;

    // Weights and biases
    private weights1: number[][];
    private weights2: number[][];
    private bias1: number[];
    private bias2: number[];

    // Momentum buffers
    private prevDeltaWeights1: number[][];
    private prevDeltaWeights2: number[][];
    private prevDeltaBias1: number[];
    private prevDeltaBias2: number[];

    constructor(
        inputSize: number,
        hiddenSize: number,
        outputSize: number,
        learningRate = 0.01,
        momentum = 0.9,
        dropoutRate = 0.2
    ) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        this.learningRate = learningRate;
        this.momentum = momentum;
        this.dropoutRate = dropoutRate;

        // Initialize weights with He initialization
        this.weights1 = Array.from({ length: hiddenSize }, () =>
            Array.from({ length: inputSize }, () => (Math.random() * Math.sqrt(2 / inputSize)))
        );
        this.weights2 = Array.from({ length: outputSize }, () =>
            Array.from({ length: hiddenSize }, () => (Math.random() * Math.sqrt(2 / hiddenSize)))
        );

        // Initialize biases
        this.bias1 = Array(hiddenSize).fill(0.1);
        this.bias2 = Array(outputSize).fill(0.1);

        // Initialize momentum buffers
        this.prevDeltaWeights1 = this.weights1.map(row => row.map(() => 0));
        this.prevDeltaWeights2 = this.weights2.map(row => row.map(() => 0));
        this.prevDeltaBias1 = Array(hiddenSize).fill(0);
        this.prevDeltaBias2 = Array(outputSize).fill(0);
    }

    private sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    private relu(x: number): number {
        return Math.max(0, x);
    }

    private softmax(values: number[]): number[] {
        const max = Math.max(...values);
        const exps = values.map(x => Math.exp(x - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(x => x / sum);
    }

    forward(input: number[], training = false): number[] {
        // Input to hidden
        const hidden = Array(this.hiddenSize).fill(0);
        for (let i = 0; i < this.hiddenSize; i++) {
            for (let j = 0; j < this.inputSize; j++) {
                hidden[i] += input[j] * this.weights1[i][j];
            }
            hidden[i] += this.bias1[i];
            hidden[i] = this.relu(hidden[i]);

            // Apply dropout during training
            if (training && Math.random() < this.dropoutRate) {
                hidden[i] = 0;
            }
        }

        // Hidden to output
        const output = Array(this.outputSize).fill(0);
        for (let i = 0; i < this.outputSize; i++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                output[i] += hidden[j] * this.weights2[i][j];
            }
            output[i] += this.bias2[i];
        }

        return this.softmax(output);
    }

    trainBatch(inputs: number[][], targets: number[][]) {
        // Initialize gradients
        const deltaWeights2 = this.weights2.map(row => row.map(() => 0));
        const deltaBias2 = Array(this.outputSize).fill(0);
        const deltaWeights1 = this.weights1.map(row => row.map(() => 0));
        const deltaBias1 = Array(this.hiddenSize).fill(0);

        // Process each sample in the batch
        for (let n = 0; n < inputs.length; n++) {
            const input = inputs[n];
            const target = targets[n];

            // Forward pass
            const hidden = Array(this.hiddenSize).fill(0);
            const hiddenPreActivation = Array(this.hiddenSize).fill(0);

            for (let i = 0; i < this.hiddenSize; i++) {
                for (let j = 0; j < this.inputSize; j++) {
                    hiddenPreActivation[i] += input[j] * this.weights1[i][j];
                }
                hiddenPreActivation[i] += this.bias1[i];
                hidden[i] = this.relu(hiddenPreActivation[i]);

                // Apply dropout mask
                if (Math.random() < this.dropoutRate) {
                    hidden[i] = 0;
                }
            }

            const output = Array(this.outputSize).fill(0);
            for (let i = 0; i < this.outputSize; i++) {
                for (let j = 0; j < this.hiddenSize; j++) {
                    output[i] += hidden[j] * this.weights2[i][j];
                }
                output[i] += this.bias2[i];
            }
            const outputActivation = this.softmax(output);

            // Backward pass
            const outputError = outputActivation.map((o, i) => o - target[i]);

            // Hidden layer error
            const hiddenError = Array(this.hiddenSize).fill(0);
            for (let j = 0; j < this.hiddenSize; j++) {
                for (let k = 0; k < this.outputSize; k++) {
                    hiddenError[j] += outputError[k] * this.weights2[k][j];
                }
                hiddenError[j] *= hiddenPreActivation[j] > 0 ? 1 : 0; // ReLU derivative
            }

            // Update weight and bias gradients
            for (let k = 0; k < this.outputSize; k++) {
                for (let j = 0; j < this.hiddenSize; j++) {
                    deltaWeights2[k][j] += outputError[k] * hidden[j];
                }
                deltaBias2[k] += outputError[k];
            }

            for (let j = 0; j < this.hiddenSize; j++) {
                for (let i = 0; i < this.inputSize; i++) {
                    deltaWeights1[j][i] += hiddenError[j] * input[i];
                }
                deltaBias1[j] += hiddenError[j];
            }
        }

        // Apply momentum and update weights
        const batchSize = inputs.length;
        for (let k = 0; k < this.outputSize; k++) {
            for (let j = 0; j < this.hiddenSize; j++) {
                const delta = deltaWeights2[k][j] / batchSize;
                const momentumDelta = this.momentum * this.prevDeltaWeights2[k][j];
                this.weights2[k][j] -= this.learningRate * (delta + momentumDelta);
                this.prevDeltaWeights2[k][j] = delta;
            }
            const delta = deltaBias2[k] / batchSize;
            const momentumDelta = this.momentum * this.prevDeltaBias2[k];
            this.bias2[k] -= this.learningRate * (delta + momentumDelta);
            this.prevDeltaBias2[k] = delta;
        }

        for (let j = 0; j < this.hiddenSize; j++) {
            for (let i = 0; i < this.inputSize; i++) {
                const delta = deltaWeights1[j][i] / batchSize;
                const momentumDelta = this.momentum * this.prevDeltaWeights1[j][i];
                this.weights1[j][i] -= this.learningRate * (delta + momentumDelta);
                this.prevDeltaWeights1[j][i] = delta;
            }
            const delta = deltaBias1[j] / batchSize;
            const momentumDelta = this.momentum * this.prevDeltaBias1[j];
            this.bias1[j] -= this.learningRate * (delta + momentumDelta);
            this.prevDeltaBias1[j] = delta;
        }
    }

    predict(text: string, vocabulary: string[], idfWeights?: number[]): string {
        const vector = textToVector(text, vocabulary, idfWeights);
        const output = this.forward(vector);
        const maxIndex = output.indexOf(Math.max(...output));
        return summaryVocabulary[maxIndex];
    }
}

/**
 * Multi-label neural network core
 * Example assumes:
 *  - you have input vectors
 *  - you have multi-label targets
 *  - output activation: sigmoid
 *  - loss: binary cross-entropy
 *  - accuracy: thresholded match
 */

class SimpleMultiLabelNN {
    weights: number[][];
    biases: number[];

    constructor(inputSize: number, outputSize: number) {
        this.weights = Array.from({ length: outputSize }, () =>
            Array.from({ length: inputSize }, () => Math.random() - 0.5)
        );
        this.biases = Array.from({ length: outputSize }, () => Math.random() - 0.5);
    }

    private sigmoid(x: number): number {
        return 1 / (1 + Math.exp(-x));
    }

    forward(input: number[]): number[] {
        return this.weights.map((wRow, i) => {
            const dot = wRow.reduce((sum, w, j) => sum + w * input[j], 0);
            return this.sigmoid(dot + this.biases[i]);
        });
    }

    // Example gradient update with simple SGD
    train(inputs: number[][], targets: number[][], epochs = 100, lr = 0.01) {
        for (let epoch = 0; epoch < epochs; epoch++) {
            let totalLoss = 0;
            let totalCorrect = 0;

            for (let idx = 0; idx < inputs.length; idx++) {
                const x = inputs[idx];
                const y = targets[idx];
                const preds = this.forward(x);

                // Binary cross-entropy per output
                const errors = preds.map((p, i) => p - y[i]);
                const loss = preds.reduce(
                    (sum, p, i) => sum - (y[i] * Math.log(p + 1e-15) + (1 - y[i]) * Math.log(1 - p + 1e-15)),
                    0
                ) / preds.length;

                totalLoss += loss;

                // SGD update
                for (let i = 0; i < this.weights.length; i++) {
                    for (let j = 0; j < this.weights[i].length; j++) {
                        this.weights[i][j] -= lr * errors[i] * x[j];
                    }
                    this.biases[i] -= lr * errors[i];
                }

                // Multi-label correctness: count matches
                const predictedLabels = preds.map(p => (p >= 0.5 ? 1 : 0));
                const matches = predictedLabels.filter((v, i) => v === y[i]).length;
                totalCorrect += matches / y.length;
            }

            console.log(`Epoch ${epoch + 1}: Loss=${(totalLoss / inputs.length).toFixed(4)}, Acc=${(totalCorrect / inputs.length * 100).toFixed(2)}%`);
        }
    }
}


// Create vocabulary and summary vocabulary with enhanced processing
const documents = trainingData.map(data => data.text);
const vocabulary = Array.from(new Set(
    trainingData.flatMap(data => preprocessText(data.text))
)).filter(Boolean) as string[];

const idfWeights = calculateIDFWeights(vocabulary, documents);

const summaryVocabulary = Array.from(new Set(
    trainingData.flatMap(data => data.summary.toLowerCase().split(/\s*,\s*/))
)).filter(Boolean) as string[];

// Initialize the enhanced neural network
const inputSize = vocabulary.length;
const hiddenSize = Math.max(10, Math.floor(inputSize / 2)); // Dynamic
const outputSize = summaryVocabulary.length;
const learningRate = 0.001;
const momentum = 0.4;
const dropoutRate = 0.5;
const neuralNetwork = new SimpleMultiLabelNN(inputSize, outputSize);


// Train the model with enhanced data processing
function trainModel() {
    const inputVectors = trainingData.map(d => textToVector(d.text, vocabulary, idfWeights));
    const targetVectors = trainingData.map(d => summaryToTarget(d.summary, summaryVocabulary));

    neuralNetwork.train(inputVectors, targetVectors, 100, learningRate);

    const testText = "postr is a great platform for sharing content";
    console.log(`\nTesting with: "${testText}"`);

    const prediction = neuralNetwork.forward(textToVector(testText, vocabulary, idfWeights));

    const ACTIVATION_THRESHOLD = 0.5;   // probability cutoff for each label
    const MIN_CONFIDENCE = 0.4;         // minimum confidence fallback

    const predictedLabels = prediction.map(p => p >= ACTIVATION_THRESHOLD ? 1 : 0);
    const firedCount = predictedLabels.reduce((sum, val) => sum + val, 0);

    const predictedSummaryText = predictedLabels
        .map((label, index) => label ? summaryVocabulary[index] : null)
        .filter(Boolean)
        .join(', ');

    const maxProb = Math.max(...prediction);
    console.log(`Raw prediction: ${prediction.map(p => p.toFixed(3)).join(', ')}`);
    console.log(`Fired labels: ${firedCount}, Max confidence: ${maxProb.toFixed(3)}`);

}
 




export {
    EnhancedNeuralNetwork as NeuralNetwork,
    textToVector,
    summaryToTarget,
    vocabulary,
    summaryVocabulary,
    neuralNetwork,
    generateHashtags as generateHashtext,
    extractHashtags,
    preprocessText
};