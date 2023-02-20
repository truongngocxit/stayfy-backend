//MISC REQUIRES
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "./config.env") });
const cors = require("cors");

const axios = require("axios");

//EXPRESS SETUP
const express = require("express");
const app = express();
app.use(express.json());
app.use(cors({ origin: true }));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(express.static(__dirname + "/public"));

const port = process.env.PORT || 8080;

//FIREBASE SETUP
const { initializeApp, cert } = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
  FieldPath,
} = require("firebase-admin/firestore");

const serviceAccountKey = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
const firebaseConfig = {
  credential: cert(serviceAccountKey),
  databaseURL:
    "https://stayfy-d4fc1-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "gs://stayfy-d4fc1.appspot.com",
};

initializeApp(firebaseConfig);
const db = getFirestore();

// HOME / DOCUMENTATION
app.route("/").get(async (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.route("/all-docs/:collection").get(async (req, res) => {
  const collection = req.params.collection;

  const allowedCollection = [
    "founders",
    "facts",
    "filters",
    "locations",
    "facilities",
  ];

  if (allowedCollection.includes(collection)) {
    const collectionRef = db.collection(collection);
    const collectionSnapshot = await collectionRef.get();
    const collectionObject = {};
    collectionSnapshot.forEach(
      (doc) => (collectionObject[doc.id] = doc.data())
    );
    res.status(200).json(collectionObject);
  } else {
    res.status(403).json({
      error: "403",
      message: "Unpermitted collections",
    });
  }
});

// LOGIN

app.route("/login").post(async (req, res) => {
  const { email = null, password = null } = req.body;

  const usersSnapshot = await db
    .collection("users")
    .where("email", "==", email)
    .where("password", "==", password)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    res.status(200).json({
      error: true,
      message: "Account not found",
    });
  }

  let userData;

  usersSnapshot.forEach((doc) => {
    userData = { id: doc.id, ...doc.data() };
  });

  res.status(200).json(userData);
});

// SIGNUP

app.route("/signup").post(async (req, res) => {
  const newUserRef = db.collection("users").doc();
  await newUserRef.set(req.body);

  res.status(200).json({
    message: "Successfully create account",
  });
});

// PATCH/UPDATE USER INFO

app.route("/update-user").patch(async (req, res) => {
  const { userId = null, updatedData = null } = req.body;

  await db.collection("users").doc(userId).update(updatedData);

  const updatedUserSnapshot = await db.collection("users").doc(userId).get();

  res.json({ id: updatedUserSnapshot.id, ...updatedUserSnapshot.data() });
});

app.route("/delete-user").delete(async (req, res) => {
  const { userId = null } = req.body;

  await db.collection("users").doc(userId).delete();

  res.json({
    message: "Successfully deleted user",
  });
});

// ADD NEW BOOKINGS

app.route("/add-booking").post(async (req, res) => {
  const { bookingData, userId } = req.body;

  // add new booking
  const newBookingRef = db.collection("bookings").doc();

  await newBookingRef.set(bookingData);

  //add the booking to users
  const userRef = db.collection("users").doc(userId);
  await userRef.update({
    [`upcomingTrips.${newBookingRef.id}`]: { bookingId: newBookingRef.id },
  });

  res.status(200).json({
    bookingId: newBookingRef.id,
    tripId: newBookingRef.id,
  });
});

app.route("/upcoming-trips/:userId").get(async (req, res) => {
  const { userId } = req.params;

  const bookings = {};

  const bookingsDataSnapshot = await db
    .collection("bookings")
    .where("guestInfo.userId", "==", userId)
    .get();

  bookingsDataSnapshot.forEach((doc) => {
    bookings[doc.id] = doc.data();
  });

  res.status(200).json(bookings);
});

//GET LODGES BY ID
//CAUTION: ONLY 10 RETURNS AT A TIME
app.route("/lodges-by-ids").get(async (req, res) => {
  const { lodges } = req.query;
  const lodgesData = {};
  const lodgesSnapshot = await db
    .collection("lodges")
    .where("id", "in", lodges)
    .get();

  if (lodgesSnapshot.empty) {
    return res.status(404).json({
      error: true,
      message: "There's no match for the requested lodge id",
    });
  }

  lodgesSnapshot.forEach((doc) => {
    lodgesData[doc.id] = doc.data();
  });

  res.status(200).json(lodgesData);
});

app.route("/delete-trip").delete(async (req, res) => {
  const { bookingId, userId } = req.query;

  await db.collection("bookings").doc(bookingId).delete();
  await db
    .collection("users")
    .doc(userId)
    .update({
      [`upcomingTrips.${bookingId}`]: FieldValue.delete(),
    });

  res.send({
    message: "Delete trip successfully",
    deletedBookingId: bookingId,
    atUser: userId,
  });
});

app.route("/get-paginated-lodges").get(async (req, res) => {
  console.log(req.query);

  const {
    cursor: currentCursor,
    numOfItems,
    featureFilter = null,
    locationFilter = null,
    price,
    facilities,
    typesOfStay,
  } = req.query;

  const data = {};
  let lastCursor;

  let lodgesRef = db.collection("lodges").limit(Number(numOfItems) || 8);

  if (!price) {
    lodgesRef = lodgesRef.orderBy(FieldPath.documentId());
  } else {
    lodgesRef = lodgesRef
      .orderBy("price.avg")
      .where("price.avg", ">=", Number(price.min))
      .where("price.avg", "<=", Number(price.max));
  }

  if (facilities) {
    facilities.forEach((fac) => {
      if (!fac) return;
      lodgesRef = lodgesRef.where(`amenities.${fac}`, "==", true);
    });
  }

  if (typesOfStay) {
    typesOfStay.forEach((type) => {
      if (!type) return;
      lodgesRef = lodgesRef.where(`allTypes.${type}`, "==", true);
    });
  }

  if (featureFilter) {
    lodgesRef = lodgesRef.where(`features.${featureFilter}`, "==", true);
  }

  if (locationFilter) {
    lodgesRef = lodgesRef.where("location", "==", locationFilter);
  }

  if (currentCursor) {
    lodgesRef = lodgesRef.startAfter(currentCursor);
  }

  const snapshot = await lodgesRef.get();

  if (snapshot.empty) {
    res.status(200).json({
      hasEnded: true,
    });
    return;
  }

  snapshot.forEach((doc) => {
    lastCursor = doc.id;
    data[doc.id] = doc.data();
  });

  res.status(200).json({
    hasEnded: false,
    lastCursor,
    data,
  });
});

app.route("/query-lodge").get(async (req, res) => {
  const { descending = false, filter, orderBy, limit = 5 } = req.query;

  let data = {};
  let lodgeRef = db
    .collection("lodges")
    .orderBy(orderBy, descending ? "desc" : "asc");

  if (filter) {
    const { field, queryOperator, value } = filter;
    lodgeRef = lodgeRef.where(field, queryOperator, value);
  }

  if (limit) {
    lodgeRef = lodgeRef.limit(Number(limit));
  }

  const lodgesSnapshot = await lodgeRef.get();

  if (lodgesSnapshot.empty) {
    res.status(200).json({
      empty: true,
      message: "No document matches",
    });
    return;
  }

  lodgesSnapshot.forEach((doc) => {
    data[doc.id] = doc.data();
  });

  res.status(200).json(data);
});

app.route("/add-subscription").post(async (req, res) => {
  const { email } = req.body;

  await db.collection("subscriptions").doc().set({ email });

  res.status(200).json({
    message: "Subscription added successfully",
  });
});

app.route("/test-route").get(async (req, res) => {
  const data = {};
  const snapshot = await db
    .collection("lodges")
    .where("name", "==", "Faithien Homestay")
    .get();

  snapshot.forEach((doc) => {
    data[doc.id] = doc.data();
    console.log(doc.id, "=>", doc.data());
  });

  res.json(data);
});

//Change user profile image
app.route("/patch-profile-image").patch(async (req, res) => {
  const { userId, profileImage } = req.body;

  await db
    .collection("users")
    .doc(userId)
    .update({
      profileImage:
        profileImage ||
        "https://firebasestorage.googleapis.com/v0/b/stayfy-d4fc1.appspot.com/o/misc%2Fplaceholder-profile-image.png?alt=media&token=d7ee83a6-7b08-49e1-9d75-14de009335c9",
    });

  res.status(200).json({
    message: "Successfully change profileImage",
    userId,
    profileImage,
  });
});

app.listen(port, function (error) {
  if (error) {
    console.log(error);
  }

  console.log(`Server is running on port: ${port}`);
});
