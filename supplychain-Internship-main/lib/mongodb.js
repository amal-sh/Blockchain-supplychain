import { MongoClient } from "mongodb";


let cachedClient = null;
let cachedDb = null;

// Connect to MongoDB Atlas
export async function connectToDatabase(dbName = "signup") {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }
    const uri = "mongodb+srv://omkar:omkardeepak@cluster0.42fffku.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; 
    const client = new MongoClient(uri, {
        connectTimeoutMS: 40000,
        serverSelectionTimeoutMS: 40000,
    });

    await client.connect();
    const db = client.db(dbName); // Creates DB dynamically if it doesn’t exist

    cachedClient = client;
    cachedDb = db;

    return { client, db };
}