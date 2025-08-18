var express = require('express');
var router = express.Router();
const upload = require('./multer');
const mongoose = require('mongoose');

const userModel = require("./users");
const postModel = require("./post");
const commentModel = require("./comment");
const Story = require('./story');
const User = require('./users')
const messageModel = require('./message');
const passport = require("passport");
const localStrategy = require('passport-local');

passport.use(new localStrategy(userModel.authenticate()));

// Login check middleware
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

// ---------------- BASIC PAGES ----------------
router.get('/', (req, res) => res.render('index', { footer: false }));
router.get('/chatsection', (req, res) => res.render('chatsection', { footer: false }));
router.get('/login', (req, res) => res.render('login', { footer: false }));
router.get('/search', isLoggedIn, (req, res) => res.render('search', { footer: true }));
router.get('/upload', isLoggedIn, (req, res) => res.render('upload', { footer: true }));

// ---------------- FEED WITH GROUPED STORIES ----------------
router.get("/feed", isLoggedIn, async (req, res) => {
  try {
    const posts = await postModel.find().populate("user");
    const user = await userModel.findOne({ username: req.session.passport.user });

    const allStories = await Story.find()
      .populate("user")
      .sort({ createdAt: -1 });

    // Group stories by user so one circle per user
    const groupedStories = Object.values(
      allStories.reduce((acc, s) => {
        const uid = s.user._id.toString();
        if (!acc[uid]) acc[uid] = { user: s.user, stories: [] };
        acc[uid].stories.push(s);
        return acc;
      }, {})
    );

    res.render("feed", { footer: true, posts, user, stories: groupedStories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading feed");
  }
});

// ---------------- STORY ROUTES ----------------
// All stories for one user (slideshow)
router.get("/stories/user/:userId", isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findById(req.params.userId);
    if (!user) return res.status(404).send("User not found");

    const userStories = await Story.find({ user: user._id }).sort({ createdAt: 1 });

    if (!userStories.length) return res.status(404).send("No stories for this user");

    res.render("storyView", { user, stories: userStories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading user stories");
  }
});

// Single story fallback
router.get("/story/:id", isLoggedIn, async (req, res) => {
  try {
    const story = await Story.findById(req.params.id).populate("user");
    if (!story) return res.status(404).send("Story not found");
    res.render("storyView", { story });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading story");
  }
});

// ---------------- LIKE / SAVE ----------------
router.get('/like/:postid', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });
  const post = await postModel.findById(req.params.postid);
  if (!post) return res.status(404).send("Post not found");

  const index = post.likes.indexOf(user._id);
  if (index === -1) post.likes.push(user._id);
  else post.likes.splice(index, 1);

  await post.save();
  res.json(post);
});

router.get('/postsave/:postid', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });
  const index = user.postsave.indexOf(req.params.postid);
  if (index === -1) user.postsave.push(req.params.postid);
  else user.postsave.splice(index, 1);

  await user.save();
  res.json(user);
});

// ---------------- PROFILE / SAVED ----------------
router.get('/profile', isLoggedIn, async (req, res) => {
  try {
    const currentUser = await userModel.findById(req.user._id).populate("posts");
    res.render('profile', { footer: true, user: currentUser, loggedInUser: currentUser });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});




router.get('/saved', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user }).populate('postsave');
    res.render('saved', { footer: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  }
});

// ---------------- COMMENTS ----------------
router.get('/comment/:postId', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    const post = await postModel.findById(req.params.postId).populate("user");
    const comments = await commentModel.find({ post: req.params.postId }).populate("user");
    res.render('comment', { footer: false, user, post, comments });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

// ---------------- EDIT PROFILE ----------------
router.get('/edit', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render('edit', { footer: true, user });
});

// ---------------- USER SEARCH ----------------
router.get('/username/:username', isLoggedIn, async (req, res) => {
  try {
    const regex = new RegExp(`^${req.params.username}`, 'i');
    const users = await userModel.find({ username: regex });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while searching users" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const query = req.query.username;

    if (!query || query.trim() === "") {
      return res.json([]);
    }

    const users = await userModel.find({
      username: { $regex: query, $options: "i" }
    }).select("username profilePicture _id");

    console.log("🔍 Query:", query);
    console.log("✅ Users found:", users);

    // Cache disable karo
    res.set("Cache-Control", "no-store");

    res.json(users);
  } catch (err) {
    console.error("❌ Error searching:", err);
    res.status(500).json([]);
  }
});


// ---------------- AUTH ----------------
router.post('/register', (req, res, next) => {
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    picture: req.body.picture,
    email: req.body.email,
  });
  userModel.register(userData, req.body.password)
    .then(() => {
      passport.authenticate("local")(req, res, () => res.redirect("/profile"));
    })
    .catch(next);
});

