var express = require('express');
var router = express.Router();
const upload = require('./multer');

const userModel = require("./users");
const postModel = require("./post");
const commentModel = require("./comment");
const Story = require('./story');
const User = require('./users')

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
router.get('/message', (req, res) => res.render('message', { footer: false }));
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
    const currentUser = await userModel
      .findOne({ username: req.session.passport.user })
      .populate("posts");

    res.render('profile', { footer: true, user: currentUser, currentUser });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Any user's profile by ID (for search results)
router.get('/profile/:id', isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findById(req.params.id).populate("posts");
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.render('profile', { footer: true, user });
  } catch (err) {
    console.error("Profile by ID Error:", err);
    res.status(500).send("Server Error");
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
    const currentUser = await userModel.findById(req.user._id); // logged in user

    res.render('profile', { 
      user,
      currentUser 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading profile");
  }
});





// Follow a user
// follow
router.post('/follow/:id', isLoggedIn, async (req, res) => {
  let currentUser = await userModel.findById(req.user._id);
  let targetUser = await userModel.findById(req.params.id);

  if (!targetUser.followers.includes(currentUser._id)) {
    targetUser.followers.push(currentUser._id);
    currentUser.following.push(targetUser._id);
    await targetUser.save();
    await currentUser.save();
  }
  res.json({ status: 'followed' });
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
