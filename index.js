const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@clusterone.0khaeh6.mongodb.net/?retryWrites=true&w=majority&appName=ClusterOne`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {


    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        const db = client.db("FitNess");
        const userCollection = db.collection('user_information')
        const newsletterCollection = db.collection("newsletter_subscribers")
        const trainerCollection = db.collection('all_trainers')


        // add a new user here

        app.post("/addNewUser", async (req, res) => {
            const userData = req.body;
            const { email } = userData
            try {

                const existingUser = await userCollection.findOne({ email: email });
                if (existingUser) {
                    return res.status(409).send({ message: "User already exists" });
                }


                const result = await userCollection.insertOne(userData);
                res.status(201).send({ message: "User saved", result });

            } catch (err) {

                res.status(500).send({ message: "Server error", error: err.message });
            }

        });

        // save news letter subscriber

        app.post("/newsletter-subscribe", async (req, res) => {
            try {
                const { name, email } = req.body;

                if (!email || !name) {
                    return res.status(400).send({ error: "Name and Email are required" });
                }

                // Check if the email already exists
                const existingSubscriber = await newsletterCollection.findOne({ email });

                if (existingSubscriber) {
                    return res.status(409).send({ error: "You are already subscribed." });
                }

                const result = await newsletterCollection.insertOne({
                    name,
                    email,
                    subscribedAt: new Date().toISOString()
                });

                res.send({ success: true, insertedId: result.insertedId });
            } catch (err) {
                console.error(err);
                res.status(500).send({ error: "Failed to subscribe" });
            }
        });

        // route to apply for become a trainer 

        app.post('/be-trainer', async (req, res) => {
            try {
                const {
                    fullName,
                    email,
                    age,
                    profileImage,
                    skills,
                    availableDays,
                    availableTime,
                    otherInfo,
                    experience,
                    socialLinks
                } = req.body;

                // Check if trainer already applied
                const alreadyApplied = await trainerCollection.findOne({ email });
                if (alreadyApplied) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already applied as a trainer.'
                    });
                }

                const trainerData = {
                    fullName,
                    email,
                    age,
                    profileImage,
                    skills,              // array
                    availableDays,       // array
                    availableTime,
                    otherInfo,
                    experience,
                    socialLinks,
                    status: 'pending',
                    appliedAt: new Date().toISOString()
                };

                const result = await trainerCollection.insertOne(trainerData);

                res.send({
                    success: true,
                    insertedId: result.insertedId,
                    message: 'Trainer application submitted successfully.'
                });

            } catch (error) {
                console.error('Trainer apply error:', error);
                res.status(500).json({
                    success: false,
                    message: 'Server error. Please try again later.'
                });
            }
        });

        // get list of all newsletter subscriber

        app.get("/newsletter-subscribers", async (req, res) => {
            try {
                const subscribers = await newsletterCollection.find().toArray();
                res.send(subscribers);
            } catch (err) {
                res.status(500).send({ error: "Failed to fetch subscribers" });
            }
        });

        // get all pending trainers list 

        app.get("/pending-trainers", async (req, res) => {
            try {
                const pendingTrainers = await trainerCollection.find({ status: "pending" }).toArray();
                res.send(pendingTrainers);
            } catch (error) {
                console.error("Error fetching pending trainers:", error);
                res.status(500).send({ error: "Failed to fetch pending trainers." });
            }
        });

        // get details of specific trainers

        app.get("/trainers-details/:id", async (req, res) => {
            const id = req.params.id;

            try {
                const trainer = await trainerCollection.findOne({ _id: new ObjectId(id) });

                if (!trainer) {
                    return res.status(404).send({ error: "Trainer not found" });
                }

                res.send(trainer);
            } catch (error) {
                console.error("Failed to fetch trainer details:", error);
                res.status(500).send({ error: "Internal Server Error" });
            }
        });


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// Example Route
app.get('/', (req, res) => {
    res.send('Hello from Express and MongoDB!');
});

app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
