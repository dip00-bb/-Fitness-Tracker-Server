const express = require('express');
const jwt = require("jsonwebtoken");
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// json token generator function
function generateToken(userEmail) {
    return jwt.sign({ email: userEmail }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
}



function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).send("Unauthorized access");

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) return res.status(403).send("Forbidden access");
        req.user = decoded;
        next();
    });
}


async function isAdmin(req, res, next) {
    const user = await db.collection("users").findOne({ email: req.user.email });
    if (user?.role !== "admin") return res.status(403).send("Only Admin");
    next();
}

async function isTrainer(req, res, next) {
    const user = await db.collection("users").findOne({ email: req.user.email });
    if (user?.role !== "trainer") return res.status(403).send("Only Trainer");
    next();
}


const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY)

console.log(process.env.PAYMENT_GATEWAY_KEY)

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
        // await client.connect();
        // Send a ping to confirm a successful connection


        const db = client.db("FitNess");
        const userCollection = db.collection('user_information');
        const newsletterCollection = db.collection("newsletter_subscribers");
        const trainerCollection = db.collection('all_trainers');
        const classesCollection = db.collection('all_classes');
        const rejectionFeedback = db.collection('feedbacks');
        const forumsCollection = db.collection('forums_data');

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


        // add pending trainer status on user profile data
        app.patch('/add-pending-trainer-status/:email', async (req, res) => {
            const { email } = req.params;

            if (!email) {
                return res.status(400).send({ success: false, message: 'Email required' });
            }

            try {
                const result = await userCollection.updateOne(
                    { email, userRole: 'member' },
                    { $set: { trainerStatus: 'pending' } }
                );

                if (result.modifiedCount === 0) {
                    return res
                        .status(404)
                        .send({
                            success: false,
                            message: 'User not found or already pending/ trainer'
                        });
                }

                res.send({ success: true, message: 'Status changed to pending' });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // remove pending trainer status add rejected status

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

        // reject pending trainer

        app.post('/reject-trainer/:id', async (req, res) => {
            const { id } = req.params;
            const { feedback, email } = req.body;

            try {
                const result = await trainerCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res
                        .status(404)
                        .send({ success: false, message: 'Trainer not found or already removed' });
                }


                await rejectionFeedback.updateOne(
                    { email },                                  // match by user email
                    {
                        $set: {
                            email,
                            feedback,
                            rejectedAt: new Date().toISOString()
                        }
                    },
                    { upsert: true }
                )

                await userCollection.updateOne(
                    { email: email },
                    { $set: { trainerStatus: 'rejected' } }
                )

                res.send({ success: true });
            } catch (err) {
                res.status(500).send({ success: false, message: err.message });
            }
        });

        // approve the pending rider and change rule and status

        app.patch('/approve-trainer/:id', async (req, res) => {
            const trainerId = req.params.id;

            try {
                // Step 1: Update trainer status
                const trainerResult = await trainerCollection.updateOne(
                    { _id: new ObjectId(trainerId) },
                    { $set: { status: 'approved' } }
                );

                if (trainerResult.modifiedCount === 0) {
                    return res.status(404).send({ success: false, message: 'Trainer not found or already approved' });
                }

                // Step 2: Get trainer's email
                const trainer = await trainerCollection.findOne({ _id: new ObjectId(trainerId) });
                const trainerEmail = trainer.email;

                // Step 3: Update user role
                const userResult = await userCollection.updateOne(
                    { email: trainerEmail },
                    { $set: { userRole: 'trainer' } }
                );

                if (userResult.modifiedCount === 0) {
                    return res.status(404).send({ success: false, message: 'User not found or role already trainer' });
                }

                res.send({ success: true, message: 'Trainer approved and user role updated' });

            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // get all approved trainers

        app.get('/approved-trainers', async (req, res) => {
            try {
                const approved = await trainerCollection.find({ status: 'approved' }).toArray();
                res.send(approved);
            } catch (err) {
                res.status(500).send({ success: false, message: 'Error fetching trainers' });
            }
        });


        // added classes by admin 

        app.post('/admin-classes', async (req, res) => {
            try {
                const { name, image, details, extraInfo } = req.body;
                const result = await classesCollection.insertOne({
                    name,
                    image,
                    details,
                    extraInfo,
                    trainer: [],
                    createdAt: new Date()
                });
                res.send({ success: true, insertedId: result.insertedId });
            } catch (err) {
                res.status(500).send({ success: false, error: err.message });
            }
        });


        // after delete a trainer demote him into member

        app.patch('/demote-to-member', async (req, res) => {
            const { email } = req.body;
            if (!email) return res.status(400).send({ success: false, message: 'Email required' });

            try {
                const result = await userCollection.updateOne(
                    { email },
                    { $set: { userRole: 'member' } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ success: false, message: 'User not found or already member' });
                }

                res.send({ success: true, message: 'User demoted to member' });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });


        // remove trainer data from trainer collection

        app.delete('/delete-trainer', async (req, res) => {
            const { email } = req.query;
            if (!email) return res.status(400).send({ success: false, message: 'Email query param required' });

            try {
                const result = await trainerCollection.deleteOne({ email });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ success: false, message: 'Trainer not found' });
                }

                res.send({ success: true, message: 'Trainer removed from trainerCollection' });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // returns all class docs for the select list

        app.get('/admin-classes', async (_req, res) => {
            try {
                const classes = await classesCollection
                    .find({})
                    .toArray();
                res.send({ success: true, data: classes });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // get previously added data by a trainer for read only ui

        app.get('/add-new-slot/:email', async (req, res) => {
            const { email } = req.params;

            try {
                const trainer = await trainerCollection.findOne(
                    { email, status: 'approved' },
                    {
                        projection: {
                            _id: 1,
                            fullName: 1,
                            email: 1,
                            availableDays: 1,
                            availableTime: 1,
                            skills: 1,
                            profileImage: 1
                        }
                    }
                );

                if (!trainer) {
                    return res
                        .status(404)
                        .send({ success: false, message: 'Trainer not found' });
                }

                res.send({ success: true, data: trainer });

            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // this will add new slot information in exiting trainer data set
        app.patch('/add-new-slot/:email', async (req, res) => {


            const { email } = req.params;
            const { slotName, slotTime, slotDay, classId, extraInfo, trainerID, trainerEmail } = req.body;

            // minimal validation
            if (!slotName || !slotDay || !classId) {
                return res
                    .status(400)
                    .send({ success: false, message: 'Missing slot fields' });
            }

            const newSlot = {
                _id: new ObjectId(),           // give each slot its own id
                slotName,
                trainerID,
                slotDay,
                slotTime,
                trainerEmail,
                classId: classId,
                extraInfo
            };

            try {
                const result = await trainerCollection.updateOne(

                    { email, status: 'approved' },
                    { $push: { slots: newSlot } },
                );

                if (result.modifiedCount === 0) {
                    return res
                        .status(404)
                        .send({ success: false, message: 'Trainer not found or slot not added' });
                }

                res.send({ success: true, message: 'Slot added' });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });


        app.get('/trainer-slot/:email', async (req, res) => {
            const { email } = req.params;

            try {
                const trainer = await trainerCollection.findOne(
                    { email, status: 'approved' },
                    { projection: { fullName: 1, slots: 1, _id: 0 } }
                );

                if (!trainer) {
                    return res
                        .status(404)
                        .send({ success: false, message: 'Trainer not found or not approved' });
                }

                /* If trainer has no slots yet, send empty array */
                res.send({
                    success: true,
                    fullName: trainer.fullName,
                    slots: trainer.slots || []
                });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // insert a trainer in the class 
        app.patch('/insert-trainer-in-class/:id', async (req, res) => {
            const { id } = req.params;
            const { trainerImage, trainerEmail, trainerID } = req.body;

            if (!trainerEmail || !trainerImage) {
                return res.status(400).send({ success: false, message: 'Missing trainer info' });
            }

            try {
                /* ── 1️⃣  Fetch the class once ── */
                const cls = await classesCollection.findOne(
                    { _id: new ObjectId(id) },
                    { projection: { trainer: 1 } }
                );

                if (!cls) {
                    return res.status(404).send({ success: false, message: 'Class not found' });
                }

                /* ── 2️⃣  Duplicate / capacity checks ── */
                const trainersArr = cls.trainer || [];

                // a) Duplicate?
                const alreadyExists = trainersArr.some(t => t.trainerEmail === trainerEmail);
                if (alreadyExists) {
                    return res
                        .status(400)
                        .send({ success: false, message: 'Trainer already added to this class' });
                }

                // b) Capacity (max 5)
                if (trainersArr.length >= 5) {
                    return res
                        .status(400)
                        .send({ success: false, message: 'Trainer limit (5) reached for this class' });
                }

                /* ── 3️⃣  Push new trainer ── */
                const newTrainer = { trainerImage, trainerEmail, trainerID };

                const result = await classesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { trainer: newTrainer } }
                );

                res.send({ success: true, message: 'Trainer added', modifiedCount: result.modifiedCount });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });

        // change user profile information
        app.patch('/update-profile', async (req, res) => {
            const { email, name, photoURL, lastLogin } = req.body;

            if (!email) {
                return res.status(400).send({ success: false, message: 'Email missing' });
            }

            try {
                const result = await userCollection.updateOne(
                    { email },
                    {
                        $set: {
                            name,
                            photoURL,
                            lastLogin
                        }
                    }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ success: false, message: 'User not found' });
                }

                res.send({ success: true, message: 'Profile updated' });
            } catch (err) {
                console.error(err);
                res.status(500).send({ success: false, message: 'Server error' });
            }
        });


        app.get('/trainer-status-list', async (_req, res) => {
            try {
                const users = await userCollection
                    .find(
                        { trainerStatus: { $in: ['pending', 'rejected'] } },
                        { projection: { _id: 0, name: 1, email: 1, trainerStatus: 1 } }
                    )
                    .toArray();

                res.json({ success: true, users });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });


        app.get('/rejection-feedback/:email', async (req, res) => {
            const { email } = req.params;
            try {
                const fbDoc = await rejectionFeedback.findOne(
                    { email },
                    { projection: { _id: 0, feedback: 1, rejectedAt: 1 } }
                );

                if (!fbDoc) {
                    return res
                        .status(404)
                        .json({ success: false, message: 'No feedback found for this user' });
                }

                res.json({ success: true, ...fbDoc });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        // save forms data

        app.post('/save-forums-data', async (req, res) => {
            const { title, tags = [], content, imageURL = '', authorImage, author, authorEmail } = req.body;

            if (!title || !content) {
                return res
                    .status(400)
                    .json({ success: false, message: 'Title and content are required' });
            }

            try {
                const doc = {
                    title,
                    tags,
                    content,
                    imageURL,
                    authorImage,
                    author,
                    authorEmail,
                    voteCount: 0,
                    createdAt: new Date().toISOString()
                };

                await forumsCollection.insertOne(doc);
                res.json({ success: true, message: 'Forum saved' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });


        // get forums details

        app.get('/forums', async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const limit = 6;
            const skip = (page - 1) * limit;

            try {
                const total = await forumsCollection.countDocuments();
                const forums = await forumsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.json({
                    success: true,
                    data: forums,
                    currentPage: page,
                    totalPages: Math.ceil(total / limit)
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        // forums voting
        app.patch('/forum-vote/:id', async (req, res) => {
            const { id } = req.params;
            const { vote } = req.body;      // +1 or -1


            if (![1, -1].includes(vote))
                return res.status(400).json({ success: false, message: 'Vote must be 1 or -1' });

            try {
                const result = await forumsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { voteCount: vote } }
                );

                if (result.modifiedCount === 0)
                    return res.status(404).json({ success: false, message: 'Post not found' });

                res.json({ success: true });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        // implement delete slot functionality

        app.delete('/delete-slot/:slotId', async (req, res) => {
            const { slotId } = req.params;
            const { email } = req.body;

            if (!email)
                return res.status(400).json({ success: false, message: 'Email required' });

            try {
                // pull + return the slot
                const trainerRes = await trainerCollection.findOneAndUpdate(
                    { email, 'slots._id': new ObjectId(slotId) },
                    { $pull: { slots: { _id: new ObjectId(slotId) } } },
                    { projection: { 'slots.$': 1 }, returnDocument: 'before' }
                );

                console.log("ddd", trainerRes)

                const removedSlot = trainerRes?.slots?.[0];

                console.log("kkk", removedSlot)
                if (!removedSlot)
                    return res.status(404).json({ success: false, message: 'Slot not found' });

                // pull trainer ref from class
                await classesCollection.updateOne(
                    { _id: new ObjectId(removedSlot.classId) },
                    { $pull: { trainer: { trainerEmail: email } } }
                );

                res.json({ success: true, message: 'Slot & class link deleted' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        // get user role 

        app.get('/user-role/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne(
                { email },
            )
            res.send({ role: result?.userRole });

            console.log("user logged in you system")
        })

        //give a token to a user after he login

        app.post('/jwt', async (req, res) => {
            const { email } = req.body;
            if (!email) return res.status(400).send({ message: 'Email required' });

            const token = generateToken(email);
            res.send({ token });
        });


        app.get('/slot-details/:slotId', async (req, res) => {
            const { slotId } = req.params;

            const trainerId = req.query.trainerId;

            console.log(trainerId)

            if (!trainerId)
                return res.status(400).json({ success: false, message: 'trainerId required' });

            try {
                // 1️⃣  Find trainer by _id AND the slot inside his slots array
                const trainerDoc = await trainerCollection.findOne(
                    {
                        _id: new ObjectId(trainerId),
                        'slots._id': new ObjectId(slotId)
                    },
                    {
                        projection: { 'slots.$': 1, _id: 0 }
                    }
                );

                console.log(trainerDoc)

                if (!trainerDoc || !trainerDoc.slots?.length)
                    return res.status(404).json({ success: false, message: 'Slot not found' });

                // 2️⃣  Return the matched slot
                res.json({ success: true, data: trainerDoc.slots[0] });
            } catch (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Server error' });
            }
        });

        // payment intent 

        app.post('/create-payment-intent', async (req, res) => {
            try {
                const { amount, slotId } = req.body;

                console.log(amount, slotId)

                // Convert amount to smallest currency unit (e.g., $10.00 -> 1000 cents)
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.error('Payment Intent Error:', error);
                res.status(500).send({ error: error.message });
            }
        })



        // await client.db("admin").command({ ping: 1 });
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