router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login',
}));

// ---------------- UPDATE PROFILE ----------------
router.post('/update', upload.single('image'), async (req, res) => {
  const user = await userModel.findOneAndUpdate(
    { username: req.session.passport.user },
    { username: req.body.username, name: req.body.name, Bio: req.body.Bio },
    { new: true }
  );
  if (req.file) {
    user.profileImage = req.file.filename;
  }
  await user.save();
  res.redirect("/profile");
});

// ---------------- UPLOAD POST OR STORY ----------------
router.post("/upload", isLoggedIn, upload.single("media"), async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    if (!user) return res.status(404).send("User not found");

    if (req.body.type === "story") {
      await Story.create({
        media: req.file.filename,
        user: user._id,
        mediaType: req.file.mimetype.startsWith("video") ? "video" : "image"
      });
      return res.redirect("/feed");
    }

    const post = await postModel.create({
      media: req.file.filename,
      user: user._id,
      caption: req.body.caption
    });
    user.posts.push(post.id);
    await user.save();

    res.redirect("/feed");
  } catch (error) {
    console.log(error);
    res.status(500).send("Something went wrong");
  }
});

router.get('/profile/:id', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id).populate("posts");
    const loggedInUser = await userModel.findById(req.user._id); // logged in user

    res.render('profile', { 
      user,
      loggedInUser  // EJS me follow/unfollow ke liye use hoga
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading profile");
  }
});

// ---------------- MESSAGES ----------------

router.get('/chatsection/:id', isLoggedIn, async (req, res) => {
  try {
    const otherUser = await userModel.findById(req.params.id).lean();
    if (!otherUser) return res.redirect('/message');

    res.render('chatsection', {
      currentUser: req.user,
      otherUser
    });
  } catch (err) {
    console.error(err);
    res.redirect('/message');
  }
});

// Send a message
router.post('/send', isLoggedIn, async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver ID" });
    }

    const message = await messageModel.create({
      sender: req.user._id,
      receiver: receiverId,
      text
    });

    const populatedMsg = await message.populate("sender", "username profilePicture")
                                     .populate("receiver", "username profilePicture")
                                     .execPopulate();

    res.status(200).json(populatedMsg);
  } catch (err) {
    console.error("Failed to send message:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});


// Get messages with a user
router.get('/message/:id', isLoggedIn, async (req, res) => {
  const userId = req.params.id;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid or missing user ID" });
  }

  try {
    const messages = await messageModel.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
    .populate("sender", "username profilePicture")
    .populate("receiver", "username profilePicture")
    .sort({ createdAt: 1 })
    .lean();

    res.status(200).json(messages);
  } catch (err) {
    console.error("❌ Error fetching chat:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/message", isLoggedIn, async (req, res) => {
  try {
    // Current user se related saare chats find karenge
    const recentMessages = await messageModel.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ updatedAt: -1 });

    // EJS file render karte waqt user bhi bhejna hoga
    res.render("messages", {
      user: req.user,         // 👈 Yeh important hai
      recentMessages          // Yeh message list
    });

  } catch (err) {
    console.error("❌ Error fetching messages:", err);
    res.redirect("/feed");
  }
});


// Follow a user
// follow
// routes/user.js
// routes/user.js
// Follow/Unfollow a user
router.post('/follow/:id', isLoggedIn, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id);
        const currentUser = await User.findById(req.user._id);

        if (!targetUser || !currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        let status;

        if (currentUser.following.includes(targetUser._id.toString())) {
            // Unfollow
            currentUser.following = currentUser.following.filter(
                id => id.toString() !== targetUser._id.toString()
            );
            targetUser.followers = targetUser.followers.filter(
                id => id.toString() !== currentUser._id.toString()
            );
            status = 'unfollowed';
        } else {
            // Follow
            currentUser.following.push(targetUser._id);
            targetUser.followers.push(currentUser._id);
            status = 'followed';
        }

        await currentUser.save();
        await targetUser.save();

        // Return status and updated counts
        return res.json({
            status,
            followersCount: targetUser.followers.length,
            followingCount: targetUser.following.length
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});



router.post('/unfollow/:id', isLoggedIn, async (req, res) => {
  let currentUser = await userModel.findById(req.user._id);
  let targetUser = await userModel.findById(req.params.id);

  targetUser.followers = targetUser.followers.filter(f => f.toString() !== currentUser._id.toString());
  currentUser.following = currentUser.following.filter(f => f.toString() !== targetUser._id.toString());

  await targetUser.save();
  await currentUser.save();
  res.json({ status: 'unfollowed' });
});





module.exports = router;
