//@ts-nocheck
import config from "./config.toml" 
const { dataset: trainingData } = {
    "dataset": [
        {"text":"Hello world", "summary":"greeting the world"},
        {"text":"Goodbye to the world", "summary":"saying goodbye to the world"},
        {"text": "The weather today is sunny with a high of 75 degrees. It's a great day for a picnic.", "summary": "sunny weather"},
        {"text": "New advancements in AI technology are rapidly changing the tech industry.", "summary": "AI advancements"},
        {"text": "Eating a balanced diet is essential for maintaining good health and energy levels.", "summary": "balanced diet"},
        {"text": "The latest smartphone models feature improved cameras and faster processors.", "summary": "smartphone features"},
        {"text": "Taking a walk in the park can be a great way to relieve stress and enjoy nature.", "summary": "stress relief"},
        {"text": "The new movie release has received rave reviews for its engaging storyline and visual effects.", "summary": "movie reviews"},
        {"text": "Regular exercise helps in managing weight and improving cardiovascular health.", "summary": "regular exercise"},
        {"text": "Learning a new language can be both challenging and rewarding, offering new opportunities.", "summary": "learning languages"},
        {"text": "The annual tech conference will showcase innovations in robotics and artificial intelligence.", "summary": "tech conference"},
        {"text": "Gardening can be a relaxing hobby and a way to grow fresh vegetables and flowers.", "summary": "gardening benefits"},
        {"text": "Online shopping offers convenience and a wide range of products at competitive prices.", "summary": "online shopping"},
        {"text": "Reading books can enhance knowledge, improve focus, and provide entertainment.", "summary": "benefits of reading"},
        {"text": "Traveling to new destinations allows you to experience different cultures and cuisines.", "summary": "travel experiences"},
        {"text": "Meditation and mindfulness practices can help improve mental clarity and reduce anxiety.", "summary": "mindfulness benefits"},
        {"text": "Starting a new hobby can be a great way to meet new people and develop new skills.", "summary": "starting hobbies"},
        {"text":"Postr rewrite 2024 - Postr was rewritten in solid.js because the old codebase written in next became clunky and unusable", "summary":"postr rewrite"},
        {"text": "Sustainable living practices are crucial for reducing our environmental impact.", "summary": "sustainable living"},
        {"text": "High-speed internet access is essential for remote work and online education.", "summary": "internet access"},
        {"text": "Cooking at home can be healthier and more cost-effective compared to eating out.", "summary": "cooking at home"},
        {"text": "Investing in the stock market can provide financial growth opportunities over time.", "summary": "stock market investing"},
        {"text": "Using public transportation can reduce traffic congestion and environmental pollution.", "summary": "public transportation"},
        {"text": "Home improvement projects can increase property value and enhance living spaces.", "summary": "home improvement"},
        {"text": "Social media platforms offer a way to connect with friends and share experiences.", "summary": "social media"},
        {"text": "Music therapy can be an effective method for managing stress and improving mood.", "summary": "music therapy"},
        {"text": "Exercise routines can vary from cardio to strength training, each with unique benefits.", "summary": "exercise routines"},
        {"text": "Volunteering is a way to contribute to the community and gain personal satisfaction.", "summary": "volunteering benefits"},
        {"text": "Photography can capture memories and provide a creative outlet for artistic expression.", "summary": "photography"},
        {"text": "DIY crafts can be a fun and creative way to spend your free time.", "summary": "DIY crafts"},
        {"text": "Healthy sleep habits are important for overall well-being and daily functioning.", "summary": "healthy sleep"},
        {"text": "Smart home technology can improve convenience and energy efficiency.", "summary": "smart home tech"},
        {"text": "Participating in sports can improve physical fitness and foster teamwork skills.", "summary": "sports participation"},
        {"text": "Caring for pets can bring joy and companionship to your life.", "summary": "pet care"},
        {"text": "Financial planning and budgeting are key to managing personal finances effectively.", "summary": "financial planning"},
        {"text": "Attending educational workshops can provide valuable learning opportunities.", "summary": "educational workshops"},
        {"text": "Art exhibitions showcase creativity and offer a cultural experience.", "summary": "art exhibitions"},
        {"text": "Healthy eating habits can improve overall health and prevent chronic diseases.", "summary": "healthy eating"},
        {"text": "Crafting handmade gifts adds a personal touch and can be more meaningful.", "summary": "handmade gifts"},
        {"text": "Learning to code opens up career opportunities in the tech industry.", "summary": "learning to code"},
        {"text": "Participating in community events helps build connections and support local causes.", "summary": "community events"},
        {"text": "Personal development books can provide guidance and inspiration for self-improvement.", "summary": "personal development"},
        {"text": "Staying hydrated is crucial for maintaining good health and bodily functions.", "summary": "hydration"},
        {"text": "Attending concerts and live performances can be an exciting way to enjoy music.", "summary": "live performances"},
        {"text": "Exploring different cuisines can be a delightful culinary adventure.", "summary": "exploring cuisines"},
        {"text": "Digital marketing strategies can help businesses reach a larger audience online.", "summary": "digital marketing"},
        {"text": "Investing in renewable energy sources supports environmental sustainability.", "summary": "renewable energy"},
        {"text": "Effective communication skills are essential for successful personal and professional relationships.", "summary": "communication skills"},
        {"text": "Learning about history can provide insight into different cultures and societies.", "summary": "history"},
        {"text": "Developing problem-solving skills can enhance decision-making abilities.", "summary": "problem-solving skills"},
        {"text": "Maintaining work-life balance is important for overall health and job satisfaction.", "summary": "work-life balance"},
        {"text": "Exploring nature can be both refreshing and educational.", "summary": "exploring nature"},
        {"text": "Building strong relationships requires effort, trust, and effective communication.", "summary": "strong relationships"},
        {"text": "Using ergonomic furniture can improve comfort and reduce physical strain.", "summary": "ergonomic furniture"},
        {"text": "Engaging in creative writing can be a therapeutic and enjoyable activity.", "summary": "creative writing"},
        {"text": "Participating in online courses can offer flexible learning options.", "summary": "online courses"},
        {"text": "Effective time management can increase productivity and reduce stress.", "summary": "time management"},
        {"text": "Understanding basic first aid skills can be valuable in emergency situations.", "summary": "first aid skills"},
        {"text": "Regular dental check-ups are important for maintaining oral health.", "summary": "dental health"},
        {"text": "Exploring new hobbies can be a great way to discover hidden talents and interests.", "summary": "discovering hobbies"},
        {"text": "Practicing mindfulness can help improve focus and emotional regulation.", "summary": "mindfulness"},
        {"text": "Networking with professionals can create new career opportunities and connections.", "summary": "networking"},
        {"text": "Investing in personal growth can lead to greater fulfillment and success.", "summary": "personal growth"},
        {"text": "Maintaining a clean and organized workspace can boost productivity.", "summary": "organized workspace"},
        {"text": "Participating in fitness classes can be a fun way to stay active and motivated.", "summary": "fitness classes"},
        {"text": "Understanding different cultural practices can broaden your perspective and enhance empathy.", "summary": "cultural understanding"},
        {"text": "Practicing good posture can help prevent back and neck pain.", "summary": "good posture"},
        {"text": "Traveling by train can offer a scenic and relaxing way to see new places.", "summary": "train travel"},
        {"text": "Exploring career options can help you find a path that aligns with your interests and skills.", "summary": "career exploration"},
        {"text": "Attending workshops on public speaking can enhance your presentation skills.", "summary": "public speaking"},
        {"text": "Staying informed about current events can help you understand global issues and trends.", "summary": "current events"},
        {"text": "Engaging in team-building activities can strengthen group dynamics and collaboration.", "summary": "team-building"},
        {"text": "Maintaining a positive mindset can help you overcome challenges and achieve goals.", "summary": "positive mindset"},
        {"text": "Using productivity tools can help you stay organized and manage tasks effectively.", "summary": "productivity tools"},
        {"text": "Exploring new technologies can lead to innovative solutions and advancements.", "summary": "new technologies"},
        {"text": "Developing financial literacy can improve your ability to manage and grow wealth.", "summary": "financial literacy"},
        {"text": "Reading scientific journals can keep you updated on the latest research and discoveries.", "summary": "scientific research"},
        {"text": "Attending cultural festivals can provide a rich and diverse experience.", "summary": "cultural festivals"},
        {"text": "Building resilience can help you bounce back from setbacks and challenges.", "summary": "resilience"},
        {"text": "Understanding psychological principles can improve self-awareness and interpersonal relationships.", "summary": "psychological principles"},
        {"text": "Participating in debate clubs can enhance your critical thinking and argumentation skills.", "summary": "debate clubs"},
        {"text": "Exploring artistic expressions can foster creativity and self-discovery.", "summary": "artistic expressions"},
        {"text": "Volunteering at animal shelters can provide fulfillment and support animal welfare.", "summary": "animal shelters"},
        {"text": "Practicing relaxation techniques can help manage stress and improve well-being.", "summary": "relaxation techniques"},
        {"text": "Maintaining a balanced work schedule can prevent burnout and promote well-being.", "summary": "balanced work schedule"},
        {"text": "Learning about different political systems can provide insight into global governance.", "summary": "political systems"},
        {"text": "Engaging in community service can make a positive impact and strengthen local bonds.", "summary": "community service"},
        {"text": "Understanding basic coding principles can open up various career opportunities in tech.", "summary": "basic coding principles"},
        {"text": "Attending wellness retreats can offer relaxation and rejuvenation.", "summary": "wellness retreats"},
        {"text": "Participating in environmental conservation efforts can contribute to a healthier planet.", "summary": "environmental conservation"},
        {"text": "Learning about nutrition can improve your dietary choices and overall health.", "summary": "nutrition education"},
        {"text": "Exploring various forms of exercise can help you find activities that you enjoy.", "summary": "exercise forms"},
        {"text": "Staying updated on technological trends can help you adapt to changes in the industry.", "summary": "technological trends"},
        {"text": "Understanding market trends can guide investment and business decisions.", "summary": "market trends"},
        {"text": "Joining book clubs can provide opportunities for reading and discussing literature.", "summary": "book clubs"},
        {"text": "Engaging in creative hobbies can be a source of joy and personal fulfillment.", "summary": "creative hobbies"},
        {"text": "Exploring different cuisines can expand your culinary horizons and enhance your cooking skills.", "summary": "culinary exploration"},
        {"text": "Practicing gratitude can improve mental health and overall happiness.", "summary": "practicing gratitude"},
        {"text": "Taking online courses can provide flexibility and access to a wide range of subjects.", "summary": "online learning"},
        {"text": "Building strong friendships can enhance your social support network and well-being.", "summary": "strong friendships"},
        {"text": "Exploring different career paths can help you find a fulfilling profession.", "summary": "career paths"},
        {"text": "Engaging in mindfulness practices can improve focus and reduce stress.", "summary": "mindfulness"},
        {"text": "Attending tech meetups can provide networking opportunities and insights into industry trends.", "summary": "tech meetups"},
        {"text": "Understanding consumer behavior can help businesses tailor their marketing strategies.", "summary": "consumer behavior"},
        {"text": "Participating in fitness challenges can be a fun way to stay motivated and achieve fitness goals.", "summary": "fitness challenges"},
        {"text": "Exploring historical landmarks can offer educational and cultural experiences.", "summary": "historical landmarks"},
        {"text": "Learning to play a musical instrument can be a rewarding and enriching experience.", "summary": "playing instruments"},
        {"text": "Understanding environmental issues can foster awareness and encourage sustainable practices.", "summary": "environmental issues"},
        {"text": "Engaging in personal reflection can lead to self-discovery and growth.", "summary": "personal reflection"},
        {"text": "Building effective leadership skills can enhance your ability to guide and inspire others.", "summary": "leadership skills"},
        {"text": "Attending workshops on time management can improve productivity and efficiency.", "summary": "time management workshops"},
        {"text": "Exploring local history can provide insights into the development and culture of your area.", "summary": "local history"},
        {"text": "Engaging in creative projects can boost creativity and provide a sense of accomplishment.", "summary": "creative projects"},
        {"text": "Understanding different financial instruments can help with effective investment planning.", "summary": "financial instruments"},
        {"text": "Attending motivational seminars can provide inspiration and practical advice for personal success.", "summary": "motivational seminars"},
        {"text":"quick brown fox learns to jump", "summary":"brown fox"},
        {"text":"postr", "summary":"stating something about the postr app"}
    ]
} 
 
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