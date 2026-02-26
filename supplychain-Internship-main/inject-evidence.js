const { MongoClient } = require('mongodb');

// Same URI used in your supplychain-Internship-main/lib/mongodb.js file
const uri = "mongodb+srv://omkar:omkardeepak@cluster0.42fffku.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function injectTestData() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('signup');

        console.log("Connected to MongoDB -> Database 'signup'");

        // 1. Get a common timestamp
        const now = new Date();

        // 2. We need the farmer's ID to associate the sensor data to their farm
        // In the screenshot, the user is logged in as "farmer1". Let's try to find them.
        const farmer = await db.collection('farmer').findOne({ name: "farmer1" });
        if (!farmer) {
            console.log("Could not find 'farmer1' in the DB. Generating random ID for sensor data.");
        }
        const farmId = farmer ? farmer._id : "68f1f0ad8b1f5c98334fb5a5";

        // 3. Insert fake abnormal sensor data 
        const sensorResult = await db.collection('sensorData').insertOne({
            temperature: 25.5,
            humidity: 35,
            soil: 20, // Below 30% threshold
            rain: 0,
            farmId: farmId,
            timestamp: now
        });
        console.log("Injected Sensor Data!");

        // 4. Insert a fake image hash with the EXACT same timestamp
        const imageResult = await db.collection('image_hashes').insertOne({
            reportedHash: "fakehash123",
            calculatedHash: "fakehash123",
            isMatch: true,
            sizeBytes: 1024,
            imagePath: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?q=80&w=500&auto=format&fit=crop", // Dummy image of dry land
            timestamp: now
        });
        console.log("Injected Image Hash!");

        console.log("\nSuccess! Both datasets have timestamp:", now);
        console.log("The UI should now correlate these and display them.");

    } catch (error) {
        console.error("Error connecting to database:", error);
    } finally {
        await client.close();
    }
}

injectTestData();
